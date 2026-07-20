import { prisma } from "@/lib/prisma";
import { approximateLeaveHoursForPayrollMonth } from "@/modules/payroll/services/payroll-leave-integration-service";
import { updatePayrollEntryAmounts } from "@/modules/payroll/services/payroll-period-service";
import { resolvePayrollMonthWorkingTime } from "@/modules/payroll/services/payroll-working-time-service";

/** Muajt (viti, muaji) të mbuluar nga një interval datash UTC — përfshirës në të dy skajet. */
export function payrollMonthsCoveredByRange(startDate: Date, endDate: Date): Array<{ year: number; month: number }> {
  const months: Array<{ year: number; month: number }> = [];
  let y = startDate.getUTCFullYear();
  let m = startDate.getUTCMonth() + 1;
  const endY = endDate.getUTCFullYear();
  const endM = endDate.getUTCMonth() + 1;
  while (y < endY || (y === endY && m <= endM)) {
    months.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

export interface LeavePayrollSyncResult {
  synced: Array<{ payrollId: string; year: number; month: number }>;
  skipped: Array<{ payrollId: string; year: number; month: number; reason: string }>;
}

function monthBoundsUtc(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
  };
}

/**
 * Sinkronizon payroll-et në DRAFT me ndryshimin e një pushimi (miratim / revokim / ndërprerje).
 *
 * Për çdo payroll DRAFT që mbivendoset me intervalin e pushimit dhe ku punonjësi ka
 * tashmë një rresht, rreshti ripërllogaritet nga pushimet aktuale të miratuara
 * (orët e pushimit + orët e rregullta ri-derivohen), duke ruajtur fushat e futura
 * manualisht (orë shtesë / vikend / festë / natë, bonus, zbritje, avans).
 *
 * Rregulla sigurie:
 * - Payroll-et jo-DRAFT nuk preken kurrë; raportohen si të anashkaluar me paralajmërim
 *   sepse orët e tyre mbeten të vjetruara derisa të kthehen në draft.
 * - Orët e rregullta/pushimit mbishkruhen nga burimi i miratuar PUSHIMET; të gjitha
 *   inputet e tjera manuale dhe ID-ja e rreshtit ruhen nga përditësimi in-place.
 * - Rreshtat e muajit të pjesshëm ruajnë orët e pritura ekzistuese të kufizuara.
 * - Garda optimiste `updatedAt` aplikohet atomikisht gjatë përditësimit —
 *   një edit i njëkohshëm në spreadsheet e ndal sinkronizimin në vend që të humbasë.
 * - Dështimet nuk hedhin — kthehen si "skipped" që veprimi i pushimit të mos bllokohet.
 */
export async function syncDraftPayrollsForLeaveChange(params: {
  companyId: string;
  employeeId: string;
  startDate: Date;
  endDate: Date;
  actorUserId?: string | null;
}): Promise<LeavePayrollSyncResult> {
  const result: LeavePayrollSyncResult = { synced: [], skipped: [] };

  const months = payrollMonthsCoveredByRange(params.startDate, params.endDate);
  if (months.length === 0) return result;

  const payrolls = await prisma.payroll.findMany({
    where: {
      companyId: params.companyId,
      OR: months.map((m) => ({ year: m.year, month: m.month })),
    },
    select: { id: true, year: true, month: true, status: true },
  });
  if (payrolls.length === 0) return result;

  for (const p of payrolls) {
    try {
      if (p.status !== "DRAFT") {
        // Vetëm DRAFT ndryshohet; çdo gjendje tjetër merr paralajmërim të dukshëm.
        const hasEntry = await prisma.payrollEntry.findUnique({
          where: { payrollId_employeeId: { payrollId: p.id, employeeId: params.employeeId } },
          select: { id: true },
        });
        if (hasEntry) {
          result.skipped.push({
            payrollId: p.id,
            year: p.year,
            month: p.month,
            reason:
              `Payroll-i është ${p.status} — orët e pushimit nuk u përditësuan. Kthejeni në DRAFT për t'i rifreskuar.`,
          });
        }
        continue;
      }

      const entry = await prisma.payrollEntry.findUnique({
        where: { payrollId_employeeId: { payrollId: p.id, employeeId: params.employeeId } },
        include: { employee: { select: { weeklyHours: true } } },
      });
      if (!entry) {
        // Punonjësi nuk është pjesë e këtij payroll-i — asgjë për të sinkronizuar.
        continue;
      }

      const { start, end } = monthBoundsUtc(p.year, p.month);
      const [wt, leaveReqs] = await Promise.all([
        resolvePayrollMonthWorkingTime(params.companyId, p.year, p.month),
        prisma.leaveRequest.findMany({
          where: {
            companyId: params.companyId,
            employeeId: params.employeeId,
            status: "APPROVED",
            affectsPayroll: true,
            AND: [{ startDate: { lte: end } }, { endDate: { gte: start } }],
          },
          select: {
            id: true,
            type: true,
            startDate: true,
            endDate: true,
            isPaid: true,
            affectsPayroll: true,
            subtype: true,
            interruptedByLeaveRequestId: true,
            metricsRuleVersion: true,
          },
        }),
      ]);
      if (!wt) {
        result.skipped.push({
          payrollId: p.id,
          year: p.year,
          month: p.month,
          reason: "Nuk mund të ngarkohet kalendari i punës për sinkronizimin e pushimit.",
        });
        continue;
      }

      // V1 uses the employee schedule; V2 requests override this inside the helper with fixed 8h.
      const rawDailyH = Math.min(Number(entry.employee.weeklyHours) / 5, Number(wt.hoursPerWorkingDay));
      const dailyH = Number.isFinite(rawDailyH) && rawDailyH > 0 ? rawDailyH : Number(wt.hoursPerWorkingDay);
      const leaveHrs = await approximateLeaveHoursForPayrollMonth({
        companyId: params.companyId,
        requests: leaveReqs,
        monthStart: start,
        monthEnd: end,
        dailyHours: dailyH,
      });
      const expected =
        entry.expectedRegularHours != null
          ? Number(entry.expectedRegularHours)
          : Number(entry.actualRegularHours) + Number(entry.paidLeaveHours) + Number(entry.sickLeaveHours);
      const actualRegular = Math.max(0, expected - leaveHrs.paidLeaveHours - leaveHrs.sickLeaveHours);

      const recalc = await updatePayrollEntryAmounts(
        params.companyId,
        entry.id,
        {
          actualRegularHours: actualRegular.toFixed(2),
          paidLeaveHours: leaveHrs.paidLeaveHours.toFixed(2),
          sickLeaveHours: leaveHrs.sickLeaveHours.toFixed(2),
          unpaidLeaveHours: leaveHrs.unpaidLeaveHours.toFixed(2),
        },
        params.actorUserId,
        { expectedUpdatedAt: entry.updatedAt },
      );

      if (recalc.ok) {
        result.synced.push({ payrollId: p.id, year: p.year, month: p.month });
      } else {
        result.skipped.push({ payrollId: p.id, year: p.year, month: p.month, reason: recalc.error });
      }
    } catch (err) {
      // Një dështim për një payroll nuk i ndal të tjerët dhe nuk e bllokon veprimin e pushimit.
      console.error(`[pagapro] syncDraftPayrollsForLeaveChange: payroll ${p.id} failed`, err);
      result.skipped.push({
        payrollId: p.id,
        year: p.year,
        month: p.month,
        reason: err instanceof Error ? err.message : "Gabim i papritur gjatë sinkronizimit.",
      });
    }
  }

  return result;
}

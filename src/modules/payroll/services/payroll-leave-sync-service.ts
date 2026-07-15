import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recalculatePayrollEntriesForEmployees } from "@/modules/payroll/services/payroll-period-service";

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

/**
 * A ka rreshti redaktime manuale të orëve? Rreshtat e sinkronizuar/gjeneruar respektojnë
 * identitetin actualReg == max(0, expected − paid − sick); një devijim do të thotë që
 * dikush ka redaktuar orët me dorë — sinkronizimi nuk i mbishkruan ato.
 * (Rreshtat e vjetër me orë pa pagesë të mbjella para rregullimit të zbritjes së dyfishtë
 * gjithashtu devijojnë — anashkalohen me paralajmërim, gjë që i nxjerr në pah për rishikim.)
 */
export function hasManualHourEdits(entry: {
  expectedRegularHours: Prisma.Decimal | null;
  actualRegularHours: Prisma.Decimal;
  paidLeaveHours: Prisma.Decimal;
  sickLeaveHours: Prisma.Decimal;
}): boolean {
  if (entry.expectedRegularHours == null) return false;
  const derived = Math.max(
    0,
    Number(entry.expectedRegularHours) - Number(entry.paidLeaveHours) - Number(entry.sickLeaveHours),
  );
  return Math.abs(Number(entry.actualRegularHours) - derived) > 0.005;
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
 * - Payroll-et jo-DRAFT nuk preken kurrë; ata NË SHQYRTIM raportohen si të anashkaluar
 *   (paralajmërim në timeline) sepse orët e tyre mbeten të vjetruara derisa të kthehen në draft.
 * - Rreshtat me override manual bruto/neto, arsye override-i, shënime, ose me orë të
 *   redaktuara manualisht anashkalohen me paralajmërim — nuk mbishkruhen kurrë në heshtje.
 * - Rreshtat e muajit të pjesshëm (largim) rimbajnë kufirin e ditës së fundit të punës,
 *   të kërkuar vetëm brenda muajit të payroll-it.
 * - Garda optimiste `updatedAt` rikontrollohet brenda transaksionit të ripëllogaritjes —
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
      status: { in: ["DRAFT", "REVIEWED"] },
      OR: months.map((m) => ({ year: m.year, month: m.month })),
    },
    select: { id: true, year: true, month: true, status: true },
  });
  if (payrolls.length === 0) return result;

  for (const p of payrolls) {
    try {
      if (p.status !== "DRAFT") {
        // NË SHQYRTIM: nuk preket, por HR duhet ta dijë që orët e tij tani janë të vjetruara.
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
              "Payroll-i është në shqyrtim — orët e pushimit nuk u përditësuan. Kthejeni në draft për t'i rifreskuar.",
          });
        }
        continue;
      }

      const entry = await prisma.payrollEntry.findUnique({
        where: { payrollId_employeeId: { payrollId: p.id, employeeId: params.employeeId } },
      });
      if (!entry) {
        // Punonjësi nuk është pjesë e këtij payroll-i — asgjë për të sinkronizuar.
        continue;
      }

      if (
        entry.manualGrossOverride != null ||
        entry.manualNetOverride != null ||
        entry.manualGrossReason != null ||
        entry.manualNetReason != null ||
        entry.notes != null
      ) {
        result.skipped.push({
          payrollId: p.id,
          year: p.year,
          month: p.month,
          reason:
            "Rreshti ka override manual bruto/neto ose shënime — përditësoni orët e pushimit manualisht në spreadsheet.",
        });
        continue;
      }

      if (hasManualHourEdits(entry)) {
        result.skipped.push({
          payrollId: p.id,
          year: p.year,
          month: p.month,
          reason:
            "Orët e rreshtit janë redaktuar manualisht — përditësoni orët e pushimit manualisht në spreadsheet.",
        });
        continue;
      }

      // Rreshti i muajit të pjesshëm (pagë përfunduese): rimbaj kufirin e largimit,
      // të kërkuar vetëm brenda muajit të këtij payroll-i (punonjësit e ripunësuar mund
      // të kenë largime të tjera në muaj të tjerë).
      const breakdown = entry.calculationBreakdown as { terminationPartialMonth?: unknown } | null;
      let lastWorkingDayCap: Date | undefined;
      if (breakdown?.terminationPartialMonth === true) {
        const { start, end } = monthBoundsUtc(p.year, p.month);
        const term = await prisma.termination.findFirst({
          where: {
            companyId: params.companyId,
            employeeId: params.employeeId,
            status: { not: "CANCELLED" },
            lastWorkingDay: { gte: start, lte: end },
          },
          orderBy: { lastWorkingDay: "desc" },
          select: { lastWorkingDay: true },
        });
        if (!term) {
          result.skipped.push({
            payrollId: p.id,
            year: p.year,
            month: p.month,
            reason: "Rresht i muajit të pjesshëm pa largim aktiv në këtë muaj — rifreskoni manualisht.",
          });
          continue;
        }
        lastWorkingDayCap = term.lastWorkingDay;
      }

      const recalc = await recalculatePayrollEntriesForEmployees({
        companyId: params.companyId,
        payrollId: p.id,
        employeeIds: [params.employeeId],
        lastWorkingDayByEmployeeId: lastWorkingDayCap
          ? { [params.employeeId]: lastWorkingDayCap }
          : undefined,
        entryStatus: entry.status,
        actorUserId: params.actorUserId,
        updatePayrollAggregateMeta: false,
        guardEntryUpdatedAtByEmployeeId: { [params.employeeId]: entry.updatedAt },
        lineOverridesByEmployeeId: {
          [params.employeeId]: {
            // Ruaj vetëm fushat e futura nga përdoruesi — orët e pushimit dhe orët e
            // rregullta ri-derivohen nga pushimet e miratuara.
            overtimeHours: entry.overtimeHours.toString(),
            weekendHours: entry.weekendHours.toString(),
            holidayHours: entry.holidayHours.toString(),
            nightHours: entry.nightHours.toString(),
            bonuses: entry.bonuses.toString(),
            otherDeductions: entry.otherDeductions.toString(),
            salaryAdvanceDeduction: entry.salaryAdvanceDeduction.toString(),
          },
        },
      });

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

import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import {
  LargimetDashboardClient,
  type ChecklistProgressMap,
} from "@/modules/terminations/components/largimet-dashboard-client";
import {
  listEmployeesForTerminationPicker,
  listTerminationsForCompany,
} from "@/modules/terminations/services/termination-queries";
import { requireCompanyContextPage } from "@/server/company-context";

export const metadata: Metadata = {
  title: "Largimet",
};

function first(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  if (Array.isArray(v)) return v[0] ?? "";
  return typeof v === "string" ? v : "";
}

export default async function LargimetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { companyId } = await requireCompanyContextPage();

  const sp = await searchParams;
  const yearRaw = Number(first(sp, "year"));
  const monthRaw = Number(first(sp, "month"));

  const filters = {
    status: first(sp, "status") || undefined,
    type: first(sp, "type") || undefined,
    employeeId: first(sp, "employeeId") || undefined,
    year: Number.isFinite(yearRaw) ? yearRaw : undefined,
    month: Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : undefined,
  };

  let rows;
  let employees;
  const checklistProgress: ChecklistProgressMap = {};
  try {
    rows = await listTerminationsForCompany(companyId, filters);
    employees = await listEmployeesForTerminationPicker(companyId);

    // Presentation-only aggregation for the register's per-row checklist progress (x/6).
    if (rows.length > 0) {
      const checklistRows = await prisma.terminationChecklist.findMany({
        where: { companyId, terminationId: { in: rows.map((r) => r.id) } },
        select: { terminationId: true, isCompleted: true },
      });
      for (const item of checklistRows) {
        const entry = (checklistProgress[item.terminationId] ??= { done: 0, total: 0 });
        entry.total += 1;
        if (item.isCompleted) entry.done += 1;
      }
    }
  } catch (err) {
    console.error("[pagapro] LargimetPage load failed", err);
    return (
      <div className="mx-auto max-w-xl py-12">
        <p className="text-sm text-destructive">Nuk mund të ngarkohen largimet.</p>
      </div>
    );
  }

  const serializedRows = JSON.parse(JSON.stringify(rows)) as unknown;
  const serializedEmployees = JSON.parse(JSON.stringify(employees)) as unknown;

  return (
    <LargimetDashboardClient
      rows={serializedRows as never}
      employees={serializedEmployees as never}
      filters={filters}
      checklistProgress={checklistProgress}
    />
  );
}

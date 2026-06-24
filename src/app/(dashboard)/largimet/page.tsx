import type { Metadata } from "next";
import { LargimetDashboardClient } from "@/modules/terminations/components/largimet-dashboard-client";
import {
  listEmployeesForTerminationPicker,
  listTerminationsForCompany,
} from "@/modules/terminations/services/termination-queries";
import { resolveActiveCompanyId } from "@/server/company-scope";

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
  const companyId = await resolveActiveCompanyId();

  if (!companyId) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-12">
        <h1 className="text-2xl font-semibold text-foreground">Largimet</h1>
        <p className="text-sm text-muted-foreground">
          Nuk ka kompani aktive për këtë sesion. Vendosni cookie-in{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">pp_active_company_id</code> ose{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">DEV_DEFAULT_COMPANY_ID</code>.
        </p>
      </div>
    );
  }

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
  try {
    rows = await listTerminationsForCompany(companyId, filters);
    employees = await listEmployeesForTerminationPicker(companyId);
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
    />
  );
}

import type { Metadata } from "next";
import { EmployeesFilters, type EmployeesFilterValues } from "@/modules/employees/components/employees-filters";
import { EmployeesPageClient } from "@/modules/employees/components/employees-page-client";
import type { EmployeeFiltersDto } from "@/modules/employees/types";
import { getEmployeesPageData } from "@/modules/employees/services/employee-service";
import { resolveActiveCompanyId } from "@/server/company-scope";

export const metadata: Metadata = {
  title: "Punonjësit",
};

const STATUSES = new Set(["ACTIVE", "INACTIVE", "ON_LEAVE", "SUSPENDED", "TERMINATED"]);
const TYPES = new Set(["EMPLOYEE", "CONTRACTOR"]);

function first(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export default async function PunonjesitPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const companyId = await resolveActiveCompanyId();

  if (!companyId) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Punonjësit</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Nuk ka kompani aktive për këtë sesion. Vendosni cookie-in{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">pp_active_company_id</code>, variablën{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">DEV_DEFAULT_COMPANY_ID</code>, ose në development
          përdorni <code className="rounded bg-muted px-1.5 py-0.5 text-xs">POST /api/dev/active-company</code>.
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  const q = first(sp.q);
  const statusRaw = first(sp.status);
  const employmentTypeRaw = first(sp.employmentType);
  const departmentId = first(sp.departmentId);

  const filters: EmployeeFiltersDto = {
    search: q || undefined,
    status: STATUSES.has(statusRaw) ? (statusRaw as EmployeeFiltersDto["status"]) : "",
    employmentType: TYPES.has(employmentTypeRaw) ? (employmentTypeRaw as EmployeeFiltersDto["employmentType"]) : "",
    departmentId: departmentId || "",
  };

  let data;
  try {
    data = await getEmployeesPageData(companyId, filters);
  } catch (err) {
    console.error("[pagapro] PunonjesitPage: getEmployeesPageData failed", err);
    return (
      <div className="mx-auto max-w-xl py-12">
        <p className="text-sm font-medium text-destructive">
          Nuk mund të lexohen punonjësit. Verifikoni databazën dhe ekzekutoni{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npx prisma migrate deploy</code>.
        </p>
      </div>
    );
  }

  const defaults: EmployeesFilterValues = {
    q,
    status: filters.status ?? "",
    employmentType: filters.employmentType ?? "",
    departmentId: filters.departmentId ?? "",
  };

  return (
    <div className="space-y-8">
      <EmployeesFilters departments={data.departments} defaults={defaults} />
      <EmployeesPageClient employees={data.employees} departments={data.departments} />
    </div>
  );
}

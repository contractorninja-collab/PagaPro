import type { Metadata } from "next";
import { EmployeesFilters, type EmployeesFilterValues } from "@/modules/employees/components/employees-filters";
import { EmployeesPageClient } from "@/modules/employees/components/employees-page-client";
import type { EmployeeFiltersDto } from "@/modules/employees/types";
import { getEmployeesPageData } from "@/modules/employees/services/employee-service";
import { requireCompanyContextPage } from "@/server/company-context";

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
  const { companyId } = await requireCompanyContextPage();

  const sp = await searchParams;
  const q = first(sp.q);
  const statusRaw = first(sp.status);
  const employmentTypeRaw = first(sp.employmentType);
  const departmentId = first(sp.departmentId);
  const documentsMissing = first(sp.documentsMissing) === "1";

  const filters: EmployeeFiltersDto = {
    search: q || undefined,
    status: STATUSES.has(statusRaw) ? (statusRaw as EmployeeFiltersDto["status"]) : "",
    employmentType: TYPES.has(employmentTypeRaw) ? (employmentTypeRaw as EmployeeFiltersDto["employmentType"]) : "",
    departmentId: departmentId || "",
    documentsMissing: documentsMissing || undefined,
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
    documentsMissing,
  };

  // URL that toggles the documentsMissing quick-filter while preserving the other applied filters.
  const toggleParams = new URLSearchParams();
  if (q) toggleParams.set("q", q);
  if (filters.status) toggleParams.set("status", filters.status);
  if (filters.employmentType) toggleParams.set("employmentType", filters.employmentType);
  if (filters.departmentId) toggleParams.set("departmentId", filters.departmentId);
  if (!documentsMissing) toggleParams.set("documentsMissing", "1");
  const documentsMissingToggleHref = toggleParams.toString()
    ? `/punonjesit?${toggleParams.toString()}`
    : "/punonjesit";

  return (
    <EmployeesPageClient
      employees={data.employees}
      departments={data.departments}
      jobTitles={data.jobTitles}
      documentsMissingFilter={documentsMissing}
      documentsMissingToggleHref={documentsMissingToggleHref}
      filtersActive={Boolean(q || filters.status || filters.employmentType || filters.departmentId || documentsMissing)}
      filters={<EmployeesFilters departments={data.departments} defaults={defaults} />}
    />
  );
}

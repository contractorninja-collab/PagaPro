import type { Metadata } from "next";
import { EmployeesFilters, type EmployeesFilterValues } from "@/modules/employees/components/employees-filters";
import { EmployeesPageClient } from "@/modules/employees/components/employees-page-client";
import type { EmployeeFiltersDto } from "@/modules/employees/types";
import { getEmployeesPageData } from "@/modules/employees/services/employee-service";
import { isTimeClockEnabled } from "@/modules/timeclock/services/timeclock-entitlement";
import { requireCompanyContextPage } from "@/server/company-context";

export const metadata: Metadata = {
  title: "Punonjësit",
};

// "ALL" is not a status — it lifts the default hiding of leavers.
const STATUSES = new Set(["ACTIVE", "INACTIVE", "ON_LEAVE", "SUSPENDED", "TERMINATED", "ALL"]);
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

  /**
   * Each stat card is a filter. Building its href from the *current* query
   * means clicking one narrows the view instead of discarding the search or
   * department the user already picked — and clicking the active card clears
   * just that dimension.
   */
  function cardHref(patch: { status?: string; employmentType?: string; documentsMissing?: boolean }) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (filters.departmentId) params.set("departmentId", filters.departmentId);

    const status = "status" in patch ? patch.status : filters.status;
    const type = "employmentType" in patch ? patch.employmentType : filters.employmentType;
    const docs = "documentsMissing" in patch ? patch.documentsMissing : documentsMissing;

    if (status) params.set("status", status);
    if (type) params.set("employmentType", type);
    if (docs) params.set("documentsMissing", "1");

    const qs = params.toString();
    return qs ? `/punonjesit?${qs}` : "/punonjesit";
  }

  const activeStatus = filters.status ?? "";
  const unfiltered = !activeStatus && !filters.employmentType && !documentsMissing;
  const hint = (active: boolean) =>
    active ? "Filtri aktiv — kliko për ta hequr" : "Kliko për të filtruar";

  return (
    <EmployeesPageClient
      employees={data.employees}
      counts={data.counts}
      departments={data.departments}
      jobTitles={data.jobTitles}
      cards={[
        {
          key: "total",
          label: "Gjithsej",
          value: data.counts.total,
          href: cardHref({ status: "", employmentType: "", documentsMissing: false }),
          active: unfiltered,
          // The cleared state is not "a filter to remove" — say what it is.
          hint: unfiltered ? "E gjithë lista" : "Kliko për të pastruar filtrat",
        },
        {
          key: "active",
          label: "Aktivë",
          value: data.counts.active,
          href: cardHref({ status: activeStatus === "ACTIVE" ? "" : "ACTIVE" }),
          active: activeStatus === "ACTIVE",
          hint: hint(activeStatus === "ACTIVE"),
        },
        {
          key: "onLeave",
          label: "Në pushim",
          value: data.counts.onLeave,
          href: cardHref({ status: activeStatus === "ON_LEAVE" ? "" : "ON_LEAVE" }),
          active: activeStatus === "ON_LEAVE",
          hint: hint(activeStatus === "ON_LEAVE"),
        },
        {
          key: "contractors",
          label: "Kontraktorë",
          value: data.counts.contractors,
          href: cardHref({ employmentType: filters.employmentType === "CONTRACTOR" ? "" : "CONTRACTOR" }),
          active: filters.employmentType === "CONTRACTOR",
          hint: hint(filters.employmentType === "CONTRACTOR"),
        },
        {
          key: "documentsMissing",
          label: "Dok. mungojnë",
          value: data.counts.documentsMissing,
          href: cardHref({ documentsMissing: !documentsMissing }),
          active: documentsMissing,
          hint: hint(documentsMissing),
          tone: "warning",
        },
      ]}
      hiddenTerminated={
        activeStatus === "" && data.counts.terminated > 0 ? data.counts.terminated : 0
      }
      showAllHref={cardHref({ status: "ALL" })}
      filters={<EmployeesFilters departments={data.departments} defaults={defaults} />}
      timeClockEnabled={await isTimeClockEnabled(companyId)}
    />
  );
}

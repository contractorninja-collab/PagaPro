import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DashboardOperationalPage } from "@/modules/dashboard/components/dashboard-operational-page";
import { PAYROLL_HERO_COOKIE } from "@/modules/dashboard/helpers/dashboard-cookies";
import { loadDashboardOperationalData } from "@/modules/dashboard/services/dashboard-data-service";
import { parseDashboardFilters } from "@/modules/dashboard/helpers/dashboard-time";
import { listDepartmentsForCompany } from "@/modules/employees/services/employee-service";
import { requireCompanyContextPage } from "@/server/company-context";

export const metadata: Metadata = {
  title: "Paneli",
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaneliPage({ searchParams }: Props) {
  const { companyId, user } = await requireCompanyContextPage();
  const sp = await searchParams;
  const filters = parseDashboardFilters(sp);
  // Presentation preference only — never trusted for anything, so an absent or
  // junk value simply means "expanded".
  const payrollHeroCollapsed = (await cookies()).get(PAYROLL_HERO_COOKIE)?.value === "1";

  try {
    const [departments, data] = await Promise.all([
      listDepartmentsForCompany(companyId),
      loadDashboardOperationalData(companyId, filters),
    ]);
    return (
      <DashboardOperationalPage
        data={data}
        departments={departments}
        userDisplayName={user.displayName}
        payrollHeroCollapsed={payrollHeroCollapsed}
      />
    );
  } catch (err) {
    console.error("[pagapro] PaneliPage: load failed", err);
    return (
      <div className="mx-auto max-w-xl space-y-4 py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Paneli</h1>
        <p className="text-sm leading-relaxed text-destructive">
          Nuk mund të ngarkohen të dhënat operative. Verifikoni databazën dhe migrimet:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npx prisma migrate deploy</code>
        </p>
      </div>
    );
  }
}

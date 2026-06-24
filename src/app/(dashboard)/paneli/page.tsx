import type { Metadata } from "next";
import { DevActiveCompanyPicker } from "@/components/dev/dev-active-company-picker";
import { DashboardOperationalPage } from "@/modules/dashboard/components/dashboard-operational-page";
import { loadDashboardOperationalData } from "@/modules/dashboard/services/dashboard-data-service";
import { parseDashboardFilters } from "@/modules/dashboard/helpers/dashboard-time";
import { listDepartmentsForCompany } from "@/modules/employees/services/employee-service";
import { resolveActiveCompanyId } from "@/server/company-scope";

export const metadata: Metadata = {
  title: "Paneli",
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaneliPage({ searchParams }: Props) {
  const companyId = await resolveActiveCompanyId();
  const sp = await searchParams;
  const filters = parseDashboardFilters(sp);

  if (!companyId) {
    const isDev = process.env.NODE_ENV === "development";
    return (
      <div className="mx-auto max-w-xl space-y-4 py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Paneli</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Nuk ka kompani aktive për këtë sesion — paneli lexon vetëm të dhënat e kompanisë së zgjedhur. Vendosni cookie-in{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">pp_active_company_id</code>, variablën{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">DEV_DEFAULT_COMPANY_ID</code>, ose në development
          përdorni zgjedhësin më poshtë.
        </p>
        {isDev ? <DevActiveCompanyPicker /> : null}
      </div>
    );
  }

  try {
    const [departments, data] = await Promise.all([
      listDepartmentsForCompany(companyId),
      loadDashboardOperationalData(companyId, filters),
    ]);
    return <DashboardOperationalPage data={data} departments={departments} />;
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

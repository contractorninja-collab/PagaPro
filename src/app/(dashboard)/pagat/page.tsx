import type { Metadata } from "next";
import { DevActiveCompanyPicker } from "@/components/dev/dev-active-company-picker";
import { PayrollsPageClient } from "@/modules/payroll/components/payrolls-page-client";
import { listPayrollsForCompany } from "@/modules/payroll/services/payroll-period-service";
import { resolveActiveCompanyId } from "@/server/company-scope";

export const metadata: Metadata = {
  title: "Pagat",
};

export default async function PagatPage() {
  const companyId = await resolveActiveCompanyId();

  if (!companyId) {
    const isDev = process.env.NODE_ENV === "development";
    return (
      <div className="mx-auto max-w-xl space-y-4 py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pagat</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Nuk ka kompani aktive për këtë sesion — faqja duket &quot;e zbrazët&quot; sepse lista e pagave lidhet me një
          kompani të vetme. Vendosni cookie-in{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">pp_active_company_id</code>, variablën{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">DEV_DEFAULT_COMPANY_ID</code>, ose në development
          përdorni zgjedhësin më poshtë /{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">POST /api/dev/active-company</code>.
        </p>
        {isDev ? <DevActiveCompanyPicker /> : null}
      </div>
    );
  }

  const initialYear = new Date().getFullYear();
  try {
    const rows = await listPayrollsForCompany(companyId);
    return <PayrollsPageClient initialRows={rows} initialYear={initialYear} />;
  } catch (err) {
    console.error("[pagapro] PagatPage: listPayrollsForCompany failed", err);
    return (
      <div className="mx-auto max-w-xl space-y-4 py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pagat</h1>
        <p className="text-sm leading-relaxed text-destructive">
          Nuk mund të lexohen të dhënat e pagave nga databaza. Kontrolloni që PostgreSQL është aktiv dhe që migrimet
          janë aplikuar: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npx prisma migrate deploy</code>{" "}
          pastaj rifreskoni faqen.
        </p>
      </div>
    );
  }
}

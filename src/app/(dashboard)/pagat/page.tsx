import type { Metadata } from "next";
import { PayrollsPageClient } from "@/modules/payroll/components/payrolls-page-client";
import { listPayrollsForCompany } from "@/modules/payroll/services/payroll-period-service";
import { requireCompanyContextPage } from "@/server/company-context";

export const metadata: Metadata = {
  title: "Pagat",
};

export default async function PagatPage() {
  const { companyId } = await requireCompanyContextPage();

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

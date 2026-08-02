import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listContractorPayrollsForCompany } from "@/modules/payroll/contractor/contractor-payroll-service";
import { ContractorPayrollsPageClient } from "@/modules/payroll/contractor/components/contractor-payrolls-page-client";
import { requireCompanyContextPage } from "@/server/company-context";

export const metadata: Metadata = {
  title: "Pagat — Kontraktor",
};

export default async function ContractorPayrollsPage() {
  const { companyId } = await requireCompanyContextPage();

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { contractorPayrollEnabled: true },
  });
  if (!company?.contractorPayrollEnabled) redirect("/pagat");

  const rows = await listContractorPayrollsForCompany(companyId);
  return <ContractorPayrollsPageClient rows={rows} />;
}

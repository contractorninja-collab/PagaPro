import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  isContractorPayrollAvailable,
  listContractorPayrollsForCompany,
} from "@/modules/payroll/contractor/contractor-payroll-service";
import { ContractorPayrollsPageClient } from "@/modules/payroll/contractor/components/contractor-payrolls-page-client";
import { requireCompanyContextPage } from "@/server/company-context";

export const metadata: Metadata = {
  title: "Pagat — Kontraktor",
};

export default async function ContractorPayrollsPage() {
  const { companyId } = await requireCompanyContextPage();

  if (!(await isContractorPayrollAvailable(companyId))) redirect("/pagat");

  const rows = await listContractorPayrollsForCompany(companyId);
  return <ContractorPayrollsPageClient rows={rows} />;
}

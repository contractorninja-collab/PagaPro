import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  isContractorPayrollAvailable,
  listContractorPayrollsForCompany,
} from "@/modules/payroll/contractor/contractor-payroll-service";
import { ContractorPayrollsPageClient } from "@/modules/payroll/contractor/components/contractor-payrolls-page-client";
import { permissionSubjectOf, requireCompanyContextPage } from "@/server/company-context";
import { can } from "@/server/permissions";

export const metadata: Metadata = {
  title: "Pagat — Kontraktor",
};

export default async function ContractorPayrollsPage() {
  const context = await requireCompanyContextPage();
  const { companyId } = context;

  if (!(await isContractorPayrollAvailable(companyId))) redirect("/pagat");
  // Contractor payroll is amounts end to end — fee rates, gross, totals.
  // Without full salary visibility there is nothing here to show.
  if (!can(permissionSubjectOf(context), "salaries.full")) redirect("/pagat");


  const rows = await listContractorPayrollsForCompany(companyId);
  return <ContractorPayrollsPageClient rows={rows} />;
}

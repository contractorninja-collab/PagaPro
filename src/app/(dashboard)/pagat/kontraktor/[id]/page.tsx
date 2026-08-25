import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  isContractorPayrollAvailable, getContractorPayrollDetail
} from "@/modules/payroll/contractor/contractor-payroll-service";
import { ContractorPayrollDetailClient } from "@/modules/payroll/contractor/components/contractor-payroll-detail-client";
import { permissionSubjectOf, requireCompanyContextPage } from "@/server/company-context";
import { can } from "@/server/permissions";

export const metadata: Metadata = {
  title: "Pagat — Kontraktor",
};

export default async function ContractorPayrollDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const context = await requireCompanyContextPage();
  const { companyId } = context;

  if (!(await isContractorPayrollAvailable(companyId))) redirect("/pagat");
  // Contractor payroll is amounts end to end — fee rates, gross, totals.
  // Without full salary visibility there is nothing here to show.
  if (!can(permissionSubjectOf(context), "salaries.full")) redirect("/pagat");


  const { id } = await props.params;
  const detail = await getContractorPayrollDetail(companyId, id);
  if (!detail) notFound();

  return <ContractorPayrollDetailClient detail={detail} />;
}

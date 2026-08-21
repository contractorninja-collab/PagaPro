import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  isContractorPayrollAvailable, getContractorPayrollDetail
} from "@/modules/payroll/contractor/contractor-payroll-service";
import { ContractorPayrollDetailClient } from "@/modules/payroll/contractor/components/contractor-payroll-detail-client";
import { requireCompanyContextPage } from "@/server/company-context";

export const metadata: Metadata = {
  title: "Pagat — Kontraktor",
};

export default async function ContractorPayrollDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { companyId } = await requireCompanyContextPage();

  if (!(await isContractorPayrollAvailable(companyId))) redirect("/pagat");

  const { id } = await props.params;
  const detail = await getContractorPayrollDetail(companyId, id);
  if (!detail) notFound();

  return <ContractorPayrollDetailClient detail={detail} />;
}

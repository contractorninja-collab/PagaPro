import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PayrollDetailClient } from "@/modules/payroll/components/payroll-detail-client";
import { getPayrollDetailDto } from "@/modules/payroll/services/payroll-period-service";
import { resolveActiveCompanyId } from "@/server/company-scope";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  try {
    const { id } = await params;
    const companyId = await resolveActiveCompanyId();
    if (!companyId) return { title: "Pagat" };
    const data = await getPayrollDetailDto(companyId, id);
    return {
      title: data ? `${data.payroll.monthLabel} · Pagat` : "Pagat",
    };
  } catch {
    return { title: "Pagat" };
  }
}

export default async function PayrollDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const companyId = await resolveActiveCompanyId();
  if (!companyId) notFound();

  const { id } = await params;
  let data;
  try {
    data = await getPayrollDetailDto(companyId, id);
  } catch (err) {
    console.error("[pagapro] PayrollDetailPage: getPayrollDetailDto failed", err);
    return (
      <div className="mx-auto max-w-xl py-12">
        <p className="text-sm font-medium text-destructive">
          Nuk mund të ngarkohet ky payroll. Ekzekutoni migrimet{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npx prisma migrate deploy</code> dhe rifreskoni, ose
          kontrolloni log-et e serverit.
        </p>
      </div>
    );
  }
  if (!data) notFound();

  return <PayrollDetailClient data={data} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LargimetDetailClient } from "@/modules/terminations/components/largimet-detail-client";
import { getTerminationDetailBundle } from "@/modules/terminations/services/termination-queries";
import { requireCompanyContextPage } from "@/server/company-context";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Largim ${id.slice(0, 8)}…` };
}

export default async function LargimetDetailPage({ params }: Props) {
  const { companyId } = await requireCompanyContextPage();
  const { id } = await params;

  let bundle;
  try {
    bundle = await getTerminationDetailBundle(companyId, id);
  } catch (err) {
    console.error("[pagapro] LargimetDetailPage load failed", err);
    return (
      <div className="mx-auto max-w-xl py-12">
        <p className="text-sm text-destructive">Gabim gjatë ngarkimit.</p>
      </div>
    );
  }

  if (!bundle) notFound();

  const plain = JSON.parse(JSON.stringify(bundle)) as {
    termination: unknown;
    artifacts: unknown;
    payrollEntry: unknown;
    timeline: unknown;
    activities: unknown;
    audits: unknown;
  };

  return (
    <LargimetDetailClient
      termination={plain.termination as never}
      artifacts={plain.artifacts as never}
      payrollEntry={plain.payrollEntry as never}
      timeline={plain.timeline as never}
      activities={plain.activities as never}
      audits={plain.audits as never}
    />
  );
}

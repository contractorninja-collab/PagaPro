import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LargimetDetailClient } from "@/modules/terminations/components/largimet-detail-client";
import { getTerminationDetailBundle } from "@/modules/terminations/services/termination-queries";
import { resolveActiveCompanyId } from "@/server/company-scope";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Largim ${id.slice(0, 8)}…` };
}

export default async function LargimetDetailPage({ params }: Props) {
  const companyId = await resolveActiveCompanyId();
  const { id } = await params;

  if (!companyId) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <p className="text-sm text-muted-foreground">Nuk ka kompani aktive.</p>
      </div>
    );
  }

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
    checklists: unknown;
    artifacts: unknown;
    payrollEntry: unknown;
    timeline: unknown;
    activities: unknown;
    audits: unknown;
  };

  return (
    <LargimetDetailClient
      termination={plain.termination as never}
      checklists={plain.checklists as never}
      artifacts={plain.artifacts as never}
      payrollEntry={plain.payrollEntry as never}
      timeline={plain.timeline as never}
      activities={plain.activities as never}
      audits={plain.audits as never}
    />
  );
}

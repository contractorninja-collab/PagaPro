import type { LucideIcon } from "lucide-react";
import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/patterns/empty-state";
import { PageHeader } from "@/components/patterns/page-header";

export function ModulePlaceholder({
  title,
  description,
  icon: Icon = FileQuestion,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="space-y-8">
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={Icon}
        title="Moduli në përgatitje"
        description="Rruga dhe përmasat e faqes janë gati — logjika biznesi lidhet më vonë."
      />
    </div>
  );
}

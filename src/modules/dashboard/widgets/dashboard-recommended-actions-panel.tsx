import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PanelHeader } from "@/components/patterns/page-header";
import type { RecommendedAction } from "../types/dashboard-types";

export function DashboardRecommendedActionsPanel(props: {
  actions: RecommendedAction[];
  periodLabel: string;
}) {
  const { actions, periodLabel } = props;

  return (
    <div className="surface-card flex h-full flex-col">
      <PanelHeader
        title="Veprimet e rekomanduara"
        description={`Hapat e radhës për ${periodLabel}.`}
      />

      {actions.length === 0 ? (
        <p className="surface-card-body text-sm text-muted-foreground">
          Nuk ka veprime të rekomanduara për momentin — vazhdoni monitorimin e panelit.
        </p>
      ) : (
        <ol className="surface-card-body space-y-3">
          {actions.map((action, index) => (
            <li key={action.id}>
              <Link
                href={action.href}
                className="group flex items-start gap-3 rounded-lg px-1 py-1 transition-colors hover:bg-[#f8fafc]"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-xs font-bold text-[#475569]"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 pt-0.5 text-sm font-semibold leading-snug text-foreground group-hover:text-[#0f172a]">
                  {action.label}
                </span>
                <ArrowRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function DashboardRecommendedActionsSkeleton() {
  return (
    <div className="surface-card min-h-[220px] p-5">
      <div className="mb-4 space-y-2">
        <div className="h-4 w-40 rounded bg-muted" />
        <div className="h-3 w-52 rounded bg-muted" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-6 w-6 rounded-full bg-muted" />
            <div className="h-4 flex-1 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

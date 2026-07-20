"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { ReportExportAction, ReportType } from "@prisma/client";
import { AppSubBar, SubBarStatus } from "@/components/layout/app-sub-bar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  archiveReportAction,
  regenerateReportAction,
} from "@/modules/reports/actions/report-actions";

type LogRow = {
  id: string;
  action: ReportExportAction;
  performedAt: string;
  performer: string | null;
};

/** Tiny format chip — XLSX green tone, CSV slate, PDF red (per handoff 7a). */
function FormatChip({ fmt }: { fmt: string }) {
  const tone =
    fmt === "XLSX"
      ? "bg-[#ecfdf5] text-[#15803d]"
      : fmt === "PDF"
        ? "bg-[#fef2f2] text-[#dc2626]"
        : "bg-[#f1f5f9] text-[#475569]";
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded px-[5px] py-[2px] text-[9px] font-bold leading-none",
        tone,
      )}
    >
      {fmt}
    </span>
  );
}

const cardCls =
  "overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]";
const cardHeadCls = "border-b border-[#eef2f7] px-5 py-3.5 text-[13px] font-bold text-[#0f172a]";
const thCls =
  "whitespace-nowrap border-b border-[#eef2f7] bg-[#f8fafc] px-3.5 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.04em] text-[#94a3b8]";

export function RaportetDetailClient(props: {
  id: string;
  title: string;
  reportType: ReportType;
  categoryLabel: string;
  fileFormat: string;
  generatedAt: string;
  isArchived: boolean;
  filtersJson: unknown;
  generatedByDisplay: string | null;
  previewColumns: { key: string; headerSq: string }[];
  previewRows: Record<string, unknown>[];
  previewTruncated: boolean;
  logs: LogRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <>
      <AppSubBar
        dense
        backHref="/raportet"
        backLabel="Raportet"
        title={props.title}
        status={
          <SubBarStatus tone={props.isArchived ? "neutral" : "success"}>
            {props.isArchived ? "Arkivuar" : "Aktiv"}
          </SubBarStatus>
        }
        description={
          <>
            {props.categoryLabel} · Gjeneruar më {props.generatedAt}
            {props.generatedByDisplay ? ` · ${props.generatedByDisplay}` : ""} · Formati {props.fileFormat}
          </>
        }
        actions={
          <>
            <Button
              asChild
              variant="secondary"
              className="h-10 rounded-[10px] border-[#e2e8f0] bg-white px-4 text-[13.5px] font-semibold text-[#334155] hover:bg-[#eef2f7]"
            >
              <a href={`/api/reports/files/${props.id}`}>Shkarko</a>
            </Button>
            <Button
              disabled={pending || props.isArchived}
              onClick={() =>
                startTransition(async () => {
                  const res = await regenerateReportAction({ previousReportId: props.id });
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success("Raport i ri u krijua.");
                  router.refresh();
                  if (res.data?.id) router.push(`/raportet/${res.data.id}`);
                })
              }
              className="h-10 rounded-[10px] bg-brand-blue px-[18px] text-[13.5px] font-semibold text-white hover:bg-[#1d4ed8]"
            >
              Rigjenero
            </Button>
            <Button
              variant="secondary"
              disabled={pending || props.isArchived}
              onClick={() =>
                startTransition(async () => {
                  const res = await archiveReportAction({ id: props.id });
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success("U arkivua.");
                  router.refresh();
                })
              }
              className="h-10 rounded-[10px] border-[#fee2e2] bg-white px-4 text-[13.5px] font-semibold text-[#dc2626] hover:bg-[#fef2f2] hover:text-[#dc2626]"
            >
              Arkivo
            </Button>
          </>
        }
      />

      <div className="space-y-5 pb-24 md:pb-10">
        {/* Preview */}
        <section className={cardCls}>
          <div className={cn(cardHeadCls, "flex flex-wrap items-center gap-2")}>
            <span>Paraafishim</span>
            <FormatChip fmt={props.fileFormat} />
            {props.previewTruncated ? (
              <span className="ml-auto text-[11.5px] font-normal normal-case text-[#94a3b8]">
                Shfaqen rreshtat e parë · eksporti përfshin të gjitha
              </span>
            ) : null}
          </div>
          <div className="max-h-[440px] overflow-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10">
                <tr>
                  {props.previewColumns.map((c) => (
                    <th key={c.key} className={thCls}>
                      {c.headerSq}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {props.previewRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={Math.max(props.previewColumns.length, 1)}
                      className="px-3.5 py-8 text-center text-[12.5px] text-[#94a3b8]"
                    >
                      Nuk ka rreshta për t’u shfaqur.
                    </td>
                  </tr>
                ) : (
                  props.previewRows.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-[#f1f5f9] transition-colors last:border-b-0 hover:bg-[#f8fafc]"
                    >
                      {props.previewColumns.map((c) => (
                        <td
                          key={c.key}
                          className="whitespace-nowrap px-3.5 py-[9px] text-[12.5px] tabular-nums text-[#334155]"
                        >
                          {String(row[c.key] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-[1fr_380px]">
          {/* Activity history */}
          <section className={cardCls}>
            <h2 className={cardHeadCls}>Historia e aktivitetit</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left">
                <thead>
                  <tr>
                    <th className={thCls}>Veprimi</th>
                    <th className={thCls}>Nga</th>
                    <th className={thCls}>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {props.logs.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3.5 py-8 text-center text-[12.5px] text-[#94a3b8]">
                        Nuk ka hyra ende.
                      </td>
                    </tr>
                  ) : (
                    props.logs.map((l) => (
                      <tr
                        key={l.id}
                        className="border-b border-[#f1f5f9] transition-colors last:border-b-0 hover:bg-[#f8fafc]"
                      >
                        <td className="px-3.5 py-2.5 text-[12.5px] font-semibold text-[#0f172a]">
                          {l.action}
                        </td>
                        <td className="px-3.5 py-2.5 text-[12.5px] text-[#334155]">
                          {l.performer ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-2.5 text-xs tabular-nums text-[#64748b]">
                          {new Date(l.performedAt).toLocaleString("sq")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Applied filters */}
          <section className={cardCls}>
            <h2 className={cardHeadCls}>Filtrat e aplikuara</h2>
            <div className="p-4">
              <pre className="max-h-48 overflow-auto rounded-lg bg-[#f8fafc] p-3 text-xs leading-relaxed text-[#334155]">
                {JSON.stringify(props.filtersJson, null, 2)}
              </pre>
            </div>
          </section>
        </div>

        {/* mobile action bar */}
        <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-[#e2e8f0] bg-white/95 p-3 backdrop-blur md:hidden">
          <Button
            asChild
            variant="secondary"
            className="h-10 flex-1 rounded-[10px] border-[#e2e8f0] bg-white text-[13.5px] font-semibold text-[#334155] hover:bg-[#eef2f7]"
          >
            <a href={`/api/reports/files/${props.id}`}>Shkarko</a>
          </Button>
          <Button
            className="h-10 flex-1 rounded-[10px] bg-brand-blue text-[13.5px] font-semibold text-white hover:bg-[#1d4ed8]"
            disabled={pending || props.isArchived}
            onClick={() =>
              startTransition(async () => {
                const res = await regenerateReportAction({ previousReportId: props.id });
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                toast.success("Raport i ri u krijua.");
                router.refresh();
                if (res.data?.id) router.push(`/raportet/${res.data.id}`);
              })
            }
          >
            Rigjenero
          </Button>
        </div>
      </div>
    </>
  );
}

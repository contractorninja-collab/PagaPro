"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { ReportExportAction, ReportType } from "@prisma/client";
import { Button } from "@/components/ui/button";
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
    <div className="mx-auto max-w-6xl space-y-8 pb-24">
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{props.categoryLabel}</p>
          <h1 className="mt-1 text-2xl font-semibold">{props.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gjeneruar më {props.generatedAt}
            {props.generatedByDisplay ? ` · ${props.generatedByDisplay}` : ""}
          </p>
          <p className="mt-1 text-sm">
            Formati: <span className="font-medium">{props.fileFormat}</span> · Statusi:{" "}
            <span className="font-medium">{props.isArchived ? "Arkivuar" : "Aktiv"}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outlinePrimary">
            <Link href="/raportet">Kthehu</Link>
          </Button>
          <Button asChild variant="outlinePrimary">
            <a href={`/api/reports/files/${props.id}`}>Shkarko</a>
          </Button>
          <Button
            variant="outlinePrimary"
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
          <Button
            variant="destructive"
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
          >
            Arkivo
          </Button>
        </div>
      </div>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Filtrat e aplikuara</h2>
        <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted/40 p-3 text-xs">
          {JSON.stringify(props.filtersJson, null, 2)}
        </pre>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Paraafishim</h2>
        {props.previewTruncated ? (
          <p className="mt-1 text-xs text-muted-foreground">Shfaqen rreshtat e para (truncated).</p>
        ) : null}
        <div className="mt-3 max-h-[420px] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-muted">
              <tr>
                {props.previewColumns.map((c) => (
                  <th key={c.key} className="whitespace-nowrap px-2 py-2 font-medium">
                    {c.headerSq}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.previewRows.map((row, i) => (
                <tr key={i} className="border-t border-border">
                  {props.previewColumns.map((c) => (
                    <td key={c.key} className="px-2 py-1">
                      {String(row[c.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Historia e aktivitetit</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-2 py-2 text-left">Veprimi</th>
                <th className="px-2 py-2 text-left">Nga</th>
                <th className="px-2 py-2 text-left">Data</th>
              </tr>
            </thead>
            <tbody>
              {props.logs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-2 py-6 text-center text-muted-foreground">
                    Nuk ka hyra ende.
                  </td>
                </tr>
              ) : (
                props.logs.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-2 py-2">{l.action}</td>
                    <td className="px-2 py-2">{l.performer ?? "—"}</td>
                    <td className="px-2 py-2">{new Date(l.performedAt).toLocaleString("sq")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
        <Button asChild className="flex-1" variant="outlinePrimary">
          <a href={`/api/reports/files/${props.id}`}>Shkarko</a>
        </Button>
        <Button
          className="flex-1"
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
  );
}

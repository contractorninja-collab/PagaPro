"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import type { DocumentCategory } from "@prisma/client";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  Download,
  FileSignature,
  FileText,
  Printer,
  UserMinus,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DOCUMENT_CATEGORY_LABELS,
  formatArtifactKind,
} from "@/modules/documents/components/document-labels";
import {
  DocChip,
  type DocChipTone,
  docBtnPrimaryDense,
  docBtnSecondaryDense,
  docCard,
  docTableCell,
  docTableHead,
} from "@/modules/documents/components/doc-ui";
import { openBulkPrintPreview } from "@/modules/documents/components/open-bulk-print-preview";
import type { DocumentRegisterCounts } from "@/modules/documents/services/document-queries";

export interface ArtifactRow {
  id: string;
  title: string;
  displayFilename: string;
  documentCategory: DocumentCategory;
  kind: string;
  generationStatus: string;
  createdAt: string;
  /** Pre-formatted on the server — avoids client locale hydration mismatches. */
  createdAtLabel: string;
  isArchived: boolean;
  employeeLabel: string | null;
  templateName: string;
  authorLabel: string | null;
  hasPdf: boolean;
}

export interface SubjectOption {
  id: string;
  label: string;
}

export interface DocumentsDashboardClientProps {
  artifacts: ArtifactRow[];
  counts: DocumentRegisterCounts;
  page: { page: number; pageCount: number; total: number; pageSize: number };
  filtersActive: boolean;
  templateSummary: {
    total: number;
    ready: number;
    needsMapping: number;
    missingPublished: number;
  };
  /** Filter toolbar (server-rendered GET form) — still works without JavaScript. */
  filtersSlot?: ReactNode;
  /** Issuing vërejtje is an action, not a view, so it lives in a dialog. */
  warningsSlot?: ReactNode;
}

/** Caps enforced by the bulk endpoints; the UI says so before the click. */
const PRINT_CAP = 100;
const BUNDLE_CAP = 200;

const CATEGORY_CHIP_TONES: Record<DocumentCategory, DocChipTone> = {
  CONTRACT: "info",
  LEAVE: "success",
  TERMINATION: "destructive",
  WARNING: "warning",
  PAYROLL: "neutral",
  OTHER: "neutral",
};

function CategoryChip({ category }: { category: DocumentCategory }) {
  return (
    <DocChip tone={CATEGORY_CHIP_TONES[category]}>{DOCUMENT_CATEGORY_LABELS[category]}</DocChip>
  );
}

function KindChip({ kind }: { kind: string }) {
  return (
    <DocChip tone={kind === "PREVIEW" ? "warning" : "success"} className="uppercase tracking-[0.03em]">
      {formatArtifactKind(kind)}
    </DocChip>
  );
}

const QUICK_START: Array<{
  category: DocumentCategory;
  icon: typeof FileSignature;
  tile: string;
  iconColor: string;
  /**
   * Warnings are cases, not templates: the generator lists warnings that already
   * exist, so this tile opens the dialog that issues one instead of a step that
   * would be empty for anyone starting out.
   */
  opensWarningDialog?: boolean;
}> = [
  { category: "CONTRACT", icon: FileSignature, tile: "bg-[#eff6ff]", iconColor: "text-brand-blue" },
  { category: "LEAVE", icon: CalendarDays, tile: "bg-[#ecfdf5]", iconColor: "text-[#15803d]" },
  { category: "TERMINATION", icon: UserMinus, tile: "bg-[#fef2f2]", iconColor: "text-[#dc2626]" },
  {
    category: "WARNING",
    icon: AlertTriangle,
    tile: "bg-[#fffbeb]",
    iconColor: "text-[#b45309]",
    opensWarningDialog: true,
  },
];

export function DocumentsDashboardClient(props: DocumentsDashboardClientProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [warningOpen, setWarningOpen] = useState(false);

  const ids = useMemo(() => props.artifacts.map((a) => a.id), [props.artifacts]);
  const allOnPageSelected = ids.length > 0 && ids.every((id) => selected.has(id));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) for (const id of ids) next.delete(id);
      else for (const id of ids) next.add(id);
      return next;
    });
  };

  const selectedIds = [...selected];
  const count = selectedIds.length;

  const pageHref = (page: number) => {
    if (typeof window === "undefined") return `?page=${page}`;
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(page));
    return `?${params.toString()}`;
  };

  return (
    <div className="space-y-5">
      {/* Quick-start category tiles — counts are company-wide for the month. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_START.map(({ category, icon: Icon, tile, iconColor, opensWarningDialog }) => {
          const inner = (
            <>
              <span
                className={cn(
                  "flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px]",
                  tile,
                )}
              >
                <Icon className={cn("h-[18px] w-[18px]", iconColor)} aria-hidden />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-[13.5px] font-semibold text-[#0f172a]">
                  {DOCUMENT_CATEGORY_LABELS[category]}
                </span>
                <span className="block text-[12px] text-[#94a3b8]">
                  {props.counts.monthByCategory[category]} këtë muaj
                </span>
              </span>
              {/* The arrow only appears where the tile actually navigates. */}
              {opensWarningDialog ? null : (
                <ArrowUpRight
                  className="h-4 w-4 shrink-0 text-[#cbd5e1] transition-colors group-hover:text-brand-blue"
                  aria-hidden
                />
              )}
            </>
          );
          const shell = cn(
            docCard,
            "group flex w-full items-center gap-3.5 p-4 transition-colors hover:border-[#bfdbfe]",
          );

          return opensWarningDialog ? (
            <button
              key={category}
              type="button"
              className={shell}
              onClick={() => setWarningOpen(true)}
            >
              {inner}
            </button>
          ) : (
            <Link key={category} href={`/dokumentet/generate?category=${category}`} className={shell}>
              {inner}
            </Link>
          );
        })}
      </div>

      {/* Template health. The link to manage them lives in the sub-bar; this
          strip reports state rather than offering a second door to it. */}
      <div className={cn(docCard, "flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3")}>
        <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-[#94a3b8]">
          Shabllonet ({props.templateSummary.total})
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] font-medium text-[#334155]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#16a34a]" aria-hidden />
            {props.templateSummary.ready} gati
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#d97706]" aria-hidden />
            {props.templateSummary.needsMapping} pa mapim
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#94a3b8]" aria-hidden />
            {props.templateSummary.missingPublished} pa publikim
          </span>
        </div>
        {props.counts.failed > 0 ? (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#fef2f2] px-2.5 py-1 text-[12px] font-semibold text-[#b91c1c]">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            {props.counts.failed} gjenerime të dështuara
          </span>
        ) : null}
      </div>

      {props.filtersSlot}

      {/* Bulk toolbar — only present when there is a selection to act on. */}
      {count > 0 ? (
        <div className="sticky top-2 z-30 flex flex-wrap items-center gap-2 rounded-[11px] border border-[#bfdbfe] bg-[#eff6ff] px-4 py-2.5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <span className="text-[13px] font-semibold text-[#1e40af]">
            {count} të zgjedhura
          </span>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-[12.5px] font-medium text-[#1e40af] underline-offset-2 hover:underline"
          >
            Pastro zgjedhjen
          </button>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Plain GET — the HTML print sheet, one page per document. */}
            <a
              className={cn(
                docBtnSecondaryDense,
                count > PRINT_CAP && "pointer-events-none opacity-50",
              )}
              href={`/api/dokumentet/print?ids=${encodeURIComponent(selectedIds.join(","))}`}
              target="_blank"
              rel="noreferrer"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden />
              Parapamje &amp; printo
            </a>

            {/* Merged PDF, falling back to the print sheet when the deployment
                has no DOCX→PDF converter. */}
            <button
              type="button"
              className={cn(
                docBtnSecondaryDense,
                count > BUNDLE_CAP && "pointer-events-none opacity-50",
              )}
              onClick={async () => {
                const res = await openBulkPrintPreview(selectedIds);
                if (!res.ok) toast.error(res.error);
              }}
            >
              <FileText className="h-3.5 w-3.5" aria-hidden />
              PDF të bashkuar
            </button>

            {/* The ZIP endpoint is POST-only, so this is a real form submit —
                which also gives a native download rather than a blob dance. */}
            <form
              method="post"
              action="/api/dokumentet/contracts/bulk-pdf"
              className="contents"
            >
              <input type="hidden" name="artifactIds" value={selectedIds.join(",")} />
              <button
                type="submit"
                className={docBtnPrimaryDense}
                disabled={count > BUNDLE_CAP}
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Shkarko ZIP
              </button>
            </form>
          </div>

          {count > PRINT_CAP ? (
            <p className="w-full text-[12px] text-[#1e40af]">
              Printimi mbulon deri në {PRINT_CAP} dokumente dhe shkarkimi deri në {BUNDLE_CAP}.
              Ngushtoni zgjedhjen për të vazhduar.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Register — mobile cards */}
      <div className="space-y-3 md:hidden">
        {props.artifacts.length === 0 ? (
          <EmptyRegister filtersActive={props.filtersActive} />
        ) : (
          props.artifacts.map((a) => (
            <Link key={a.id} href={`/dokumentet/${a.id}`} className={cn(docCard, "block p-4")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-[#0f172a]">{a.title}</p>
                  <p className="mt-0.5 truncate text-[12px] text-[#94a3b8]">{a.displayFilename}</p>
                </div>
                <CategoryChip category={a.documentCategory} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <KindChip kind={a.kind} />
                {a.generationStatus === "FAILED" ? (
                  <DocChip tone="destructive">Dështoi</DocChip>
                ) : null}
                {a.isArchived ? <DocChip tone="locked">Arkiv</DocChip> : null}
                {a.employeeLabel ? (
                  <span className="text-[12px] text-[#64748b]">{a.employeeLabel}</span>
                ) : null}
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Register — desktop table */}
      <div className={cn(docCard, "hidden overflow-hidden md:block")}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eef2f7] px-4 py-3">
          <h2 className="text-[13.5px] font-bold text-[#0f172a]">Regjistri i dokumenteve</h2>
          <p className="text-[12px] text-[#94a3b8]">
            {props.counts.total} gjithsej · {props.counts.final} finale ·{" "}
            {props.counts.preview} parapamje · {props.counts.archived} në arkiv
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#eef2f7] bg-[#f8fafc]">
                <th className={cn(docTableHead, "w-10")}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#2563EB]"
                    checked={allOnPageSelected}
                    onChange={toggleAllOnPage}
                    aria-label="Zgjidh të gjitha në këtë faqe"
                    disabled={ids.length === 0}
                  />
                </th>
                <th className={docTableHead}>Dokumenti</th>
                <th className={docTableHead}>Kategoria</th>
                <th className={docTableHead}>Shablloni</th>
                <th className={docTableHead}>Punonjësi</th>
                <th className={docTableHead}>Gjeneruar</th>
                <th className={cn(docTableHead, "text-right")}>Veprime</th>
              </tr>
            </thead>
            <tbody>
              {props.artifacts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10">
                    <EmptyRegister filtersActive={props.filtersActive} bare />
                  </td>
                </tr>
              ) : (
                props.artifacts.map((a) => (
                  <tr
                    key={a.id}
                    className={cn(
                      "border-b border-[#f1f5f9] transition-colors last:border-0 hover:bg-[#f8fafc]",
                      selected.has(a.id) && "bg-[#f5f8ff]",
                    )}
                  >
                    <td className={docTableCell}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#2563EB]"
                        checked={selected.has(a.id)}
                        onChange={() => toggle(a.id)}
                        aria-label={`Zgjidh ${a.title}`}
                      />
                    </td>
                    <td className={docTableCell}>
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/dokumentet/${a.id}`}
                            className="text-[13.5px] font-semibold text-[#0f172a] hover:text-brand-blue"
                          >
                            {a.title}
                          </Link>
                          <KindChip kind={a.kind} />
                          {a.generationStatus === "FAILED" ? (
                            <DocChip tone="destructive">Dështoi</DocChip>
                          ) : null}
                          {a.isArchived ? <DocChip tone="locked">Arkiv</DocChip> : null}
                        </div>
                        <span className="text-[12px] text-[#94a3b8]">{a.displayFilename}</span>
                      </div>
                    </td>
                    <td className={docTableCell}>
                      <CategoryChip category={a.documentCategory} />
                    </td>
                    <td className={cn(docTableCell, "text-[13px] text-[#334155]")}>
                      {a.templateName}
                    </td>
                    <td className={cn(docTableCell, "text-[13px] text-[#334155]")}>
                      {a.employeeLabel ?? "—"}
                    </td>
                    <td className={cn(docTableCell, "whitespace-nowrap")}>
                      <span className="block text-[12.5px] tabular-nums text-[#64748b]">
                        {a.createdAtLabel}
                      </span>
                      {a.authorLabel ? (
                        <span className="mt-0.5 block text-[11.5px] text-[#94a3b8]">
                          {a.authorLabel}
                        </span>
                      ) : null}
                    </td>
                    <td className={cn(docTableCell, "text-right")}>
                      {/* The title already opens the document; this is the download
                          the list never offered, though hasPdf was always here. */}
                      <a
                        className={docBtnSecondaryDense}
                        href={`/api/dokumentet/artifacts/${a.id}/${a.hasPdf ? "pdf" : "docx"}`}
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden />
                        {a.hasPdf ? "PDF" : "DOCX"}
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {props.page.pageCount > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eef2f7] px-4 py-3">
            <p className="text-[12px] text-[#94a3b8]">
              Faqja {props.page.page} nga {props.page.pageCount} · {props.page.total} dokumente
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={pageHref(Math.max(1, props.page.page - 1))}
                aria-disabled={props.page.page <= 1}
                className={cn(
                  docBtnSecondaryDense,
                  props.page.page <= 1 && "pointer-events-none opacity-50",
                )}
              >
                E mëparshmja
              </Link>
              <Link
                href={pageHref(Math.min(props.page.pageCount, props.page.page + 1))}
                aria-disabled={props.page.page >= props.page.pageCount}
                className={cn(
                  docBtnSecondaryDense,
                  props.page.page >= props.page.pageCount && "pointer-events-none opacity-50",
                )}
              >
                Tjetra
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={warningOpen} onOpenChange={setWarningOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Lësho vërejtje</DialogTitle>
            <DialogDescription>
              Zgjidhni punonjësit, masën sipas nenit 85 dhe përshkrimin e shkeljes.
            </DialogDescription>
          </DialogHeader>
          {props.warningsSlot}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * An empty register means one of two very different things, and the old copy
 * said "for the active filters" even to a company that had never generated
 * anything.
 */
function EmptyRegister({ filtersActive, bare }: { filtersActive: boolean; bare?: boolean }) {
  const body = (
    <div className="text-center">
      <FileText className="mx-auto h-6 w-6 text-[#cbd5e1]" aria-hidden />
      <p className="mt-3 text-[13.5px] font-semibold text-[#0f172a]">
        {filtersActive ? "Nuk ka dokumente për filtrat aktualë." : "Ende asnjë dokument."}
      </p>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] text-[#64748b]">
        {filtersActive
          ? "Ndryshoni kriteret ose pastroni filtrat."
          : "Gjeneroni kontratën, pushimin ose largimin e parë dhe do të shfaqet këtu."}
      </p>
      {filtersActive ? null : (
        <Link href="/dokumentet/generate" className={cn(docBtnPrimaryDense, "mt-4")}>
          Gjenero dokumente
        </Link>
      )}
    </div>
  );

  if (bare) return body;
  return <div className={cn(docCard, "p-6")}>{body}</div>;
}

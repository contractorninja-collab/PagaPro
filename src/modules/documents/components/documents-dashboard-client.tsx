"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import type { DocumentCategory } from "@prisma/client";
import {
  AlertTriangle,
  ArrowUpRight,
  Download,
  Eye,
  File as FileIcon,
  FileSignature,
  FileText,
  CalendarDays,
  Printer,
  UserMinus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
import { DocumentPreviewSheet } from "@/modules/documents/components/document-preview-sheet";
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

/** Format identity at a glance — PDF vs DOCX, colored the way each is recognized elsewhere. */
function FileFormatIcon({ hasPdf }: { hasPdf: boolean }) {
  return (
    <FileText
      className={cn("h-4 w-4 shrink-0", hasPdf ? "text-[#dc2626]" : "text-brand-blue")}
      aria-hidden
    />
  );
}

const CATEGORY_ORDER: DocumentCategory[] = [
  "CONTRACT",
  "LEAVE",
  "TERMINATION",
  "WARNING",
  "PAYROLL",
  "OTHER",
];

const CATEGORY_TILE_META: Record<DocumentCategory, { icon: LucideIcon; tile: string; iconColor: string }> = {
  CONTRACT: { icon: FileSignature, tile: "bg-[#eff6ff]", iconColor: "text-brand-blue" },
  LEAVE: { icon: CalendarDays, tile: "bg-[#ecfdf5]", iconColor: "text-[#15803d]" },
  TERMINATION: { icon: UserMinus, tile: "bg-[#fef2f2]", iconColor: "text-[#dc2626]" },
  WARNING: { icon: AlertTriangle, tile: "bg-[#fffbeb]", iconColor: "text-[#b45309]" },
  PAYROLL: { icon: Wallet, tile: "bg-[#f5f3ff]", iconColor: "text-[#7c3aed]" },
  OTHER: { icon: FileIcon, tile: "bg-[#f1f5f9]", iconColor: "text-[#64748b]" },
};

export function DocumentsDashboardClient(props: DocumentsDashboardClientProps) {
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mobileSelectMode, setMobileSelectMode] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const ids = useMemo(() => props.artifacts.map((a) => a.id), [props.artifacts]);
  const allOnPageSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const previewArtifact = props.artifacts.find((a) => a.id === previewId) ?? null;

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

  const activeCategory = searchParams.get("documentCategory") ?? "";

  /** Clicking an already-active tile clears it — a filter toggle, not a one-way door. */
  function categoryHref(category: DocumentCategory): string {
    const params = new URLSearchParams(searchParams.toString());
    if (activeCategory === category) params.delete("documentCategory");
    else params.set("documentCategory", category);
    params.delete("page");
    const qs = params.toString();
    return qs ? `/dokumentet?${qs}` : "/dokumentet";
  }

  const templateNeedsAttention =
    props.templateSummary.needsMapping > 0 ||
    props.templateSummary.missingPublished > 0 ||
    props.counts.failed > 0;

  return (
    <div className="space-y-5">
      {/* Category tiles — company-wide monthly counts, and also filters: click one
          to see that category, click again to clear it. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {CATEGORY_ORDER.map((category) => {
          const meta = CATEGORY_TILE_META[category];
          const Icon = meta.icon;
          const isActive = activeCategory === category;
          return (
            <Link
              key={category}
              href={categoryHref(category)}
              className={cn(
                docCard,
                "flex items-center gap-2.5 p-3.5 transition-colors hover:border-[#bfdbfe]",
                isActive && "border-brand-blue bg-[#f5f8ff] ring-1 ring-brand-blue",
              )}
            >
              <span
                className={cn(
                  "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]",
                  meta.tile,
                )}
              >
                <Icon className={cn("h-4 w-4", meta.iconColor)} aria-hidden />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[12.5px] font-semibold text-[#0f172a]">
                  {DOCUMENT_CATEGORY_LABELS[category]}
                </span>
                <span className="block text-[11px] text-[#94a3b8]">
                  {props.counts.monthByCategory[category]} këtë muaj
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      {/* Template health — only shown when something actually needs attention. */}
      {templateNeedsAttention ? (
        <Link
          href="/dokumentet/templates"
          className={cn(
            docCard,
            "flex flex-wrap items-center gap-x-3 gap-y-1.5 border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-[13px] transition-colors hover:border-[#fcd34d]",
          )}
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-[#b45309]" aria-hidden />
          <span className="font-semibold text-[#78350f]">Shabllonet kërkojnë vëmendje:</span>
          <span className="text-[#92400e]">
            {[
              props.templateSummary.needsMapping > 0
                ? `${props.templateSummary.needsMapping} pa mapim`
                : null,
              props.templateSummary.missingPublished > 0
                ? `${props.templateSummary.missingPublished} pa publikim`
                : null,
              props.counts.failed > 0 ? `${props.counts.failed} gjenerime të dështuara` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-[#b45309]" aria-hidden />
        </Link>
      ) : null}

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
        {props.artifacts.length > 0 ? (
          <div className="flex items-center justify-end">
            <button
              type="button"
              className={cn(
                docBtnSecondaryDense,
                mobileSelectMode && "border-brand-blue text-brand-blue",
              )}
              onClick={() => {
                setMobileSelectMode((v) => !v);
                if (mobileSelectMode) setSelected(new Set());
              }}
            >
              {mobileSelectMode ? "Anulo zgjedhjen" : "Zgjidh"}
            </button>
          </div>
        ) : null}

        {props.artifacts.length === 0 ? (
          <EmptyRegister filtersActive={props.filtersActive} />
        ) : (
          props.artifacts.map((a) => {
            const isSelected = selected.has(a.id);
            return (
              <div
                key={a.id}
                role={mobileSelectMode ? "button" : undefined}
                tabIndex={mobileSelectMode ? 0 : undefined}
                onClick={mobileSelectMode ? () => toggle(a.id) : undefined}
                onKeyDown={
                  mobileSelectMode
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggle(a.id);
                        }
                      }
                    : undefined
                }
                className={cn(
                  docCard,
                  "p-4",
                  mobileSelectMode && "cursor-pointer",
                  isSelected && "border-brand-blue bg-[#f5f8ff]",
                )}
              >
                <div className="flex items-start gap-2.5">
                  {mobileSelectMode ? (
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[#2563EB]"
                      checked={isSelected}
                      onChange={() => toggle(a.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Zgjidh ${a.title}`}
                    />
                  ) : (
                    <FileFormatIcon hasPdf={a.hasPdf} />
                  )}
                  <div className="min-w-0 flex-1">
                    {mobileSelectMode ? (
                      <p className="truncate text-[13.5px] font-semibold text-[#0f172a]">{a.title}</p>
                    ) : (
                      <Link
                        href={`/dokumentet/${a.id}`}
                        className="block truncate text-[13.5px] font-semibold text-[#0f172a]"
                      >
                        {a.title}
                      </Link>
                    )}
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
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#eef2f7] pt-3">
                  <div className="min-w-0">
                    <span className="block text-[11.5px] tabular-nums text-[#64748b]">
                      {a.createdAtLabel}
                    </span>
                    {a.authorLabel ? (
                      <span className="block text-[11px] text-[#94a3b8]">{a.authorLabel}</span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      className={docBtnSecondaryDense}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewId(a.id);
                      }}
                      aria-label={`Shiko ${a.title}`}
                      title="Shiko"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <a
                      className={docBtnSecondaryDense}
                      href={`/api/dokumentet/artifacts/${a.id}/${a.hasPdf ? "pdf" : "docx"}`}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Shkarko"
                      title="Shkarko"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  </div>
                </div>
              </div>
            );
          })
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
          <table className="w-full min-w-[820px] border-collapse text-left">
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
                <th className={docTableHead}>Punonjësi</th>
                <th className={docTableHead}>Gjeneruar</th>
                <th className={cn(docTableHead, "text-right")}>Veprime</th>
              </tr>
            </thead>
            <tbody>
              {props.artifacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10">
                    <EmptyRegister filtersActive={props.filtersActive} bare />
                  </td>
                </tr>
              ) : (
                props.artifacts.map((a) => {
                  const templateDiffersFromTitle = a.templateName.trim() !== a.title.trim();
                  return (
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
                        <div className="flex items-start gap-2.5">
                          <FileFormatIcon hasPdf={a.hasPdf} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Link
                                href={`/dokumentet/${a.id}`}
                                className="text-[13.5px] font-semibold text-[#0f172a] hover:text-brand-blue"
                              >
                                {a.title}
                              </Link>
                              <CategoryChip category={a.documentCategory} />
                              <KindChip kind={a.kind} />
                              {a.generationStatus === "FAILED" ? (
                                <DocChip tone="destructive">Dështoi</DocChip>
                              ) : null}
                              {a.isArchived ? <DocChip tone="locked">Arkiv</DocChip> : null}
                            </div>
                            <span className="block truncate text-[12px] text-[#94a3b8]">
                              {a.displayFilename}
                            </span>
                            {templateDiffersFromTitle ? (
                              <span className="block truncate text-[11px] text-[#cbd5e1]">
                                Shablloni: {a.templateName}
                              </span>
                            ) : null}
                          </div>
                        </div>
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
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            className={docBtnSecondaryDense}
                            onClick={() => setPreviewId(a.id)}
                            aria-label={`Shiko ${a.title}`}
                            title="Shiko"
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <a
                            className={docBtnSecondaryDense}
                            href={`/api/dokumentet/artifacts/${a.id}/${a.hasPdf ? "pdf" : "docx"}`}
                            aria-label={`Shkarko ${a.hasPdf ? "PDF" : "DOCX"}`}
                            title="Shkarko"
                          >
                            <Download className="h-3.5 w-3.5" aria-hidden />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
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

      <DocumentPreviewSheet
        artifact={previewArtifact}
        onOpenChange={(o) => !o && setPreviewId(null)}
      />
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

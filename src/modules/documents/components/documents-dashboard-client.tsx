"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { DocumentCategory } from "@prisma/client";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  FileSignature,
  UserMinus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_CATEGORY_LABELS,
  formatArtifactKind,
} from "@/modules/documents/components/document-labels";
import {
  DocChip,
  type DocChipTone,
  docBtnPrimary,
  docBtnSecondaryDense,
  docCard,
  docTableCell,
  docTableHead,
} from "@/modules/documents/components/doc-ui";

export interface ArtifactRow {
  id: string;
  title: string;
  displayFilename: string;
  documentCategory: DocumentCategory;
  kind: string;
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
  templateSummary: {
    total: number;
    ready: number;
    needsMapping: number;
    missingPublished: number;
  };
  /** Filter toolbar (server-rendered form) slotted between the health strip and the register. */
  filtersSlot?: ReactNode;
}

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
    <DocChip tone={CATEGORY_CHIP_TONES[category]}>
      {DOCUMENT_CATEGORY_LABELS[category]}
    </DocChip>
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
}> = [
  { category: "CONTRACT", icon: FileSignature, tile: "bg-[#eff6ff]", iconColor: "text-brand-blue" },
  { category: "LEAVE", icon: CalendarDays, tile: "bg-[#ecfdf5]", iconColor: "text-[#15803d]" },
  { category: "TERMINATION", icon: UserMinus, tile: "bg-[#fef2f2]", iconColor: "text-[#dc2626]" },
  { category: "WARNING", icon: AlertTriangle, tile: "bg-[#fffbeb]", iconColor: "text-[#b45309]" },
];

export function DocumentsDashboardClient(props: DocumentsDashboardClientProps) {
  const finalCount = props.artifacts.filter((a) => a.kind === "ARCHIVED_FINAL").length;
  const previewCount = props.artifacts.filter((a) => a.kind === "PREVIEW").length;
  const archivedCount = props.artifacts.filter((a) => a.isArchived).length;

  const monthKey = new Date().toISOString().slice(0, 7);
  const monthCounts = new Map<DocumentCategory, number>();
  for (const a of props.artifacts) {
    if (!a.createdAt.startsWith(monthKey)) continue;
    monthCounts.set(a.documentCategory, (monthCounts.get(a.documentCategory) ?? 0) + 1);
  }

  return (
    <div className="space-y-5">
      {/* Quick-start category tiles (4a) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_START.map(({ category, icon: Icon, tile, iconColor }) => (
          <Link
            key={category}
            href={`/dokumentet/generate?category=${category}`}
            className={cn(
              docCard,
              "group flex items-center gap-3.5 p-4 transition-colors hover:border-[#bfdbfe]",
            )}
          >
            <span
              className={cn(
                "flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px]",
                tile,
              )}
            >
              <Icon className={cn("h-[18px] w-[18px]", iconColor)} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold text-[#0f172a]">
                {DOCUMENT_CATEGORY_LABELS[category]}
              </span>
              <span className="block text-[12px] text-[#94a3b8]">
                {monthCounts.get(category) ?? 0} këtë muaj
              </span>
            </span>
            <ArrowUpRight
              className="h-4 w-4 shrink-0 text-[#cbd5e1] transition-colors group-hover:text-brand-blue"
              aria-hidden
            />
          </Link>
        ))}
      </div>

      {/* Template-health strip */}
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
        <Link
          href="/dokumentet/templates"
          className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-blue hover:text-[#1d4ed8]"
        >
          Menaxho shabllonet
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      {props.filtersSlot}

      {/* Register — mobile cards */}
      <div className="space-y-3 md:hidden">
        {props.artifacts.length === 0 ? (
          <div className={cn(docCard, "p-6 text-center text-[13px] text-[#64748b]")}>
            Nuk ka dokumente për filtrat aktualë.
          </div>
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
            {props.artifacts.length} dokumente · {finalCount} finale · {previewCount} parapamje ·{" "}
            {archivedCount} në arkiv
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#eef2f7] bg-[#f8fafc]">
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
                  <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-[#64748b]">
                    Nuk ka dokumente për filtrat aktualë.
                  </td>
                </tr>
              ) : (
                props.artifacts.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-[#f1f5f9] transition-colors last:border-0 hover:bg-[#f8fafc]"
                  >
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
                      <Link href={`/dokumentet/${a.id}`} className={docBtnSecondaryDense}>
                        Hap
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-4 right-4 z-40 md:hidden">
        <Link
          href="/dokumentet/generate"
          className={cn(docBtnPrimary, "w-full shadow-lg")}
        >
          Gjenero dokumente
        </Link>
      </div>
    </div>
  );
}

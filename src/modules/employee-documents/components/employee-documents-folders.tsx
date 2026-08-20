"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Image as ImageIcon } from "lucide-react";
import type { EmployeeDocumentCategory } from "@prisma/client";
import { useCan } from "@/components/layout/capability-provider";
import { archiveEmployeeDocumentAction } from "@/modules/employee-documents/actions/employee-document-actions";
import {
  EMPLOYEE_DOCUMENT_CATEGORY_HINTS,
  EMPLOYEE_DOCUMENT_CATEGORY_LABELS,
  EMPLOYEE_DOCUMENT_CATEGORY_ORDER,
} from "@/modules/employee-documents/components/employee-document-labels";
import { classifyExpiry } from "@/modules/employee-documents/services/employee-document-expiry";
import type { EmployeeDossierBundle, EmployeeUploadedDocSummary } from "@/modules/employee-documents/types/employee-document-types";

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ExpiryBadge({ expiresAtIso, todayIso }: { expiresAtIso: string | null; todayIso: string }) {
  const status = classifyExpiry(expiresAtIso, new Date(todayIso));
  if (status === "ok") return null;
  const label = expiresAtIso ? new Date(expiresAtIso).toLocaleDateString("sq-AL") : "";
  return status === "expired" ? (
    <span className="rounded bg-[#fdf3f4] px-1.5 py-0.5 text-[11px] font-semibold text-[#a4262c]">
      Skaduar {label}
    </span>
  ) : (
    <span className="rounded bg-[#fdf6e9] px-1.5 py-0.5 text-[11px] font-semibold text-[#8a5300]">
      Skadon {label}
    </span>
  );
}

function DocRow({
  doc,
  employeeId,
  canWrite,
  todayIso,
  onArchiveToggle,
}: {
  doc: EmployeeUploadedDocSummary;
  employeeId: string;
  canWrite: boolean;
  todayIso: string;
  onArchiveToggle: (doc: EmployeeUploadedDocSummary) => void;
}) {
  const href = `/api/punonjesit/${employeeId}/documents/${doc.id}`;
  const Icon = doc.contentType.startsWith("image/") ? ImageIcon : FileText;
  return (
    <li className="flex items-start gap-3 px-5 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#94a3b8]" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className={`text-[13px] font-semibold ${doc.isArchived ? "text-[#94a3b8] line-through" : "text-[#0f172a]"}`}>
            {doc.title}
          </span>
          <ExpiryBadge expiresAtIso={doc.expiresAtIso} todayIso={todayIso} />
        </div>
        <p className="text-xs text-[#64748b]">
          {doc.displayFilename} · {fmtSize(doc.sizeBytes)} · {doc.createdAtLabel}
          {doc.uploadedByName ? ` · ${doc.uploadedByName}` : ""}
          {doc.note ? ` · ${doc.note}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-[12.5px] font-medium">
        {doc.inlinePreviewable ? (
          <a className="text-brand-blue hover:underline" href={`${href}?inline=1`} target="_blank" rel="noreferrer">
            Hape
          </a>
        ) : null}
        <a className="text-brand-blue hover:underline" href={href}>
          Shkarko
        </a>
        {canWrite ? (
          <button
            type="button"
            className="text-[#64748b] underline-offset-2 hover:text-[#0f172a] hover:underline"
            onClick={() => onArchiveToggle(doc)}
          >
            {doc.isArchived ? "Rikthe" : "Arkivo"}
          </button>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The uploaded half of the dossier, foldered by category. Sensitive folders
 * never reach this component for viewers without documents.sensitive — the
 * server filtered them; this component only renders what it is given.
 */
export function EmployeeDocumentsFolders({
  bundle,
  todayIso,
}: {
  bundle: EmployeeDossierBundle;
  todayIso: string;
}) {
  const router = useRouter();
  const canWrite = useCan("documents.write");
  const [showArchived, setShowArchived] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<EmployeeDocumentCategory, EmployeeUploadedDocSummary[]>();
    for (const d of bundle.documents) {
      if (!showArchived && d.isArchived) continue;
      const list = map.get(d.category) ?? [];
      list.push(d);
      map.set(d.category, list);
    }
    return map;
  }, [bundle.documents, showArchived]);

  const archivedCount = useMemo(
    () => bundle.documents.filter((d) => d.isArchived).length,
    [bundle.documents],
  );

  async function toggleArchive(doc: EmployeeUploadedDocSummary) {
    const r = await archiveEmployeeDocumentAction({ documentId: doc.id, archived: !doc.isArchived });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(doc.isArchived ? "Dokumenti u rikthye." : "Dokumenti u arkivua.");
    router.refresh();
  }

  if (bundle.documents.length === 0) {
    return (
      <p className="text-[13px] text-[#64748b]">
        Asnjë dokument i ngarkuar deri tani. Ngarkoni letërnjoftime, kontrata të nënshkruara,
        kualifikime dhe dokumente të tjera të dosjes.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {archivedCount > 0 ? (
        <button
          type="button"
          className="text-[12.5px] font-medium text-[#64748b] underline-offset-2 hover:text-[#0f172a] hover:underline"
          aria-expanded={showArchived}
          onClick={() => setShowArchived((v) => !v)}
        >
          {showArchived ? "Fshih arkivin" : `Shfaq arkivin (${archivedCount})`}
        </button>
      ) : null}
      {EMPLOYEE_DOCUMENT_CATEGORY_ORDER.filter((c) => grouped.has(c)).map((c) => (
        <section
          key={c}
          className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white"
          aria-label={EMPLOYEE_DOCUMENT_CATEGORY_LABELS[c]}
        >
          <div className="border-b border-[#eef2f7] bg-[#f8fafc] px-5 py-2.5">
            <h4 className="text-[12.5px] font-semibold text-[#0f172a]">
              {EMPLOYEE_DOCUMENT_CATEGORY_LABELS[c]}
              <span className="ml-2 font-normal text-[#94a3b8]">{grouped.get(c)?.length}</span>
            </h4>
            <p className="text-[11.5px] text-[#94a3b8]">{EMPLOYEE_DOCUMENT_CATEGORY_HINTS[c]}</p>
          </div>
          <ul className="divide-y divide-[#f1f5f9]">
            {grouped.get(c)?.map((d) => (
              <DocRow
                key={d.id}
                doc={d}
                employeeId={bundle.employeeId}
                canWrite={canWrite}
                todayIso={todayIso}
                onArchiveToggle={(x) => void toggleArchive(x)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

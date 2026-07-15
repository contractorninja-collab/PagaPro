import Link from "next/link";
import {
  DOCUMENT_CATEGORY_LABELS,
  formatArtifactKind,
} from "@/modules/documents/components/document-labels";
import type { DocumentCategoryCount, RecentDocumentRow } from "../types/dashboard-types";

const TH_CLASS =
  "whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.04em] text-[#94a3b8]";

export function DashboardDocumentsSection(props: {
  byCategory: DocumentCategoryCount[];
  recent: RecentDocumentRow[];
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <div className="border-b border-[#f1f5f9] px-5 pb-3.5 pt-[18px]">
        <h3 className="text-[15px] font-bold text-[#0f172a]">Dokumentet</h3>
        <p className="mt-0.5 text-[12px] text-[#94a3b8]">
          Gjenerimet e fundit dhe shpërndarja sipas llojit (muaji i filtrit).
        </p>
      </div>

      <div className="px-5 pt-3.5">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">
          Për kategori (final)
        </p>
        {props.byCategory.length === 0 ? (
          <p className="text-[12.5px] text-[#64748b]">Nuk ka dokumente për muajin.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {props.byCategory.map((c) => (
              <li key={c.category}>
                <span className="inline-flex h-6 items-center rounded-full bg-[#f1f5f9] px-2.5 text-[11.5px] font-semibold text-[#64748b]">
                  {DOCUMENT_CATEGORY_LABELS[c.category]}:{" "}
                  <span className="ml-1 tabular-nums">{c.count}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3.5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#f8fafc]">
              <th className={`${TH_CLASS} pl-5`}>Dokumenti</th>
              <th className={TH_CLASS}>Lloji</th>
              <th className={TH_CLASS}>Template</th>
              <th className={TH_CLASS}>Punonjësi</th>
              <th className={`${TH_CLASS} pr-5 text-right`}>Veprime</th>
            </tr>
          </thead>
          <tbody>
            {props.recent.length === 0 ? (
              <tr className="border-t border-[#f1f5f9]">
                <td colSpan={5} className="px-5 py-6 text-center text-sm text-[#64748b]">
                  Nuk ka dokumente të fundit.
                </td>
              </tr>
            ) : (
              props.recent.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]"
                >
                  <td className="max-w-[200px] truncate py-3 pl-5 pr-3 text-[13px] font-semibold text-[#0f172a]">
                    {r.title}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-[12px] text-[#64748b]">
                    {DOCUMENT_CATEGORY_LABELS[r.category]} · {formatArtifactKind(r.kind)}
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-3 text-[12.5px] text-[#64748b]">
                    {r.templateName}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-[12.5px]">
                    {r.employeeId ? (
                      <Link
                        href={`/punonjesit/${r.employeeId}`}
                        className="font-semibold text-brand-blue hover:underline"
                      >
                        {r.employeeName ?? "Hap"}
                      </Link>
                    ) : (
                      <span className="text-[#94a3b8]">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-3 pl-3 pr-5 text-right">
                    <div className="flex justify-end gap-3 text-[12.5px] font-semibold">
                      <a
                        href={`/api/dokumentet/artifacts/${r.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-blue hover:underline"
                      >
                        PDF
                      </a>
                      <Link href={`/dokumentet/${r.id}`} className="text-brand-blue hover:underline">
                        Hap
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

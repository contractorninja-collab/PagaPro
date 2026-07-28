"use client";

import { Download, Info, Lock } from "lucide-react";
import type { PayrollPeriodStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PayrollDetailDto } from "@/modules/payroll/services/payroll-period-service";
import { CARD, CARD_TITLE } from "@/modules/payroll/components/payroll-card";
import {
  isAtkStatusEligible,
  isPayrollFrozen,
} from "@/modules/payroll/atk/atk-export-eligibility";

/**
 * One job: the official ATK workbook. The financial exports that used to share
 * this tab now live with the other documents.
 *
 * The active export is shown once. It used to appear both as a standalone
 * download button and as the first row of the history table — the same file and
 * the same URL, which read as two different artifacts.
 */
export function PayrollAtkTab(props: {
  status: PayrollPeriodStatus;
  exports: PayrollDetailDto["atkExports"];
  canGenerate: boolean;
  pending: boolean;
  onGenerate: () => void;
  onArchive: (exportId: string) => void;
}) {
  const active = props.exports.find((x) => !x.isArchived);
  const previous = props.exports.filter((x) => x.id !== active?.id);
  const statusEligible = isAtkStatusEligible(props.status);
  const frozen = isPayrollFrozen(props.status);

  return (
    <div className="space-y-4">
      <section className={CARD}>
        <h3 className={CARD_TITLE}>Eksporti ATK (Excel — shablloni zyrtar)</h3>
        <div className="space-y-3 px-5 py-4 text-[13px] leading-relaxed text-[#64748b]">
          <p>
            Workbook-u gjenerohet nga shablloni zyrtar{" "}
            <strong className="font-semibold text-[#0f172a]">Mostra Pagave ATK.xlsx</strong>. Kontraktorët
            përjashtohen automatikisht.
          </p>

          {/* The gating rule sits next to the control it governs, not as a grey
              aside further down the card. */}
          {!statusEligible ? (
            <p className="flex items-start gap-2 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-xs text-[#1e40af]">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Gjenerimi bëhet vetëm pasi payroll-i të jetë <strong>i miratuar</strong>.
            </p>
          ) : frozen && active ? (
            <p className="flex items-start gap-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-xs text-[#475569]">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Shumat janë të ngrira — eksporti gjenerohet një herë. Përdorni shkarkimin më poshtë.
            </p>
          ) : null}

          {active ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#cddcf4] bg-[#f5f8ff] px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[13px] font-semibold text-[#0f172a]">{active.filename}</p>
                  <Badge variant="success">Aktiv</Badge>
                </div>
                <p className="mt-0.5 text-xs text-[#64748b] [font-variant-numeric:tabular-nums]">
                  {new Date(active.generatedAt).toLocaleString("sq-XK")}
                  {active.generatedByLabel ? ` · ${active.generatedByLabel}` : ""} ·{" "}
                  <span className="font-mono">{active.snapshotHashPrefix}</span>
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button asChild size="sm">
                  <a href={active.downloadUrl} target="_blank" rel="noreferrer">
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Shkarko
                  </a>
                </Button>
                {props.status === "APPROVED" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => props.onArchive(active.id)}
                  >
                    Arkivo
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-[#e2e8f0] px-4 py-6 text-center text-[13px] text-[#64748b]">
              Ende nuk ka eksport aktiv për këtë payroll.
            </p>
          )}

          {props.canGenerate ? (
            <Button type="button" size="sm" disabled={props.pending} onClick={props.onGenerate}>
              {props.pending ? "Duke punuar…" : active ? "Rigjenero eksportin" : "Gjenero eksportin ATK"}
            </Button>
          ) : null}
          {props.canGenerate && active ? (
            <p className="text-xs text-[#94a3b8]">Rigjenerimi arkivon automatikisht eksportin aktual.</p>
          ) : null}
        </div>
      </section>

      {previous.length > 0 ? (
        <section className={CARD}>
          <h3 className={CARD_TITLE}>Eksportet e mëparshme</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#eef2f7] bg-[#f8fafc] text-left text-[11px] font-bold uppercase tracking-[0.04em] text-[#94a3b8]">
                  <th className="px-5 py-3 font-bold">Koha</th>
                  <th className="px-3 py-3 font-bold">Nga</th>
                  <th className="px-3 py-3 font-bold">Hash (prefiks)</th>
                  <th className="px-3 py-3 font-bold">Statusi</th>
                  <th className="px-5 py-3 text-right font-bold">Veprime</th>
                </tr>
              </thead>
              <tbody>
                {previous.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[#f1f5f9] transition-colors last:border-0 hover:bg-[#f8fafc]"
                  >
                    <td className="whitespace-nowrap px-5 py-2.5 text-[13px] text-[#64748b] [font-variant-numeric:tabular-nums]">
                      {new Date(row.generatedAt).toLocaleString("sq-XK")}
                    </td>
                    <td className="px-3 py-2.5 text-[13px] text-[#334155]">{row.generatedByLabel ?? "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-[#334155]">{row.snapshotHashPrefix}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant="secondary">{row.isArchived ? "I arkivuar" : "Jo aktiv"}</Badge>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <Button asChild size="sm" variant="secondary">
                        <a href={row.downloadUrl} target="_blank" rel="noreferrer">
                          Shkarko
                        </a>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

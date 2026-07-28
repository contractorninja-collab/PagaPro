"use client";

import { Download, FileText, HelpCircle, Printer } from "lucide-react";
import type { PayrollPeriodStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import type { PayrollDetailDto } from "@/modules/payroll/services/payroll-period-service";
import { CARD, CARD_TITLE } from "@/modules/payroll/components/payroll-card";

/**
 * Everything this payroll produces for a human to read: payslips, the print
 * bundle, the registers, and the financial exports (which used to sit in the ATK
 * tab despite not being ATK filings).
 *
 * Generation lives here too. It used to be a button in the workflow row labelled
 * "Paraprakisht: gjenero PDF" — nowhere near the documents it produced.
 */

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleString("sq-XK", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PayrollDocumentsTab(props: {
  payrollId: string;
  status: PayrollPeriodStatus;
  documents: PayrollDetailDto["documents"];
  canGenerate: boolean;
  pending: boolean;
  onGenerate: () => void;
}) {
  const bundle = props.documents.find((d) => d.kind === "PAYSLIPS_PRINT_BUNDLE");
  const payslips = props.documents.filter((d) => d.kind === "EMPLOYEE_PAYSLIP");
  const registers = props.documents.filter(
    (d) => d.kind === "REGISTER_WITH_TOTALS" || d.kind === "REGISTER_SIGNATURE_LIST",
  );
  const hasAny = props.documents.length > 0;

  const generateButton = (
    <Button
      type="button"
      size="sm"
      disabled={!props.canGenerate || props.pending}
      onClick={props.onGenerate}
      title={
        props.canGenerate
          ? undefined
          : "Gjenerimi aktiv vetëm pasi payroll-i të jetë miratuar."
      }
    >
      {props.pending ? "Duke gjeneruar…" : hasAny ? "Rigjenero PDF" : "Gjenero PDF"}
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[13px] leading-relaxed text-[#64748b]">
          Fletëpagesat përfshijnë të ardhurat, zbritjet, neton dhe të dhënat bankare.
          <details className="mt-1 inline-block align-middle">
            <summary className="inline-flex cursor-pointer select-none items-center gap-1 text-[#64748b] hover:text-[#334155]">
              <HelpCircle className="h-3.5 w-3.5" aria-hidden />
              Emërtimi i skedarëve
            </summary>
            <span className="mt-1 block text-xs text-[#94a3b8]">
              Skedari quhet sipas punonjësit dhe muajit, p.sh.{" "}
              <code className="rounded bg-[#f1f5f9] px-1 text-xs text-[#334155]">
                Ajeti_Arines_Qershor_2026.pdf
              </code>
            </span>
          </details>
        </p>
        {generateButton}
      </div>

      {!hasAny ? (
        <div className="rounded-xl border border-[#e2e8f0] bg-white px-6 py-12 text-center shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <FileText className="mx-auto h-6 w-6 text-[#cbd5e1]" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-[#0f172a]">Ende nuk janë gjeneruar PDF.</p>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] text-[#64748b]">
            {props.canGenerate
              ? "Gjeneroni fletëpagesat dhe listat e pagave për këtë muaj."
              : "Fletëpagesat gjenerohen pasi payroll-i të jetë miratuar."}
          </p>
          {props.canGenerate ? <div className="mt-4">{generateButton}</div> : null}
        </div>
      ) : (
        <>
          {bundle ? (
            <section className={CARD}>
              <h3 className={CARD_TITLE}>Printim masiv — të gjitha fletëpagesat</h3>
              <div className="flex flex-wrap items-center gap-2 px-5 py-4">
                <p className="w-full text-xs text-[#64748b]">
                  {bundle.filename} — {payslips.length} fletëpagesa në një PDF (një faqe për punonjës) ·
                  gjeneruar {timeLabel(bundle.generatedAt)}
                </p>
                <Button asChild size="sm">
                  <a href={`/api/payroll-documents/${bundle.id}?inline=1`} target="_blank" rel="noreferrer">
                    <Printer className="h-3.5 w-3.5" aria-hidden />
                    Printo të gjitha
                  </a>
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <a href={`/api/payroll-documents/${bundle.id}`} target="_blank" rel="noreferrer">
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Shkarko paketën
                  </a>
                </Button>
              </div>
            </section>
          ) : null}

          {payslips.length > 0 ? (
            <section className={CARD}>
              <h3 className={CARD_TITLE}>Fletëpagesat e punonjësve</h3>
              <ul className="divide-y divide-[#f1f5f9]">
                {payslips.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 transition-colors hover:bg-[#f8fafc]"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#0f172a]">{d.employeeName ?? d.filename}</p>
                      <p className="truncate text-xs text-[#94a3b8]">
                        {d.filename} · {timeLabel(d.generatedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button asChild size="sm" variant="outlinePrimary">
                        <a href={`/api/payroll-documents/${d.id}?inline=1`} target="_blank" rel="noreferrer">
                          <Printer className="h-3.5 w-3.5" aria-hidden />
                          Printo
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="secondary">
                        <a href={`/api/payroll-documents/${d.id}`} target="_blank" rel="noreferrer">
                          <Download className="h-3.5 w-3.5" aria-hidden />
                          Shkarko
                        </a>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {registers.length > 0 ? (
            <section className={CARD}>
              <h3 className={CARD_TITLE}>Listat e pagave</h3>
              <ul className="divide-y divide-[#f1f5f9]">
                {registers.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 transition-colors hover:bg-[#f8fafc]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[#0f172a]">{d.filename}</p>
                      <p className="text-xs text-[#94a3b8]">{timeLabel(d.generatedAt)}</p>
                    </div>
                    {/* Printo added for parity with payslips — a register is printed
                        far more often than it is filed away. */}
                    <div className="flex shrink-0 gap-1.5">
                      <Button asChild size="sm" variant="outlinePrimary">
                        <a href={`/api/payroll-documents/${d.id}?inline=1`} target="_blank" rel="noreferrer">
                          <Printer className="h-3.5 w-3.5" aria-hidden />
                          Printo
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="secondary">
                        <a href={`/api/payroll-documents/${d.id}`} target="_blank" rel="noreferrer">
                          <Download className="h-3.5 w-3.5" aria-hidden />
                          Shkarko
                        </a>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      {/* Moved out of the ATK tab: these are internal financial exports, not a filing. */}
      <section className={CARD}>
        <h3 className={CARD_TITLE}>Libri i Pagave / Përmbledhja financiare</h3>
        <div className="space-y-3 px-5 py-4 text-[13px] leading-relaxed text-[#64748b]">
          <p>
            Të gjitha të dhënat dhe llogaritjet e motorit të payroll-it — orët, bruto, trusti, tatimi, bonuset
            dhe avanset — në një skedar të stiluar me markën PagaPRO.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outlinePrimary">
              <a href={`/api/payroll/${props.payrollId}/export-financial?format=xlsx`} download>
                <Download className="h-3.5 w-3.5" aria-hidden />
                Excel (i markuar)
              </a>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <a href={`/api/payroll/${props.payrollId}/export-financial?format=pdf`} download>
                <Download className="h-3.5 w-3.5" aria-hidden />
                PDF
              </a>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <a href={`/api/payroll/${props.payrollId}/export-financial?format=csv`} download>
                <Download className="h-3.5 w-3.5" aria-hidden />
                CSV
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

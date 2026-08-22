"use client";

import { useMemo, useState } from "react";
import { Download, FileText, HelpCircle, Printer, Search, type LucideIcon } from "lucide-react";
import type { PayrollPeriodStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCan } from "@/components/layout/capability-provider";
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

/** Above this many payslips, finding one person by eye stops being realistic. */
const FILTER_THRESHOLD = 12;

/**
 * A row action in the payslip list. Icon-only — the same two verbs repeated
 * down every row read as decoration, and the labels were most of the row's
 * width. The name stays on the button for screen readers and on hover.
 */
function PayslipAction(props: {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
}) {
  const Icon = props.icon;
  return (
    <a
      href={props.href}
      target="_blank"
      rel="noreferrer"
      title={props.short}
      aria-label={props.label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-white hover:text-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </a>
  );
}

export function PayrollDocumentsTab(props: {
  payrollId: string;
  status: PayrollPeriodStatus;
  documents: PayrollDetailDto["documents"];
  canGenerate: boolean;
  pending: boolean;
  onGenerate: () => void;
}) {
  // The payment list carries every employee's bank account, so the card is
  // hidden — not disabled — for anyone the route would refuse.
  const canSeeBankList = useCan("payroll.prepare");
  const bankListReady = props.status === "LOCKED" || props.status === "ARCHIVED";

  const bundle = props.documents.find((d) => d.kind === "PAYSLIPS_PRINT_BUNDLE");
  const payslips = props.documents.filter((d) => d.kind === "EMPLOYEE_PAYSLIP");

  const [query, setQuery] = useState("");
  const visiblePayslips = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("sq-AL");
    if (q === "") return payslips;
    // Match the filename too — it carries the name in surname-first order,
    // which is how half the office will type it.
    return payslips.filter((d) =>
      `${d.employeeName ?? ""} ${d.filename}`.toLocaleLowerCase("sq-AL").includes(q),
    );
  }, [payslips, query]);
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
        <p className="max-w-2xl text-[13px] leading-relaxed text-ink-500">
          Fletëpagesat përfshijnë të ardhurat, zbritjet, neton dhe të dhënat bankare.
          <details className="mt-1 inline-block align-middle">
            <summary className="inline-flex cursor-pointer select-none items-center gap-1 text-ink-500 hover:text-ink-700">
              <HelpCircle className="h-3.5 w-3.5" aria-hidden />
              Emërtimi i skedarëve
            </summary>
            <span className="mt-1 block text-xs text-ink-400">
              Skedari quhet sipas punonjësit dhe muajit, p.sh.{" "}
              <code className="rounded bg-fill px-1 text-xs text-ink-700">
                Ajeti_Arines_Qershor_2026.pdf
              </code>
            </span>
          </details>
        </p>
        {generateButton}
      </div>

      {!hasAny ? (
        <div className="rounded-xl border border-line bg-white px-6 py-12 text-center shadow-card">
          <FileText className="mx-auto h-6 w-6 text-ink-300" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-ink-900">Ende nuk janë gjeneruar PDF.</p>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] text-ink-500">
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
                <p className="w-full text-xs text-ink-500">
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
              {/*
                One line per person, in columns. Every row used to repeat the
                filename and the generation time — but the filename is the
                person's name rearranged (explained once above), and the time is
                identical on all of them because they are generated in one
                batch. Sixteen employees became a page of scrolling that carried
                one payslip's worth of information. Both facts now live in the
                header, said once.
              */}
              <div className={cn(CARD_TITLE, "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1")}>
                <span>Fletëpagesat e punonjësve</span>
                <span className="text-[11.5px] font-medium text-ink-400">
                  {payslips.length} punonjës · gjeneruar {timeLabel(payslips[0]!.generatedAt)}
                </span>
              </div>

              {payslips.length > FILTER_THRESHOLD ? (
                <div className="border-b border-line-soft px-4 py-2">
                  <div className="relative max-w-xs">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
                      aria-hidden
                    />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Kërko punonjës…"
                      aria-label="Kërko punonjës në listën e fletëpagesave"
                      className="h-8 w-full rounded-lg border border-line bg-white pl-8 pr-2.5 text-[12.5px] text-ink-700 placeholder:text-ink-400 focus:border-brand-blue focus:outline-none"
                    />
                  </div>
                </div>
              ) : null}

              {visiblePayslips.length === 0 ? (
                <p className="px-5 py-6 text-center text-[13px] text-ink-500">
                  Asnjë punonjës nuk përputhet me kërkimin.
                </p>
              ) : (
                <ul className="grid gap-x-3 px-3 py-2 sm:grid-cols-2 xl:grid-cols-3">
                  {visiblePayslips.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-fill-faint"
                    >
                      <span
                        className="truncate text-[13px] text-ink-800"
                        title={d.filename}
                      >
                        {d.employeeName ?? d.filename}
                      </span>
                      <span className="flex shrink-0 items-center gap-0.5">
                        <PayslipAction
                          href={`/api/payroll-documents/${d.id}?inline=1`}
                          label={`Printo fletëpagesën e ${d.employeeName ?? d.filename}`}
                          short="Printo"
                          icon={Printer}
                        />
                        <PayslipAction
                          href={`/api/payroll-documents/${d.id}`}
                          label={`Shkarko fletëpagesën e ${d.employeeName ?? d.filename}`}
                          short="Shkarko"
                          icon={Download}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {registers.length > 0 ? (
            <section className={CARD}>
              <h3 className={CARD_TITLE}>Listat e pagave</h3>
              <ul className="divide-y divide-fill">
                {registers.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 transition-colors hover:bg-fill-faint"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-ink-900">{d.filename}</p>
                      <p className="text-xs text-ink-400">{timeLabel(d.generatedAt)}</p>
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

      {/* The monthly click: the file finance uploads to the bank. Above the
          Libri i Pagave card because executing the payment comes first and
          the archival reporting comes after. */}
      {canSeeBankList ? (
        <section className={CARD}>
          <h3 className={CARD_TITLE}>Lista e pagave për ekzekutim</h3>
          <div className="space-y-3 px-5 py-4 text-[13px] leading-relaxed text-ink-500">
            <p>
              Emri, mbiemri, llogaria bankare dhe paga neto për çdo punonjës — gati për financat.
              Punonjësit pa llogari të vlefshme shfaqen veçmas, që askush të mos mbetet pa pagesë
              pa u vënë re.
            </p>
            {bankListReady ? (
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outlinePrimary">
                  <a href={`/api/payroll/${props.payrollId}/export-bank-list`} download>
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Shkarko Excel
                  </a>
                </Button>
              </div>
            ) : (
              <p className="text-[12.5px] text-ink-400">
                Aktive pasi payroll-i të jetë kyçur — që shumat në listën e pagesave të mos
                ndryshojnë pasi financat ta kenë marrë skedarin.
              </p>
            )}
          </div>
        </section>
      ) : null}

      {/* Moved out of the ATK tab: these are internal financial exports, not a filing. */}
      <section className={CARD}>
        <h3 className={CARD_TITLE}>Libri i Pagave / Përmbledhja financiare</h3>
        <div className="space-y-3 px-5 py-4 text-[13px] leading-relaxed text-ink-500">
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

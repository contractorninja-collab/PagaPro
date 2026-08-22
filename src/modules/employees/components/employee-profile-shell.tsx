"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DocumentCategory, EmploymentStatus } from "@prisma/client";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Download, FileText, FolderOpen, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { AppSubBar, SubBarStatus } from "@/components/layout/app-sub-bar";
import { EmptySection } from "@/components/patterns/empty-section";
import { StatusPill } from "@/components/patterns/status-pill";
import { Button } from "@/components/ui/button";
import { useCan } from "@/components/layout/capability-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getEmployeeDetailAction, rehireEmployeeAction } from "@/modules/employees/actions/employee-actions";
import type { DepartmentOptionDto, EmployeeDetailDto, JobTitleOptionDto, SalaryChangeDto } from "@/modules/employees/types";
import { EmployeeFormSheet } from "@/modules/employees/components/employee-form-sheet";
import {
  MaskedAmount,
  SalaryVisibilityProvider,
  SalaryVisibilityToggle,
} from "@/modules/employees/components/salary-visibility";
import { AnnexPanel } from "@/modules/annex/components/annex-panel";
import { WarningsPanel } from "@/modules/warnings/components/warnings-panel";
import { EmployeePresencePanel } from "@/modules/timeclock/components/employee-presence-panel";
import {
  EMPLOYMENT_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  formatEur,
  formatSqDate,
  GENDER_LABELS,
  WORK_ARRANGEMENT_LABELS,
} from "@/modules/employees/components/employees-labels";
import { EmployeeStatusBadge, EmployeeTypeBadge } from "@/modules/employees/components/employee-status-badge";
import { DOCUMENT_CATEGORY_LABELS } from "@/modules/documents/components/document-labels";
import { LeaveStatusBadge } from "@/modules/leaves/components/leave-status-badge";
import { LEAVE_TYPE_LABELS_SQ, LEAVE_SUBTYPE_LABELS_SQ } from "@/modules/leaves/helpers/leave-type-metadata";
import { fmtDays } from "@/modules/leaves/helpers/leave-balance-view";
import {
  balanceLineSegments,
  sortBalancesForDisplay,
  type EmployeeLeaveBundle,
} from "@/modules/leaves/helpers/employee-leave-view";
import { EmployeeDocumentUploadDialog } from "@/modules/employee-documents/components/employee-document-upload-dialog";
import { DocumentQuickView, type QuickViewTarget } from "@/modules/employee-documents/components/document-quick-view";
import { EmployeeDocumentsFolders } from "@/modules/employee-documents/components/employee-documents-folders";
import type { EmployeeDossierBundle } from "@/modules/employee-documents/types/employee-document-types";

export interface EmployeeGeneratedDocSummary {
  id: string;
  title: string;
  documentCategory: DocumentCategory;
  kind: string;
  createdAtIso: string;
  createdAtLabel: string;
  isArchived: boolean;
  templateName: string;
  templateVersionNumber: number;
  hasPdf: boolean;
}

export interface EmployeePayrollPdfSummary {
  id: string;
  filename: string;
  generatedAtIso: string;
  periodLabel: string;
}

/**
 * A generated employment contract.
 *
 * This used to describe a row of the `contracts` table — which nothing in the
 * app has ever written, so the register was empty for every employee in every
 * company while their contract sat one tab over under Dokumentet. It now
 * describes the generated document itself, which is what the empty state
 * always promised would be listed here.
 */
export interface EmployeeContractSummary {
  id: string;
  title: string;
  /** PREVIEW or ARCHIVED_FINAL. */
  kind: string;
  /** Albanian label for the contract subtype (afat i caktuar / i pacaktuar…). */
  subtypeLabel: string | null;
  createdAtIso: string;
  hasPdf: boolean;
}

export interface EmployeeProfileDocumentsBundle {
  employeeId?: string;
  generatedDocuments: EmployeeGeneratedDocSummary[];
  payrollPdfs: EmployeePayrollPdfSummary[];
  contracts: EmployeeContractSummary[];
}

/* ---------------------------------- 1b design primitives (local) ---------------------------------- */

const TH =
  "h-9 whitespace-nowrap px-4 text-left align-middle text-[11px] font-bold uppercase tracking-[0.04em] text-ink-400";
const TD = "px-4 py-2.5 align-middle text-[13px] text-ink-700";

const TAB_TRIGGER =
  "rounded-lg px-3.5 py-1.5 text-[13px] font-medium text-ink-500 transition-colors hover:text-ink-900 data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-ink-900 data-[state=active]:shadow-[0_1px_3px_rgba(15,23,42,0.08)]";

/** Kartë e stilit "1b": bardhë, kufi #e2e8f0, radius 12px, hije e sheshtë. */
function SectionCard({
  title,
  description,
  action,
  flush = false,
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Pa padding të brendshëm — për tabela që shtrihen deri në skaj. */
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-line bg-white shadow-card",
        className,
      )}
    >
      {title || action ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-3.5">
          <div className="min-w-0">
            <h3 className="text-[13.5px] font-semibold tracking-[-0.01em] text-ink-900">{title}</h3>
            {description ? <p className="mt-0.5 text-[12px] text-ink-500">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={flush ? undefined : "px-5 py-4"}>{children}</div>
    </section>
  );
}

function RehireControl({
  employeeId,
  onDone,
}: {
  employeeId: string;
  onDone: () => void | Promise<void>;
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!date) {
      toast.error("Zgjidhni datën e rikthimit.");
      return;
    }
    setBusy(true);
    const r = await rehireEmployeeAction({ employeeId, rehireDate: date });
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Punonjësi u rikthye në punë.");
    await onDone();
  }

  return (
    // One h-9 row — the stacked label made this control taller than its
    // neighbours and broke the sub-bar's baseline. The date names itself via
    // aria-label/title instead.
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        value={date}
        aria-label="Data e rikthimit"
        title="Data e rikthimit"
        onChange={(e) => setDate(e.target.value)}
        className="h-9 rounded-[9px] border border-line bg-white px-3 text-[13px] text-ink-700 transition-colors focus-visible:border-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/25"
      />
      <Button type="button" variant="secondary" disabled={busy} onClick={() => void submit()}>
        Rikthe në punë
      </Button>
    </div>
  );
}

function Row({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-fill pb-2.5 last:border-0 last:pb-0">
      <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-400">{label}</span>
      <span className={cn("text-[13.5px] text-[#111827]", className)}>{value}</span>
    </div>
  );
}

/* ------------------------------------------ Tab bodies ------------------------------------------ */

function SalaryHistoryCard({ rows }: { rows: SalaryChangeDto[] }) {
  return (
    <SectionCard
      title="Historiku i pagave"
      description="Ndryshimet e pagës bazë me datë efektive (rritje / rregullime)."
      flush={rows.length > 0}
    >
      {rows.length === 0 ? (
        <EmptySection icon={TrendingUp} title="Asnjë ndryshim page" hint="Rritjet dhe rregullimet e pagës bazë do të shfaqen këtu me datën efektive." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b border-line-soft bg-fill-faint">
                <th className={TH}>Data efektive</th>
                <th className={cn(TH, "text-right")}>Nga</th>
                <th className={cn(TH, "text-right")}>Në</th>
                <th className={TH}>Arsyeja</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-fill transition-colors last:border-0 hover:bg-fill-faint">
                  <td className={cn(TD, "whitespace-nowrap tabular-nums")}>{formatSqDate(r.effectiveFromIso)}</td>
                  <td className={cn(TD, "text-right tabular-nums text-ink-500")}>
                    {r.previousBaseSalary ? (
                      <MaskedAmount value={formatEur(r.previousBaseSalary)} />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={cn(TD, "text-right font-semibold tabular-nums text-ink-900")}>
                    <MaskedAmount value={formatEur(r.newBaseSalary)} />
                  </td>
                  <td className={cn(TD, "text-ink-500")}>{r.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function SummaryTab({ e, timeClockEnabled }: { e: EmployeeDetailDto; timeClockEnabled: boolean }) {
  const ec = e.emergencyContact;
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* Left rail */}
      <div className="grid gap-4">
        <SectionCard title="Pagat & banka">
          <div className="mb-4 rounded-[10px] bg-fill-faint px-4 py-3">
            {e.employmentType === "CONTRACTOR" ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-400">Tarifa orare</p>
                <p className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-0.02em] tabular-nums text-ink-900">
                  <MaskedAmount value={e.hourlyRate ? `${formatEur(e.hourlyRate)}/orë` : "—"} />
                </p>
              </>
            ) : e.compensationBasis === "HOURLY_GROSS" ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-400">Paga bruto orare</p>
                <p className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-0.02em] tabular-nums text-ink-900">
                  <MaskedAmount value={e.hourlyRate ? `${formatEur(e.hourlyRate)}/orë` : "—"} />
                </p>
                <p className="mt-0.5 text-[11px] text-ink-400">
                  ≈ <MaskedAmount value={formatEur(e.baseSalaryMonthly)} /> bruto/muaj referencë
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-400">Paga bruto mujore</p>
                <p className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-0.02em] tabular-nums text-ink-900">
                  <MaskedAmount value={formatEur(e.baseSalaryMonthly)} />
                </p>
              </>
            )}
          </div>
          <div className="grid gap-2.5">
            <Row label="Orët javore" value={e.weeklyHours} className="tabular-nums" />
            <Row label="Banka" value={e.bankName ?? "—"} />
            <Row label="Numri i llogarisë" value={e.bankAccountIban ?? "—"} className="font-mono text-xs" />
            <Row label="Apliko Trustin" value={e.applyTrust ? "Po" : "Jo"} />
            <Row label="Apliko tatimin" value={e.applyTax ? "Po" : "Jo"} />
            <Row
              label="Punësim"
              value={e.employerPrimacy === "SECONDARY" ? "Sekondar" : "Primar"}
            />
            <Row label="Shtetas i huaj" value={e.isForeignNational ? "Po" : "Jo"} />
            {e.isForeignNational ? (
              <Row
                label="Leja e qëndrimit skadon"
                value={
                  e.residencePermitExpiryDate ? formatSqDate(e.residencePermitExpiryDate) : "—"
                }
                className={
                  e.residencePermitExpiryDate &&
                  new Date(e.residencePermitExpiryDate).getTime() - Date.now() <
                    60 * 24 * 60 * 60 * 1000
                    ? "font-semibold text-[#b45309]"
                    : undefined
                }
              />
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Kontakti emergjent">
          <div className="grid gap-2.5">
            <Row label="Emri" value={ec?.fullName ?? "—"} />
            <Row label="Telefoni" value={ec?.phone ?? "—"} />
            <Row label="Raporti" value={ec?.relationship ?? "—"} />
          </div>
        </SectionCard>

        <SectionCard title="Shtesë">
          <div className="grid gap-2.5">
            <Row label="Shënime të brendshme" value={e.internalNotes ?? "—"} />
            <Row label="Dokumente mungojnë" value={e.documentsMissing ? "Po" : "Jo"} />
          </div>
        </SectionCard>
      </div>

      {/* Right column */}
      <div className="grid gap-4">
        <SectionCard title="Personale">
          <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-x-8">
            <Row label="Emri" value={`${e.firstName} ${e.lastName}`} />
            <Row label="Numri personal" value={e.personalId} className="tabular-nums" />
            <Row label="Data e lindjes" value={formatSqDate(e.dateOfBirth)} className="tabular-nums" />
            <Row label="Gjinia" value={e.gender ? GENDER_LABELS[e.gender] : "—"} />
            <Row label="Telefoni" value={e.phone ?? "—"} className="tabular-nums" />
            <Row label="Email" value={e.email ?? "—"} />
            <Row label="Adresa" value={e.addressLine ?? "—"} />
            <Row label="Qyteti" value={e.addressCity ?? "—"} />
          </div>
        </SectionCard>

        <SectionCard title="Punësimi">
          <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-x-8">
            <Row
              label="Statusi"
              value={<EmployeeStatusBadge status={e.status} employmentType={e.employmentType} />}
            />
            <Row label="Lloji" value={<EmployeeTypeBadge employmentType={e.employmentType} />} />
            <Row label="Lloji i punës" value={WORK_ARRANGEMENT_LABELS[e.workArrangement]} />
            <Row label="Pozita" value={e.jobTitle ?? "—"} />
            <Row label="Departamenti" value={e.departmentName ?? "—"} />
            <Row label="Vendi i punës" value={e.workplace ?? "Selia e kompanisë"} />
            {timeClockEnabled ? <Row label="Kodi i kartelës" value={e.badgeCode ?? "—"} /> : null}
            <Row label="Kualifikimi" value={e.qualification ?? "—"} />
            {/* The Neni 37 bonus itself is computed by the engine from total
                experience (prior + this employment) — no arithmetic here. */}
            <Row
              label="Përvoja para kompanisë"
              value={e.priorWorkExperienceYears > 0 ? `${e.priorWorkExperienceYears} vjet` : "—"}
            />
            <Row
              label="Muaj pune praktike"
              value={e.probationMonths && e.probationMonths > 0 ? `${e.probationMonths}` : "—"}
            />
            <Row label="Data e punësimit" value={formatSqDate(e.hireDate)} className="tabular-nums" />
            <Row label="Data e largimit" value={formatSqDate(e.terminationDate)} className="tabular-nums" />
            <Row label="Arsyeja e largimit" value={e.terminationReason ?? "—"} />
            <Row
              label="Përshkrimi i punës"
              value={e.jobDescription ?? "—"}
              className="whitespace-pre-wrap leading-relaxed"
            />
          </div>
        </SectionCard>

        <SalaryHistoryCard rows={e.salaryHistory} />
      </div>
    </div>
  );
}

function ContractsTab({ rows }: { rows: EmployeeContractSummary[] }) {
  if (rows.length === 0) {
    return (
      <SectionCard title="Kontratat" description="Kontratat e gjeneruara për këtë punonjës.">
        <EmptySection
          icon={FileText}
          title="Asnjë kontratë e gjeneruar"
          hint="Gjeneroni një kontratë te Dokumentet dhe do të shfaqet këtu."
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Kontratat" description="Kronologjikisht, më e reja e para." flush>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="border-b border-line-soft bg-fill-faint">
              <th className={TH}>Kontrata</th>
              <th className={TH}>Lloji</th>
              <th className={TH}>Gjeneruar</th>
              <th className={cn(TH, "text-right")}>Veprime</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-fill transition-colors last:border-0 hover:bg-fill-faint">
                <td className={TD}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link
                      href={`/dokumentet/${c.id}`}
                      className="font-semibold text-ink-900 hover:text-brand-blue"
                    >
                      {c.title}
                    </Link>
                    {c.kind === "PREVIEW" ? (
                      <StatusPill tone="warning" size="sm">
                        Parapamje
                      </StatusPill>
                    ) : null}
                  </div>
                </td>
                <td className={cn(TD, "text-ink-600")}>{c.subtypeLabel ?? "—"}</td>
                <td className={cn(TD, "whitespace-nowrap tabular-nums")}>{formatSqDate(c.createdAtIso)}</td>
                <td className={cn(TD, "text-right")}>
                  <a
                    href={`/api/dokumentet/artifacts/${c.id}/${c.hasPdf ? "pdf" : "docx"}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-btn border border-line bg-white px-3 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-fill-hover"
                    aria-label={`Shkarko ${c.title}`}
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Shkarko
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function DocumentsCenterTab(bundle: EmployeeProfileDocumentsBundle) {
  // Generating a document is documents.write, not employees.write — an
  // ACCOUNTANT holds both, but the two are separate capabilities and this tab
  // must ask for the one it actually uses.
  const canWriteDocuments = useCan("documents.write");
  /**
   * Payslip PDFs print the employee's bank account, so their download route is
   * gated on payroll.prepare. Hide the links from anyone who does not hold it
   * rather than leaving rows that answer 403 when clicked.
   */
  const canSeePayrollPdfs = useCan("payroll.prepare");
  const [quickView, setQuickView] = useState<QuickViewTarget | null>(null);
  const byCategory = useMemo(() => {
    const map = new Map<DocumentCategory, EmployeeGeneratedDocSummary[]>();
    for (const doc of bundle.generatedDocuments) {
      const list = map.get(doc.documentCategory) ?? [];
      list.push(doc);
      map.set(doc.documentCategory, list);
    }
    return map;
  }, [bundle.generatedDocuments]);

  const merged = useMemo(() => {
    type U =
      | { k: "artifact"; t: number; a: EmployeeGeneratedDocSummary }
      | { k: "payroll"; t: number; p: EmployeePayrollPdfSummary };
    const out: U[] = [];
    for (const a of bundle.generatedDocuments) {
      out.push({ k: "artifact", t: Date.parse(a.createdAtIso), a });
    }
    if (canSeePayrollPdfs) {
      for (const p of bundle.payrollPdfs) {
        out.push({ k: "payroll", t: Date.parse(p.generatedAtIso), p });
      }
    }
    out.sort((x, y) => y.t - x.t);
    return out;
  }, [bundle.generatedDocuments, bundle.payrollPdfs, canSeePayrollPdfs]);

  if (merged.length === 0) {
    return (
      <SectionCard
        title="Dokumentet"
        description="Dokumentet e gjeneruara nga moduli Dokumentet dhe PDF nga payroll-i."
        action={
          bundle.employeeId && canWriteDocuments ? (
            <Button size="sm" asChild>
              <Link href={`/dokumentet/generate?category=CONTRACT&employeeId=${bundle.employeeId}`}>
                Gjenero dokument
              </Link>
            </Button>
          ) : null
        }
      >
        <EmptySection icon={FolderOpen} title="Asnjë dokument i gjeneruar" hint="Dokumentet nga moduli Dokumentet dhe PDF-të e pagave do të shfaqen këtu." />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      {bundle.employeeId && canWriteDocuments ? (
        <div className="flex justify-end">
          <Button size="sm" asChild>
            <Link href={`/dokumentet/generate?category=CONTRACT&employeeId=${bundle.employeeId}`}>
              Gjenero dokument për këtë punonjës
            </Link>
          </Button>
        </div>
      ) : null}
      {[...byCategory.entries()].map(([cat, docs]) => (
        <SectionCard key={cat} title={DOCUMENT_CATEGORY_LABELS[cat]} description={`${docs.length} dokument(e)`} flush>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px]">
              <thead>
                <tr className="border-b border-line-soft bg-fill-faint">
                  <th className={TH}>Titulli</th>
                  <th className={TH}>Shablloni</th>
                  <th className={TH}>Data</th>
                  <th className={cn(TH, "text-right")}>Shkarko</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-fill transition-colors last:border-0 hover:bg-fill-faint"
                  >
                    <td className={TD}>
                      <Link
                        href={`/dokumentet/${doc.id}`}
                        className="font-semibold text-ink-900 hover:text-brand-blue"
                      >
                        {doc.title}
                      </Link>
                      {doc.isArchived ? (
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.05em] text-ink-400">
                          Arkiv
                        </span>
                      ) : null}
                    </td>
                    <td className={TD}>
                      {doc.templateName} v{doc.templateVersionNumber}
                    </td>
                    <td className={cn(TD, "whitespace-nowrap tabular-nums text-ink-500")}>{doc.createdAtLabel}</td>
                    <td className={cn(TD, "space-x-2 text-right")}>
                      <Button variant="secondary" size="sm" asChild>
                        <a href={`/api/dokumentet/artifacts/${doc.id}/docx`}>DOCX</a>
                      </Button>
                      {doc.hasPdf ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              setQuickView({
                                url: `/api/dokumentet/artifacts/${doc.id}/pdf?inline=1`,
                                downloadUrl: `/api/dokumentet/artifacts/${doc.id}/pdf`,
                                title: doc.title,
                                kind: "pdf",
                              })
                            }
                          >
                            Shiko
                          </Button>
                          <Button variant="secondary" size="sm" asChild>
                            <a href={`/api/dokumentet/artifacts/${doc.id}/pdf`}>PDF</a>
                          </Button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ))}

      <div className="space-y-3 md:hidden">
        {merged.map((item, idx) =>
          item.k === "artifact" ? (
            <Link
              key={`${item.a.id}-${idx}`}
              href={`/dokumentet/${item.a.id}`}
              className="block rounded-xl border border-line bg-white p-4 shadow-card"
            >
              <p className="text-[13.5px] font-semibold text-ink-900">{item.a.title}</p>
              <p className="mt-1 text-xs text-ink-500">
                {DOCUMENT_CATEGORY_LABELS[item.a.documentCategory]} ·{" "}
                {item.a.kind === "PREVIEW" ? "Parapamje" : "Final"}
                {item.a.isArchived ? " · Arkiv" : ""}
              </p>
              <p className="mt-1 text-xs text-ink-500">{item.a.templateName}</p>
              <p className="mt-2 text-[11px] tabular-nums text-ink-400">
                {new Date(item.a.createdAtIso).toLocaleString("sq-AL")}
              </p>
            </Link>
          ) : (
            <a
              key={`${item.p.id}-${idx}`}
              href={`/api/payroll-documents/${item.p.id}`}
              className="block rounded-xl border border-line bg-white p-4 shadow-card"
            >
              <p className="text-[13.5px] font-semibold text-ink-900">PDF pagë</p>
              <p className="mt-1 text-xs text-ink-500">{item.p.periodLabel}</p>
              <p className="mt-1 font-mono text-xs text-ink-700">{item.p.filename}</p>
              <p className="mt-2 text-[11px] tabular-nums text-ink-400">
                {new Date(item.p.generatedAtIso).toLocaleString("sq-AL")}
              </p>
            </a>
          ),
        )}
      </div>

      <SectionCard
        className="hidden md:block"
        title="Historia dokumenteve"
        description="Bashkim kronologjik: Dokumentet + fletëpagesat nga payroll-i."
        flush
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-line-soft bg-fill-faint">
                <th className={TH}>Burimi</th>
                <th className={TH}>Përshkrimi</th>
                <th className={TH}>Data</th>
                <th className={cn(TH, "text-right")}>Veprim</th>
              </tr>
            </thead>
            <tbody>
              {merged.map((item, idx) =>
                item.k === "artifact" ? (
                  <tr
                    key={`${item.a.id}-${idx}`}
                    className="border-b border-fill transition-colors last:border-0 hover:bg-fill-faint"
                  >
                    <td className={TD}>Dokumentet</td>
                    <td className={TD}>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-ink-900">{item.a.title}</span>
                        <span className="text-xs text-ink-500">
                          {DOCUMENT_CATEGORY_LABELS[item.a.documentCategory]} · {item.a.templateName}
                        </span>
                      </div>
                    </td>
                    <td className={cn(TD, "whitespace-nowrap text-xs tabular-nums text-ink-500")}>
                      {new Date(item.a.createdAtIso).toLocaleString("sq-AL")}
                    </td>
                    <td className={cn(TD, "text-right")}>
                      <Button variant="secondary" size="sm" asChild>
                        <Link href={`/dokumentet/${item.a.id}`}>Hap</Link>
                      </Button>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={`${item.p.id}-${idx}`}
                    className="border-b border-fill transition-colors last:border-0 hover:bg-fill-faint"
                  >
                    <td className={TD}>Payroll PDF</td>
                    <td className={TD}>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-ink-900">{item.p.periodLabel}</span>
                        <span className="font-mono text-xs text-ink-500">{item.p.filename}</span>
                      </div>
                    </td>
                    <td className={cn(TD, "whitespace-nowrap text-xs tabular-nums text-ink-500")}>
                      {new Date(item.p.generatedAtIso).toLocaleString("sq-AL")}
                    </td>
                    <td className={cn(TD, "space-x-2 text-right")}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setQuickView({
                            url: `/api/payroll-documents/${item.p.id}?inline=1`,
                            downloadUrl: `/api/payroll-documents/${item.p.id}`,
                            title: `PDF pagë · ${item.p.periodLabel}`,
                            kind: "pdf",
                          })
                        }
                      >
                        Shiko
                      </Button>
                      <Button variant="secondary" size="sm" asChild>
                        <a href={`/api/payroll-documents/${item.p.id}`}>Shkarko</a>
                      </Button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
      <DocumentQuickView target={quickView} onClose={() => setQuickView(null)} />
    </div>
  );
}

function LeaveTab({ bundle }: { bundle?: EmployeeLeaveBundle }) {
  const balances = bundle ? sortBalancesForDisplay(bundle.balances) : [];
  const requests = bundle?.requests ?? [];

  if (balances.length === 0 && requests.length === 0) {
    return (
      <SectionCard title="Pushimet" description="Kërkesat dhe bilanci i lejeve.">
        <p className="text-[13px] text-ink-500">
          Asnjë kërkesë pushimi dhe asnjë bilanc i llogaritur për këtë punonjës. Kërkesat krijohen te{" "}
          <Link href="/pushimet" className="font-medium text-brand-blue hover:underline">
            Pushimet
          </Link>
          .
        </p>
      </SectionCard>
    );
  }

  const typeLabel = (t: string) => (LEAVE_TYPE_LABELS_SQ as Record<string, string>)[t] ?? t;
  const subtypeLabel = (s: string) => (LEAVE_SUBTYPE_LABELS_SQ as Record<string, string>)[s] ?? null;

  return (
    <div className="space-y-5">
      {balances.length > 0 ? (
        <SectionCard
          title={`Bilanci ${bundle?.year ?? ""}`.trim()}
          description="Vetëm llojet me kuotë vjetore mbajnë bilanc."
        >
          <ul className="space-y-2">
            {balances.map((b) => (
              <li key={b.leaveType} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
                <span className="min-w-[132px] font-semibold text-ink-900">{typeLabel(b.leaveType)}</span>
                <span className="tabular-nums text-ink-600">{balanceLineSegments(b).join(" · ")}</span>
                {b.carryExpiresAtIso ? (
                  <span className="text-xs text-ink-400">bartja skadon {formatSqDate(b.carryExpiresAtIso)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard title="Kërkesat" description="Kronologjikisht, më e fundit sipër." flush>
        {requests.length === 0 ? (
          <EmptySection icon={CalendarDays} title="Asnjë kërkesë pushimi" hint="Kërkesat e pushimit krijohen te moduli Pushimet dhe shfaqen këtu me statusin e tyre." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-line-soft bg-fill-faint">
                  <th className={TH}>Lloji</th>
                  <th className={TH}>Fillimi</th>
                  <th className={TH}>Mbarimi</th>
                  <th className={cn(TH, "text-right")}>Ditë</th>
                  <th className={TH}>Statusi</th>
                  <th className={cn(TH, "text-right")}>&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-fill transition-colors last:border-0 hover:bg-fill-faint"
                  >
                    <td className={TD}>
                      <div className="flex flex-col">
                        <span className="font-medium text-ink-900">{typeLabel(r.type)}</span>
                        {r.subtype !== "NONE" && subtypeLabel(r.subtype) ? (
                          <span className="text-xs text-ink-500">{subtypeLabel(r.subtype)}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className={cn(TD, "whitespace-nowrap tabular-nums")}>{formatSqDate(r.startIso)}</td>
                    <td className={cn(TD, "whitespace-nowrap tabular-nums")}>{formatSqDate(r.endIso)}</td>
                    <td className={cn(TD, "text-right tabular-nums text-ink-600")}>
                      {r.days === null ? "—" : fmtDays(r.days)}
                    </td>
                    <td className={TD}>
                      <LeaveStatusBadge status={r.status as Parameters<typeof LeaveStatusBadge>[0]["status"]} />
                    </td>
                    <td className={cn(TD, "text-right")}>
                      <Link
                        href={`/pushimet/${r.id}`}
                        className="text-[12.5px] font-medium text-brand-blue hover:underline"
                      >
                        Shiko
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export interface EmployeeTimelineEntry {
  id: string;
  occurredAtIso: string;
  /** Pre-rendered on the server — toLocaleString in the client would drift with the viewer's locale. */
  occurredAtLabel: string;
  eventType: string;
  title: string;
  body: string | null;
  severity: "INFO" | "WARNING" | "CRITICAL" | null;
  actorName: string | null;
}

const TIMELINE_DOT: Record<"INFO" | "WARNING" | "CRITICAL", string> = {
  INFO: "bg-[#2563eb]",
  WARNING: "bg-[#d97706]",
  CRITICAL: "bg-[#dc2626]",
};

function TimelineTab({ entries }: { entries?: EmployeeTimelineEntry[] }) {
  const rows = entries ?? [];
  if (rows.length === 0) {
    return (
      <SectionCard title="Timeline" description="Ngjarjet operative dhe auditimi.">
        <p className="text-[13px] text-ink-500">
          Asnjë ngjarje e regjistruar për këtë punonjës deri tani. Ngjarjet shtohen automatikisht nga
          kontratat, pushimet, pagat dhe ndryshimet e profilit.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Timeline" description="Ngjarjet operative dhe auditimi — më e fundit sipër." flush>
      <ol className="divide-y divide-fill">
        {rows.map((e) => (
          <li key={e.id} className="flex gap-3 px-5 py-3">
            <span
              className={cn(
                "mt-[7px] h-2 w-2 shrink-0 rounded-full",
                e.severity ? TIMELINE_DOT[e.severity] : "bg-ink-300",
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="text-[13px] font-semibold text-ink-900">{e.title}</span>
                <span className="text-xs tabular-nums text-ink-400">{e.occurredAtLabel}</span>
              </div>
              {e.body ? <p className="mt-0.5 text-[12.5px] leading-snug text-ink-500">{e.body}</p> : null}
              {e.actorName ? <p className="mt-0.5 text-xs text-ink-400">nga {e.actorName}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

const STATUS_TONE: Record<EmploymentStatus, "success" | "warning" | "destructive" | "neutral"> = {
  ACTIVE: "success",
  ON_LEAVE: "warning",
  SUSPENDED: "warning",
  TERMINATED: "destructive",
  INACTIVE: "neutral",
};

export function EmployeeProfileShell(props: {
  employee: EmployeeDetailDto;
  departments: DepartmentOptionDto[];
  jobTitles: JobTitleOptionDto[];
  documentCenter?: EmployeeProfileDocumentsBundle;
  dossier?: EmployeeDossierBundle;
  todayIso?: string;
  leaveCenter?: EmployeeLeaveBundle;
  timelineEntries?: EmployeeTimelineEntry[];
  openEditDocuments?: boolean;
  timeClockEnabled?: boolean;
}) {
  const {
    employee: initial,
    departments,
    jobTitles,
    documentCenter,
    dossier,
    todayIso,
    leaveCenter,
    timelineEntries,
    openEditDocuments = false,
    timeClockEnabled = false,
  } = props;
  const router = useRouter();
  const [employee, setEmployee] = useState(initial);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    setEmployee(initial);
  }, [initial]);

  /**
   * Two separate reasons a profile may be uneditable, kept apart on purpose.
   * `canEdit` is about the employee — a terminated profile is closed to
   * everyone. `mayEdit` adds "and this member is allowed to". Folding them
   * together would print "Profili është i mbyllur (i larguar)" at a read-only
   * member looking at a perfectly active employee.
   */
  /**
   * Terminated profiles stay editable — corrections to personal data, bank
   * details and documents are normal after a departure. The service pins the
   * status, so an edit can never quietly reactivate someone; "Rikthe në punë"
   * remains the only path back.
   */
  const isTerminated = employee.status === "TERMINATED";
  const canWriteEmployees = useCan("employees.write");
  const canWriteDocumentsTab = useCan("documents.write");
  const mayEdit = canWriteEmployees;

  useEffect(() => {
    if (!openEditDocuments || !mayEdit) return;
    setSheetOpen(true);
  }, [openEditDocuments, mayEdit]);

  useEffect(() => {
    if (!sheetOpen || !openEditDocuments) return;
    const timer = window.setTimeout(() => {
      document.getElementById("documents-missing-flag")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [sheetOpen, openEditDocuments]);

  const reload = async () => {
    const d = await getEmployeeDetailAction(employee.id);
    if (d) setEmployee(d);
    router.refresh();
  };

  const bundle: EmployeeProfileDocumentsBundle = documentCenter ?? {
    employeeId: employee.id,
    generatedDocuments: [],
    payrollPdfs: [],
    contracts: [],
  };
  bundle.employeeId ??= employee.id;

  const statusTone = STATUS_TONE[employee.status] ?? "neutral";

  const metaLine = [
    employee.jobTitle,
    employee.departmentName,
    `Punësuar ${formatSqDate(employee.hireDate)}`,
    `Nr. personal ${employee.personalId}`,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  return (
    <SalaryVisibilityProvider>
      <AppSubBar
        dense
        backHref="/punonjesit"
        backLabel="Punonjësit"
        title={`${employee.firstName} ${employee.lastName}`}
        status={
          <>
            <SubBarStatus tone={statusTone}>{EMPLOYMENT_STATUS_LABELS[employee.status]}</SubBarStatus>
            <SubBarStatus tone="neutral">{EMPLOYMENT_TYPE_LABELS[employee.employmentType]}</SubBarStatus>
          </>
        }
        description={isTerminated ? `${metaLine} — I larguar; statusi ndryshohet vetëm me rikthim në punë.` : metaLine}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SalaryVisibilityToggle />
            {mayEdit && isTerminated ? <RehireControl employeeId={employee.id} onDone={reload} /> : null}
            {mayEdit ? (
              <Button type="button" onClick={() => setSheetOpen(true)}>
                Ndrysho profilin
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="space-y-5 pb-24 md:pb-8">
        {employee.documentsMissing ? (
          <div className="flex flex-col gap-3 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3.5 shadow-[inset_3px_0_0_#d97706] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#d97706]" aria-hidden />
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-ink-900">Dokumentacion i paplotë</p>
                <p className="text-xs text-ink-500">
                  Ky punonjës është shënuar me dokumentacion të paplotë. Përditësoni statusin ose ngarkoni dokumentet
                  e nevojshme.
                </p>
              </div>
            </div>
            {mayEdit ? (
              <Button
                type="button"
                variant="outlinePrimary"
                size="sm"
                className="shrink-0"
                onClick={() => setSheetOpen(true)}
              >
                Rregullo dokumentacionin
              </Button>
            ) : null}
          </div>
        ) : null}

        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-[10px] border-line bg-fill-hover p-1">
            <TabsTrigger className={TAB_TRIGGER} value="summary">
              Përmbledhje
            </TabsTrigger>
            <TabsTrigger className={TAB_TRIGGER} value="payroll">
              Pagat
            </TabsTrigger>
            <TabsTrigger className={TAB_TRIGGER} value="contracts">
              Kontratat
            </TabsTrigger>
            <TabsTrigger className={TAB_TRIGGER} value="documents">
              Dokumentet
            </TabsTrigger>
            <TabsTrigger className={TAB_TRIGGER} value="leave">
              Pushimet
            </TabsTrigger>
            {timeClockEnabled ? (
              <TabsTrigger className={TAB_TRIGGER} value="prezenca">
                Prezenca
              </TabsTrigger>
            ) : null}
            <TabsTrigger className={TAB_TRIGGER} value="warnings">
              Vërejtjet
            </TabsTrigger>
            <TabsTrigger className={TAB_TRIGGER} value="timeline">
              Timeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-5">
            <SummaryTab e={employee} timeClockEnabled={timeClockEnabled} />
          </TabsContent>
          <TabsContent value="payroll" className="mt-5">
            <SalaryHistoryCard rows={employee.salaryHistory} />
          </TabsContent>
          <TabsContent value="contracts" className="mt-5 space-y-5">
            <AnnexPanel employeeId={employee.id} canEdit={mayEdit} />
            <ContractsTab rows={bundle.contracts} />
          </TabsContent>
          <TabsContent value="documents" className="mt-5">
            <div className="space-y-5">
              {dossier ? (
                <SectionCard
                  title="Dosja e punonjësit"
                  description="Dokumentet e ngarkuara — identifikim, kontrata të nënshkruara, kualifikime."
                  action={
                    canWriteDocumentsTab ? (
                      <EmployeeDocumentUploadDialog
                        employeeId={dossier.employeeId}
                        canSeeSensitive={dossier.viewerSeesSensitive}
                      />
                    ) : null
                  }
                >
                  <EmployeeDocumentsFolders
                    bundle={dossier}
                    todayIso={todayIso ?? new Date().toISOString()}
                  />
                </SectionCard>
              ) : null}
              <DocumentsCenterTab {...bundle} />
            </div>
          </TabsContent>
          <TabsContent value="leave" className="mt-5">
            <LeaveTab bundle={leaveCenter} />
          </TabsContent>
          {timeClockEnabled ? (
            <TabsContent value="prezenca" className="mt-5">
              <EmployeePresencePanel employeeId={employee.id} />
            </TabsContent>
          ) : null}
          <TabsContent value="warnings" className="mt-5">
            <WarningsPanel employeeId={employee.id} canEdit={mayEdit} />
          </TabsContent>
          <TabsContent value="timeline" className="mt-5">
            <TimelineTab entries={timelineEntries} />
          </TabsContent>
        </Tabs>

        {mayEdit ? (
          <EmployeeFormSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            mode="edit"
            employeeId={employee.id}
            initialDetail={employee}
            departments={departments}
            jobTitles={jobTitles}
            timeClockEnabled={timeClockEnabled}
            onSuccess={() => void reload()}
          />
        ) : null}
      </div>
    </SalaryVisibilityProvider>
  );
}

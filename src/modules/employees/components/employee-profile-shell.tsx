"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DocumentCategory, EmploymentStatus } from "@prisma/client";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { AppSubBar, SubBarStatus } from "@/components/layout/app-sub-bar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getEmployeeDetailAction, rehireEmployeeAction } from "@/modules/employees/actions/employee-actions";
import type { DepartmentOptionDto, EmployeeDetailDto, JobTitleOptionDto, SalaryChangeDto } from "@/modules/employees/types";
import { EmployeeFormSheet } from "@/modules/employees/components/employee-form-sheet";
import { AnnexPanel } from "@/modules/annex/components/annex-panel";
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

export interface EmployeeContractSummary {
  id: string;
  status: string;
  referenceCode: string | null;
  effectiveDateIso: string;
}

export interface EmployeeProfileDocumentsBundle {
  employeeId?: string;
  generatedDocuments: EmployeeGeneratedDocSummary[];
  payrollPdfs: EmployeePayrollPdfSummary[];
  contracts: EmployeeContractSummary[];
}

/* ---------------------------------- 1b design primitives (local) ---------------------------------- */

const TH =
  "h-9 whitespace-nowrap px-4 text-left align-middle text-[11px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]";
const TD = "px-4 py-2.5 align-middle text-[13px] text-[#334155]";

const TAB_TRIGGER =
  "rounded-lg px-3.5 py-1.5 text-[13px] font-medium text-[#64748b] transition-colors hover:text-[#0f172a] data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-[#0f172a] data-[state=active]:shadow-[0_1px_3px_rgba(15,23,42,0.08)]";

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
        "overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]",
        className,
      )}
    >
      {title || action ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef2f7] px-5 py-3.5">
          <div className="min-w-0">
            <h3 className="text-[13.5px] font-semibold tracking-[-0.01em] text-[#0f172a]">{title}</h3>
            {description ? <p className="mt-0.5 text-[12px] text-[#64748b]">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={flush ? undefined : "px-5 py-4"}>{children}</div>
    </section>
  );
}

function EmptyTab({ title, body }: { title: string; body: string }) {
  return (
    <SectionCard title={title} description={body}>
      <p className="text-[13px] text-[#64748b]">Nuk ka të dhëna për momentin.</p>
    </SectionCard>
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
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Data e rikthimit</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <Button type="button" disabled={busy} onClick={() => void submit()}>
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
    <div className="flex flex-col gap-0.5 border-b border-[#f1f5f9] pb-2.5 last:border-0 last:pb-0">
      <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#94a3b8]">{label}</span>
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
        <p className="text-[13px] text-[#64748b]">Nuk ka ndryshime të regjistruara të pagës.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b border-[#eef2f7] bg-[#f8fafc]">
                <th className={TH}>Data efektive</th>
                <th className={cn(TH, "text-right")}>Nga</th>
                <th className={cn(TH, "text-right")}>Në</th>
                <th className={TH}>Arsyeja</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#f1f5f9] transition-colors last:border-0 hover:bg-[#f8fafc]">
                  <td className={cn(TD, "whitespace-nowrap tabular-nums")}>{formatSqDate(r.effectiveFromIso)}</td>
                  <td className={cn(TD, "text-right tabular-nums text-[#64748b]")}>
                    {r.previousBaseSalary ? formatEur(r.previousBaseSalary) : "—"}
                  </td>
                  <td className={cn(TD, "text-right font-semibold tabular-nums text-[#0f172a]")}>
                    {formatEur(r.newBaseSalary)}
                  </td>
                  <td className={cn(TD, "text-[#64748b]")}>{r.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function SummaryTab({ e }: { e: EmployeeDetailDto }) {
  const ec = e.emergencyContact;
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* Left rail */}
      <div className="grid gap-4">
        <SectionCard title="Pagat & banka">
          <div className="mb-4 rounded-[10px] bg-[#f8fafc] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#94a3b8]">Paga bruto mujore</p>
            <p className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-0.02em] tabular-nums text-[#0f172a]">
              {formatEur(e.baseSalaryMonthly)}
            </p>
          </div>
          <div className="grid gap-2.5">
            <Row label="Orët javore" value={e.weeklyHours} className="tabular-nums" />
            <Row label="Banka" value={e.bankName ?? "—"} />
            <Row label="Numri i llogarisë" value={e.bankAccountIban ?? "—"} className="font-mono text-xs" />
            <Row label="Apliko Trustin" value={e.applyTrust ? "Po" : "Jo"} />
            <Row label="Apliko tatimin" value={e.applyTax ? "Po" : "Jo"} />
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
      <SectionCard title="Kontratat" description="Regjistrimi i kontratave në sistem.">
        <p className="text-[13px] text-[#64748b]">Nuk ka kontrata të regjistruara.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Kontratat" description="Kronologjikisht sipas datës së efektshme." flush>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px]">
          <thead>
            <tr className="border-b border-[#eef2f7] bg-[#f8fafc]">
              <th className={TH}>Referenca</th>
              <th className={TH}>Statusi</th>
              <th className={TH}>Efektive nga</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-[#f1f5f9] transition-colors last:border-0 hover:bg-[#f8fafc]">
                <td className={cn(TD, "font-mono text-xs")}>{c.referenceCode ?? c.id.slice(0, 10)}</td>
                <td className={TD}>{c.status}</td>
                <td className={cn(TD, "whitespace-nowrap tabular-nums")}>{formatSqDate(c.effectiveDateIso)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function DocumentsCenterTab(bundle: EmployeeProfileDocumentsBundle) {
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
    for (const p of bundle.payrollPdfs) {
      out.push({ k: "payroll", t: Date.parse(p.generatedAtIso), p });
    }
    out.sort((x, y) => y.t - x.t);
    return out;
  }, [bundle.generatedDocuments, bundle.payrollPdfs]);

  if (merged.length === 0) {
    return (
      <SectionCard
        title="Dokumentet"
        description="Dokumentet e gjeneruara nga moduli Dokumentet dhe PDF nga payroll-i."
        action={
          bundle.employeeId ? (
            <Button size="sm" asChild>
              <Link href={`/dokumentet/generate?category=CONTRACT&employeeId=${bundle.employeeId}`}>
                Gjenero dokument
              </Link>
            </Button>
          ) : null
        }
      >
        <p className="text-[13px] text-[#64748b]">Nuk ka dokumente për këtë punonjës.</p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      {bundle.employeeId ? (
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
                <tr className="border-b border-[#eef2f7] bg-[#f8fafc]">
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
                    className="border-b border-[#f1f5f9] transition-colors last:border-0 hover:bg-[#f8fafc]"
                  >
                    <td className={TD}>
                      <Link
                        href={`/dokumentet/${doc.id}`}
                        className="font-semibold text-[#0f172a] hover:text-brand-blue"
                      >
                        {doc.title}
                      </Link>
                      {doc.isArchived ? (
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.05em] text-[#94a3b8]">
                          Arkiv
                        </span>
                      ) : null}
                    </td>
                    <td className={TD}>
                      {doc.templateName} v{doc.templateVersionNumber}
                    </td>
                    <td className={cn(TD, "whitespace-nowrap tabular-nums text-[#64748b]")}>{doc.createdAtLabel}</td>
                    <td className={cn(TD, "space-x-2 text-right")}>
                      <Button variant="secondary" size="sm" asChild>
                        <a href={`/api/dokumentet/artifacts/${doc.id}/docx`}>DOCX</a>
                      </Button>
                      {doc.hasPdf ? (
                        <Button variant="secondary" size="sm" asChild>
                          <a href={`/api/dokumentet/artifacts/${doc.id}/pdf`}>PDF</a>
                        </Button>
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
              className="block rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
            >
              <p className="text-[13.5px] font-semibold text-[#0f172a]">{item.a.title}</p>
              <p className="mt-1 text-xs text-[#64748b]">
                {DOCUMENT_CATEGORY_LABELS[item.a.documentCategory]} ·{" "}
                {item.a.kind === "PREVIEW" ? "Parapamje" : "Final"}
                {item.a.isArchived ? " · Arkiv" : ""}
              </p>
              <p className="mt-1 text-xs text-[#64748b]">{item.a.templateName}</p>
              <p className="mt-2 text-[11px] tabular-nums text-[#94a3b8]">
                {new Date(item.a.createdAtIso).toLocaleString("sq-AL")}
              </p>
            </Link>
          ) : (
            <a
              key={`${item.p.id}-${idx}`}
              href={`/api/payroll-documents/${item.p.id}`}
              className="block rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
            >
              <p className="text-[13.5px] font-semibold text-[#0f172a]">PDF pagë</p>
              <p className="mt-1 text-xs text-[#64748b]">{item.p.periodLabel}</p>
              <p className="mt-1 font-mono text-xs text-[#334155]">{item.p.filename}</p>
              <p className="mt-2 text-[11px] tabular-nums text-[#94a3b8]">
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
              <tr className="border-b border-[#eef2f7] bg-[#f8fafc]">
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
                    className="border-b border-[#f1f5f9] transition-colors last:border-0 hover:bg-[#f8fafc]"
                  >
                    <td className={TD}>Dokumentet</td>
                    <td className={TD}>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-[#0f172a]">{item.a.title}</span>
                        <span className="text-xs text-[#64748b]">
                          {DOCUMENT_CATEGORY_LABELS[item.a.documentCategory]} · {item.a.templateName}
                        </span>
                      </div>
                    </td>
                    <td className={cn(TD, "whitespace-nowrap text-xs tabular-nums text-[#64748b]")}>
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
                    className="border-b border-[#f1f5f9] transition-colors last:border-0 hover:bg-[#f8fafc]"
                  >
                    <td className={TD}>Payroll PDF</td>
                    <td className={TD}>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-[#0f172a]">{item.p.periodLabel}</span>
                        <span className="font-mono text-xs text-[#64748b]">{item.p.filename}</span>
                      </div>
                    </td>
                    <td className={cn(TD, "whitespace-nowrap text-xs tabular-nums text-[#64748b]")}>
                      {new Date(item.p.generatedAtIso).toLocaleString("sq-AL")}
                    </td>
                    <td className={cn(TD, "text-right")}>
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
    </div>
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
  openEditDocuments?: boolean;
}) {
  const { employee: initial, departments, jobTitles, documentCenter, openEditDocuments = false } = props;
  const router = useRouter();
  const [employee, setEmployee] = useState(initial);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    setEmployee(initial);
  }, [initial]);

  const canEdit = employee.status !== "TERMINATED";

  useEffect(() => {
    if (!openEditDocuments || !canEdit) return;
    setSheetOpen(true);
  }, [openEditDocuments, canEdit]);

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
    <>
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
        description={canEdit ? metaLine : `${metaLine} — Profili është i mbyllur (i larguar).`}
        actions={
          canEdit ? (
            <Button type="button" onClick={() => setSheetOpen(true)}>
              Ndrysho profilin
            </Button>
          ) : (
            <RehireControl employeeId={employee.id} onDone={reload} />
          )
        }
      />

      <div className="space-y-5 pb-24 md:pb-8">
        {employee.documentsMissing ? (
          <div className="flex flex-col gap-3 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3.5 shadow-[inset_3px_0_0_#d97706] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#d97706]" aria-hidden />
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-[#0f172a]">Dokumentacion i paplotë</p>
                <p className="text-xs text-[#64748b]">
                  Ky punonjës është shënuar me dokumentacion të paplotë. Përditësoni statusin ose ngarkoni dokumentet
                  e nevojshme.
                </p>
              </div>
            </div>
            {canEdit ? (
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
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-[10px] border-[#e2e8f0] bg-[#eef2f7] p-1">
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
            <TabsTrigger className={TAB_TRIGGER} value="warnings">
              Vërejtjet
            </TabsTrigger>
            <TabsTrigger className={TAB_TRIGGER} value="timeline">
              Timeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-5">
            <SummaryTab e={employee} />
          </TabsContent>
          <TabsContent value="payroll" className="mt-5">
            <SalaryHistoryCard rows={employee.salaryHistory} />
          </TabsContent>
          <TabsContent value="contracts" className="mt-5 space-y-5">
            <AnnexPanel employeeId={employee.id} canEdit={canEdit} />
            <ContractsTab rows={bundle.contracts} />
          </TabsContent>
          <TabsContent value="documents" className="mt-5">
            <DocumentsCenterTab {...bundle} />
          </TabsContent>
          <TabsContent value="leave" className="mt-5">
            <EmptyTab title="Pushimet" body="Kërkesat dhe bilanci i lejeve." />
          </TabsContent>
          <TabsContent value="warnings" className="mt-5">
            <EmptyTab title="Vërejtjet" body="Disiplina dhe vërejtjet formale." />
          </TabsContent>
          <TabsContent value="timeline" className="mt-5">
            <EmptyTab title="Timeline" body="Ngjarjet operative dhe auditimi." />
          </TabsContent>
        </Tabs>

        {canEdit ? (
          <EmployeeFormSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            mode="edit"
            employeeId={employee.id}
            initialDetail={employee}
            departments={departments}
            jobTitles={jobTitles}
            onSuccess={() => void reload()}
          />
        ) : null}
      </div>
    </>
  );
}

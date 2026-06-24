"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DocumentCategory } from "@prisma/client";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getEmployeeDetailAction } from "@/modules/employees/actions/employee-actions";
import type { DepartmentOptionDto, EmployeeDetailDto } from "@/modules/employees/types";
import { EmployeeFormSheet } from "@/modules/employees/components/employee-form-sheet";
import {
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

function EmptyTab({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Nuk ka të dhëna për momentin.</p>
      </CardContent>
    </Card>
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
    <div className="flex flex-col gap-0.5 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={cn("text-foreground", className)}>{value}</span>
    </div>
  );
}

function SummaryTab({ e }: { e: EmployeeDetailDto }) {
  const ec = e.emergencyContact;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personale</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <Row label="Emri" value={`${e.firstName} ${e.lastName}`} />
          <Row label="Numri personal" value={e.personalId} />
          <Row label="Data e lindjes" value={formatSqDate(e.dateOfBirth)} />
          <Row label="Gjinia" value={e.gender ? GENDER_LABELS[e.gender] : "—"} />
          <Row label="Telefoni" value={e.phone ?? "—"} />
          <Row label="Email" value={e.email ?? "—"} />
          <Row label="Adresa" value={e.addressLine ?? "—"} />
          <Row label="Qyteti" value={e.addressCity ?? "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Punësimi</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <Row
            label="Statusi"
            value={<EmployeeStatusBadge status={e.status} employmentType={e.employmentType} />}
          />
          <Row label="Lloji" value={<EmployeeTypeBadge employmentType={e.employmentType} />} />
          <Row label="Lloji i punës" value={WORK_ARRANGEMENT_LABELS[e.workArrangement]} />
          <Row label="Pozita" value={e.jobTitle ?? "—"} />
          <Row label="Departamenti" value={e.departmentName ?? "—"} />
          <Row label="Data e punësimit" value={formatSqDate(e.hireDate)} />
          <Row label="Data e largimit" value={formatSqDate(e.terminationDate)} />
          <Row label="Arsyeja e largimit" value={e.terminationReason ?? "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pagat & banka</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <Row label="Paga bruto" value={formatEur(e.baseSalaryMonthly)} />
          <Row label="Orët javore" value={e.weeklyHours} />
          <Row label="Banka" value={e.bankName ?? "—"} />
          <Row label="IBAN" value={e.bankAccountIban ?? "—"} className="font-mono text-xs" />
          <Row label="Apliko Trustin" value={e.applyTrust ? "Po" : "Jo"} />
          <Row label="Apliko tatimin" value={e.applyTax ? "Po" : "Jo"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kontakti emergjent</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <Row label="Emri" value={ec?.fullName ?? "—"} />
          <Row label="Telefoni" value={ec?.phone ?? "—"} />
          <Row label="Raporti" value={ec?.relationship ?? "—"} />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Shtesë</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <Row label="Shënime të brendshme" value={e.internalNotes ?? "—"} />
          <Row label="Dokumente mungojnë" value={e.documentsMissing ? "Po" : "Jo"} />
        </CardContent>
      </Card>
    </div>
  );
}

function ContractsTab({ rows }: { rows: EmployeeContractSummary[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kontratat</CardTitle>
          <CardDescription>Regjistrimi i kontratave në sistem.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nuk ka kontrata të regjistruara.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kontratat</CardTitle>
        <CardDescription>Kronologjikisht sipas datës së efektshme.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referenca</TableHead>
              <TableHead>Statusi</TableHead>
              <TableHead>Efektive nga</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.referenceCode ?? c.id.slice(0, 10)}</TableCell>
                <TableCell className="text-sm">{c.status}</TableCell>
                <TableCell className="text-sm">{formatSqDate(c.effectiveDateIso)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Dokumentet</CardTitle>
              <CardDescription>Dokumentet e gjeneruara nga moduli Dokumentet dhe PDF nga payroll-i.</CardDescription>
            </div>
            {bundle.employeeId ? (
              <Button size="sm" asChild>
                <Link href={`/dokumentet/generate?category=CONTRACT&employeeId=${bundle.employeeId}`}>
                  Gjenero dokument
                </Link>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nuk ka dokumente për këtë punonjës.</p>
        </CardContent>
      </Card>
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
        <Card key={cat}>
          <CardHeader>
            <CardTitle className="text-base">{DOCUMENT_CATEGORY_LABELS[cat]}</CardTitle>
            <CardDescription>{docs.length} dokument(e)</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titulli</TableHead>
                  <TableHead>Shablloni</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Shkarko</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <Link href={`/dokumentet/${doc.id}`} className="font-medium hover:underline">
                        {doc.title}
                      </Link>
                      {doc.isArchived ? (
                        <span className="ml-2 text-[10px] uppercase text-muted-foreground">Arkiv</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      {doc.templateName} v{doc.templateVersionNumber}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{doc.createdAtLabel}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="secondary" size="sm" asChild>
                        <a href={`/api/dokumentet/artifacts/${doc.id}/docx`}>DOCX</a>
                      </Button>
                      {doc.hasPdf ? (
                        <Button variant="secondary" size="sm" asChild>
                          <a href={`/api/dokumentet/artifacts/${doc.id}/pdf`}>PDF</a>
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <div className="md:hidden space-y-3">
        {merged.map((item, idx) =>
          item.k === "artifact" ? (
            <Link
              key={`${item.a.id}-${idx}`}
              href={`/dokumentet/${item.a.id}`}
              className="block rounded-lg border border-border bg-card p-4"
            >
              <p className="font-medium">{item.a.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {DOCUMENT_CATEGORY_LABELS[item.a.documentCategory]} ·{" "}
                {item.a.kind === "PREVIEW" ? "Parapamje" : "Final"}
                {item.a.isArchived ? " · Arkiv" : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{item.a.templateName}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {new Date(item.a.createdAtIso).toLocaleString("sq-AL")}
              </p>
            </Link>
          ) : (
            <a
              key={`${item.p.id}-${idx}`}
              href={`/api/payroll-documents/${item.p.id}`}
              className="block rounded-lg border border-border bg-card p-4"
            >
              <p className="font-medium">PDF pagë</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.p.periodLabel}</p>
              <p className="mt-1 text-xs font-mono">{item.p.filename}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {new Date(item.p.generatedAtIso).toLocaleString("sq-AL")}
              </p>
            </a>
          ),
        )}
      </div>

      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle className="text-base">Historia dokumenteve</CardTitle>
          <CardDescription>Bashkim kronologjik: Dokumentet + fletëpagesat nga payroll-i.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Burimi</TableHead>
                <TableHead>Përshkrimi</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Veprim</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {merged.map((item, idx) =>
                item.k === "artifact" ? (
                  <TableRow key={`${item.a.id}-${idx}`}>
                    <TableCell className="text-sm">Dokumentet</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{item.a.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {DOCUMENT_CATEGORY_LABELS[item.a.documentCategory]} · {item.a.templateName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(item.a.createdAtIso).toLocaleString("sq-AL")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="secondary" size="sm" asChild>
                        <Link href={`/dokumentet/${item.a.id}`}>Hap</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={`${item.p.id}-${idx}`}>
                    <TableCell className="text-sm">Payroll PDF</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{item.p.periodLabel}</span>
                        <span className="text-xs font-mono text-muted-foreground">{item.p.filename}</span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(item.p.generatedAtIso).toLocaleString("sq-AL")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="secondary" size="sm" asChild>
                        <a href={`/api/payroll-documents/${item.p.id}`}>Shkarko</a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function EmployeeProfileShell(props: {
  employee: EmployeeDetailDto;
  departments: DepartmentOptionDto[];
  documentCenter?: EmployeeProfileDocumentsBundle;
}) {
  const { employee: initial, departments, documentCenter } = props;
  const router = useRouter();
  const [employee, setEmployee] = useState(initial);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    setEmployee(initial);
  }, [initial]);

  const reload = async () => {
    const d = await getEmployeeDetailAction(employee.id);
    if (d) setEmployee(d);
    router.refresh();
  };

  const canEdit = employee.status !== "TERMINATED";

  const bundle: EmployeeProfileDocumentsBundle = documentCenter ?? {
    employeeId: employee.id,
    generatedDocuments: [],
    payrollPdfs: [],
    contracts: [],
  };
  bundle.employeeId ??= employee.id;

  return (
    <div className="space-y-6 pb-24 md:pb-8">
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <Button variant="ghost" size="sm" className="-ml-2 h-8 px-2 text-muted-foreground" asChild>
            <Link href="/punonjesit">
              <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
              Kthehu te lista
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {employee.firstName} {employee.lastName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <EmployeeStatusBadge status={employee.status} employmentType={employee.employmentType} />
              <span className="text-sm text-muted-foreground">{EMPLOYMENT_TYPE_LABELS[employee.employmentType]}</span>
            </div>
          </div>
        </div>
        {canEdit ? (
          <Button type="button" onClick={() => setSheetOpen(true)}>
            Ndrysho profilin
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Profili është i mbyllur (i larguar).</p>
        )}
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="summary">Përmbledhje</TabsTrigger>
          <TabsTrigger value="payroll">Pagat</TabsTrigger>
          <TabsTrigger value="contracts">Kontratat</TabsTrigger>
          <TabsTrigger value="documents">Dokumentet</TabsTrigger>
          <TabsTrigger value="leave">Pushimet</TabsTrigger>
          <TabsTrigger value="warnings">Vërejtjet</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-6">
          <SummaryTab e={employee} />
        </TabsContent>
        <TabsContent value="payroll" className="mt-6">
          <EmptyTab title="Pagat" body="Historiku i pagave do të lidhet me motorin e payroll-it." />
        </TabsContent>
        <TabsContent value="contracts" className="mt-6">
          <ContractsTab rows={bundle.contracts} />
        </TabsContent>
        <TabsContent value="documents" className="mt-6">
          <DocumentsCenterTab {...bundle} />
        </TabsContent>
        <TabsContent value="leave" className="mt-6">
          <EmptyTab title="Pushimet" body="Kërkesat dhe bilanci i lejeve." />
        </TabsContent>
        <TabsContent value="warnings" className="mt-6">
          <EmptyTab title="Vërejtjet" body="Disiplina dhe vërejtjet formale." />
        </TabsContent>
        <TabsContent value="timeline" className="mt-6">
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
          onSuccess={() => void reload()}
        />
      ) : null}
    </div>
  );
}

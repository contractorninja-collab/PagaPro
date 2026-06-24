"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { TerminationStatus, TerminationType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  createTerminationAction,
  approveTerminationAction,
  cancelTerminationAction,
  completeTerminationAction,
  generateTerminationDocumentActionServer,
  prepareFinalPayrollTerminationAction,
  submitTerminationAction,
} from "@/modules/terminations/actions/termination-actions";
import { TERMINATION_STATUS_LABELS, TERMINATION_TYPE_LABELS } from "@/modules/terminations/types";

export interface LargimetRowSerialized {
  id: string;
  type: TerminationType;
  status: TerminationStatus;
  terminationDate: string;
  lastWorkingDay: string;
  finalPayrollRequired: boolean;
  finalPayrollId: string | null;
  generatedDocumentId: string | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
    personalId: string;
  };
  finalPayroll: { id: string; year: number; month: number; status: string } | null;
  generatedDocument: {
    id: string;
    displayFilename: string;
  } | null;
}

export interface EmployeePickerOption {
  id: string;
  firstName: string;
  lastName: string;
  personalId: string;
  jobTitle: string | null;
  hireDate: string;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("sq-AL", { timeZone: "UTC" });
  } catch {
    return iso;
  }
}

export function LargimetDashboardClient(props: {
  rows: LargimetRowSerialized[];
  employees: EmployeePickerOption[];
  filters: {
    status?: string;
    type?: string;
    employeeId?: string;
    year?: number;
    month?: number;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Largimet</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Procesi operativ i largimeve: dokumentet, payroll përfundimtar dhe gjurmimi HR.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>Krijo Largim</Button>
          </DialogTrigger>
          <CreateTerminationDialogContent
            employees={props.employees}
            pending={pending}
            startTransition={startTransition}
            onDone={() => setCreateOpen(false)}
          />
        </Dialog>
      </div>

      <LargimetFiltersClient filters={props.filters} employees={props.employees} />

      {props.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nuk ka largime për këta filtra.</p>
      ) : (
        <>
          <div className="hidden rounded-md border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Punonjësi</TableHead>
                  <TableHead>Pozita</TableHead>
                  <TableHead>Lloji</TableHead>
                  <TableHead>Data largimit</TableHead>
                  <TableHead>Dita e fundit</TableHead>
                  <TableHead>Statusi</TableHead>
                  <TableHead>Payroll</TableHead>
                  <TableHead>Dokumenti</TableHead>
                  <TableHead className="text-right">Veprime</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {props.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <Link href={`/punonjesit/${r.employee.id}`} className="underline-offset-4 hover:underline">
                        {r.employee.firstName} {r.employee.lastName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.employee.jobTitle ?? "—"}</TableCell>
                    <TableCell>{TERMINATION_TYPE_LABELS[r.type]}</TableCell>
                    <TableCell>{fmtDate(r.terminationDate)}</TableCell>
                    <TableCell>{fmtDate(r.lastWorkingDay)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{TERMINATION_STATUS_LABELS[r.status] ?? r.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.finalPayroll ? (
                        <Link href={`/pagat/${r.finalPayroll.id}`} className="text-sm underline-offset-4 hover:underline">
                          {r.finalPayroll.month}/{r.finalPayroll.year} ({r.finalPayroll.status})
                        </Link>
                      ) : r.finalPayrollRequired ? (
                        <span className="text-xs text-muted-foreground">Kërkohet</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {r.generatedDocument ? (
                        <Link
                          href={`/dokumentet/${r.generatedDocument.id}`}
                          className="text-sm underline-offset-4 hover:underline"
                        >
                          Hap
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <RowQuickActions row={r} pending={pending} startTransition={startTransition} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 md:hidden">
            {props.rows.map((r) => (
              <div key={r.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {r.employee.firstName} {r.employee.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.employee.jobTitle ?? "—"}</p>
                  </div>
                  <Badge variant="secondary">{TERMINATION_STATUS_LABELS[r.status] ?? r.status}</Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Lloji</dt>
                    <dd>{TERMINATION_TYPE_LABELS[r.type]}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Data</dt>
                    <dd>{fmtDate(r.terminationDate)}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outlinePrimary">
                    <Link href={`/largimet/${r.id}`}>Hap</Link>
                  </Button>
                  <RowQuickActions row={r} pending={pending} startTransition={startTransition} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LargimetFiltersClient(props: {
  filters: {
    status?: string;
    type?: string;
    employeeId?: string;
    year?: number;
    month?: number;
  };
  employees: EmployeePickerOption[];
}) {
  return (
    <form className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 md:flex-row md:flex-wrap md:items-end" action="/largimet" method="get">
      <div className="grid gap-1">
        <Label className="text-xs">Statusi</Label>
        <select name="status" defaultValue={props.filters.status ?? "ALL"} className="h-9 rounded-md border px-2 text-sm">
          <option value="ALL">Të gjitha</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_REVIEW">Në shqyrtim</option>
          <option value="APPROVED">I miratuar</option>
          <option value="COMPLETED">I përfunduar</option>
          <option value="CANCELLED">I anuluar</option>
        </select>
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">Lloji</Label>
        <select name="type" defaultValue={props.filters.type ?? "ALL"} className="h-9 rounded-md border px-2 text-sm">
          <option value="ALL">Të gjitha</option>
          {(Object.keys(TERMINATION_TYPE_LABELS) as TerminationType[]).map((k) => (
            <option key={k} value={k}>
              {TERMINATION_TYPE_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">Punonjësi</Label>
        <select name="employeeId" defaultValue={props.filters.employeeId ?? ""} className="h-9 max-w-[220px] rounded-md border px-2 text-sm">
          <option value="">Të gjithë</option>
          {props.employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.lastName}, {e.firstName}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">Viti</Label>
        <Input name="year" type="number" className="h-9 w-28" defaultValue={props.filters.year ?? ""} placeholder="2026" />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">Muaji</Label>
        <Input name="month" type="number" min={1} max={12} className="h-9 w-24" defaultValue={props.filters.month ?? ""} placeholder="1-12" />
      </div>
      <Button type="submit" variant="secondary" size="sm">
        Filtroni
      </Button>
    </form>
  );
}

function RowQuickActions(props: {
  row: LargimetRowSerialized;
  pending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const { row, pending, startTransition } = props;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Gabim.");
      else toast.success("U krye.");
    });
  }

  return (
    <div className="flex flex-wrap justify-end gap-1">
      <Button asChild size="sm" variant="ghost">
        <Link href={`/largimet/${row.id}`}>Shiko</Link>
      </Button>
      {row.status === "DRAFT" ? (
        <Button
          size="sm"
          variant="outlinePrimary"
          disabled={pending}
          onClick={() => run(() => submitTerminationAction({ id: row.id }))}
        >
          Dërgo
        </Button>
      ) : null}
      {row.status === "PENDING_REVIEW" ? (
        <Button
          size="sm"
          variant="outlinePrimary"
          disabled={pending}
          onClick={() => run(() => approveTerminationAction({ id: row.id }))}
        >
          Mirato
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="outlinePrimary"
        disabled={pending || row.status === "COMPLETED" || row.status === "CANCELLED"}
        onClick={() => run(() => generateTerminationDocumentActionServer({ id: row.id }))}
      >
        Dokumenti
      </Button>
      <Button
        size="sm"
        variant="outlinePrimary"
        disabled={pending || row.status === "COMPLETED" || row.status === "CANCELLED"}
        onClick={() => run(() => prepareFinalPayrollTerminationAction({ id: row.id }))}
      >
        Payroll
      </Button>
      {row.status === "APPROVED" ? (
        <Button size="sm" disabled={pending} onClick={() => run(() => completeTerminationAction({ id: row.id }))}>
          Përfundo
        </Button>
      ) : null}
      {row.status !== "COMPLETED" && row.status !== "CANCELLED" ? (
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => run(() => cancelTerminationAction({ id: row.id }))}
        >
          Anulo
        </Button>
      ) : null}
    </div>
  );
}

function CreateTerminationDialogContent(props: {
  employees: EmployeePickerOption[];
  pending: boolean;
  startTransition: (fn: () => void) => void;
  onDone: () => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState<TerminationType>("LARGIM_VULLNETAR");
  const [terminationDate, setTerminationDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lastWorkingDay, setLastWorkingDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [finalPayrollRequired, setFinalPayrollRequired] = useState(true);

  function submit() {
    props.startTransition(async () => {
      const res = await createTerminationAction({
        employeeId,
        type,
        terminationDate: new Date(`${terminationDate}T12:00:00.000Z`).toISOString(),
        lastWorkingDay: new Date(`${lastWorkingDay}T12:00:00.000Z`).toISOString(),
        reason: reason.trim() || undefined,
        details: details.trim() || undefined,
        finalPayrollRequired,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Largimi u krijua.");
      props.onDone();
      const newId = res.data?.id;
      if (newId) {
        window.location.href = `/largimet/${newId}`;
      }
    });
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Krijo largim</DialogTitle>
        <DialogDescription>Përzgjidh punonjësin dhe llojin e procesit.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 py-2">
        <div className="space-y-2">
          <Label>Punonjësi</Label>
          <select
            className="h-10 w-full rounded-md border px-2 text-sm"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            disabled={props.pending}
          >
            <option value="">Zgjidhni…</option>
            {props.employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.lastName}, {e.firstName} ({e.personalId})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Lloji</Label>
          <select
            className="h-10 w-full rounded-md border px-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as TerminationType)}
            disabled={props.pending}
          >
            {(Object.keys(TERMINATION_TYPE_LABELS) as TerminationType[]).map((k) => (
              <option key={k} value={k}>
                {TERMINATION_TYPE_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label>Data largimit</Label>
            <Input type="date" value={terminationDate} onChange={(e) => setTerminationDate(e.target.value)} disabled={props.pending} />
          </div>
          <div className="space-y-2">
            <Label>Dita e fundit e punës</Label>
            <Input type="date" value={lastWorkingDay} onChange={(e) => setLastWorkingDay(e.target.value)} disabled={props.pending} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Arsyeja</Label>
          <textarea
            className="min-h-[72px] w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={props.pending}
          />
        </div>
        <div className="space-y-2">
          <Label>Detaje</Label>
          <textarea
            className="min-h-[72px] w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            disabled={props.pending}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={finalPayrollRequired}
            onChange={(e) => setFinalPayrollRequired(e.target.checked)}
            disabled={props.pending}
          />
          Final payroll i detyrueshëm
        </label>
      </div>
      <DialogFooter>
        <Button type="button" onClick={submit} disabled={props.pending || !employeeId}>
          Ruaj
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

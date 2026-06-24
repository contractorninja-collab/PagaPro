"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { TerminationStatus, TerminationType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  approveTerminationAction,
  cancelTerminationAction,
  completeTerminationAction,
  generateTerminationDocumentActionServer,
  prepareFinalPayrollTerminationAction,
  submitTerminationAction,
  toggleTerminationChecklistAction,
  updateTerminationAction,
} from "@/modules/terminations/actions/termination-actions";
import { TERMINATION_STATUS_LABELS, TERMINATION_TYPE_LABELS } from "@/modules/terminations/types";

export interface LargimetDetailProps {
  termination: {
    id: string;
    type: TerminationType;
    status: TerminationStatus;
    terminationDate: string;
    noticeDate: string | null;
    lastWorkingDay: string;
    noticeDays: number | null;
    severanceAmount: string | null;
    reason: string | null;
    details: string | null;
    finalPayrollRequired: boolean;
    finalPayrollId: string | null;
    generatedDocumentId: string | null;
    completedAt: string | null;
    approvedAt: string | null;
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      personalId: string;
      jobTitle: string | null;
      hireDate: string;
      status: string;
      department: { id: string; name: string } | null;
    };
    approvedBy: { displayName: string | null; email: string } | null;
    createdBy: { displayName: string | null; email: string } | null;
    finalPayroll: { id: string; year: number; month: number; status: string } | null;
    generatedDocument: { id: string; displayFilename: string } | null;
  };
  checklists: Array<{
    id: string;
    itemKey: string;
    label: string;
    isCompleted: boolean;
    completedAt: string | null;
  }>;
  artifacts: Array<{
    id: string;
    title: string;
    displayFilename: string;
    kind: string;
    createdAt: string;
    isArchived: boolean;
  }>;
  payrollEntry: { id: string; status: string; netPay: string; grossSalary: string } | null;
  timeline: Array<{ id: string; eventType: string; title: string; body: string | null; occurredAt: string }>;
  activities: Array<{
    id: string;
    verb: string;
    summary: string;
    occurredAt: string;
    actor: { displayName: string | null; email: string } | null;
  }>;
  audits: Array<{
    id: string;
    action: string;
    createdAt: string | null;
    actor: { displayName: string | null; email: string } | null;
  }>;
}

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString("sq-AL", { timeZone: "UTC" });
  } catch {
    return iso;
  }
}

export function LargimetDetailClient(props: LargimetDetailProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t = props.termination;
  const readOnly = t.status === "COMPLETED" || t.status === "CANCELLED";

  function run(labelOk: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Gabim.");
      else {
        toast.success(labelOk);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-8 pb-28 md:pb-8">
      <div className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Link href="/largimet" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            ← Largimet
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {t.employee.firstName} {t.employee.lastName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {TERMINATION_TYPE_LABELS[t.type]} · {fmt(t.terminationDate)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{TERMINATION_STATUS_LABELS[t.status] ?? t.status}</Badge>
          {!readOnly ? (
            <EditTerminationDialog termination={t} pending={pending} startTransition={startTransition} onSaved={() => router.refresh()} />
          ) : null}
        </div>
      </div>

      <section className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold">Punonjësi</h2>
          <p className="mt-1 text-sm">
            <Link href={`/punonjesit/${t.employee.id}`} className="underline-offset-4 hover:underline">
              Profili
            </Link>
          </p>
          <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
            <div>Nr.personal: {t.employee.personalId}</div>
            <div>Pozita: {t.employee.jobTitle ?? "—"}</div>
            <div>Departamenti: {t.employee.department?.name ?? "—"}</div>
            <div>Statusi aktual: {t.employee.status}</div>
          </dl>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Datat</h2>
          <dl className="mt-2 space-y-1 text-xs">
            <div>Data largimit: {fmt(t.terminationDate)}</div>
            <div>Dita e fundit e punës: {fmt(t.lastWorkingDay)}</div>
            <div>Njoftimi: {t.noticeDate ? fmt(t.noticeDate) : "—"}</div>
          </dl>
        </div>
        <div className="md:col-span-2">
          <h2 className="text-sm font-semibold">Arsyeja / detajet</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{t.reason ?? "—"}</p>
          {t.details ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{t.details}</p>
          ) : null}
        </div>
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Dokumentet</h2>
        {props.artifacts.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nuk ka dokumente të gjeneruara.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {props.artifacts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{a.displayFilename}</span>
                <Button asChild size="sm" variant="outlinePrimary">
                  <Link href={`/dokumentet/${a.id}`}>Hap</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Final payroll</h2>
        {t.finalPayroll ? (
          <div className="text-sm">
            <Link href={`/pagat/${t.finalPayroll.id}`} className="underline-offset-4 hover:underline">
              Pagë {t.finalPayroll.month}/{t.finalPayroll.year} ({t.finalPayroll.status})
            </Link>
            {props.payrollEntry ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Rreshti: {props.payrollEntry.status} · Neto {props.payrollEntry.netPay} € · Bruto {props.payrollEntry.grossSalary} €
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nuk është lidhur ende.</p>
        )}
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Lista e kontrollit</h2>
        <ul className="space-y-2">
          {props.checklists.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-primary"
                checked={c.isCompleted}
                disabled={pending || readOnly}
                onChange={(e) => {
                  const checked = e.target.checked;
                  startTransition(async () => {
                    const res = await toggleTerminationChecklistAction({
                      terminationId: t.id,
                      itemKey: c.itemKey,
                      isCompleted: checked,
                    });
                    if (!res.ok) toast.error(res.error);
                    else {
                      toast.success("Lista u përditësua.");
                      router.refresh();
                    }
                  });
                }}
              />
              <span className={c.isCompleted ? "text-muted-foreground line-through" : ""}>{c.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Timeline (punonjësi)</h2>
        <ul className="space-y-2 text-xs">
          {props.timeline.map((ev) => (
            <li key={ev.id} className="border-b border-dashed pb-2">
              <div className="font-medium">{ev.title}</div>
              <div className="text-muted-foreground">{fmt(ev.occurredAt)}</div>
              {ev.body ? <div className="mt-1 whitespace-pre-wrap">{ev.body}</div> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">Aktiviteti</h2>
          <ul className="mt-2 space-y-2 text-xs">
            {props.activities.map((a) => (
              <li key={a.id}>
                <div className="font-medium">{a.summary}</div>
                <div className="text-muted-foreground">
                  {a.verb} · {fmt(a.occurredAt)} · {a.actor?.displayName ?? a.actor?.email ?? "—"}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">Audit log</h2>
          <ul className="mt-2 space-y-2 text-xs">
            {props.audits.map((a) => (
              <li key={a.id}>
                <div className="font-medium">{a.action}</div>
                <div className="text-muted-foreground">
                  {a.createdAt ? fmt(a.createdAt) : "—"} · {a.actor?.displayName ?? "—"}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-40 flex flex-wrap gap-2 border-t bg-background/95 p-3 backdrop-blur md:hidden">
        <Button
          size="sm"
          variant="outlinePrimary"
          disabled={pending || readOnly || t.status !== "DRAFT"}
          onClick={() => run("U dërgua.", () => submitTerminationAction({ id: t.id }))}
        >
          Dërgo
        </Button>
        <Button
          size="sm"
          variant="outlinePrimary"
          disabled={pending || readOnly || t.status !== "PENDING_REVIEW"}
          onClick={() => run("U miratua.", () => approveTerminationAction({ id: t.id }))}
        >
          Mirato
        </Button>
        <Button
          size="sm"
          variant="outlinePrimary"
          disabled={pending || readOnly}
          onClick={() => run("U gjenerua.", () => generateTerminationDocumentActionServer({ id: t.id }))}
        >
          Dok.
        </Button>
        <Button
          size="sm"
          variant="outlinePrimary"
          disabled={pending || readOnly}
          onClick={() => run("U përgatit.", () => prepareFinalPayrollTerminationAction({ id: t.id }))}
        >
          Payroll
        </Button>
        <Button
          size="sm"
          disabled={pending || t.status !== "APPROVED"}
          onClick={() => run("U përfundua.", () => completeTerminationAction({ id: t.id }))}
        >
          Përfundo
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={pending || readOnly}
          onClick={() => run("U anulua.", () => cancelTerminationAction({ id: t.id }))}
        >
          Anulo
        </Button>
      </div>

      <div className="hidden flex-wrap gap-2 md:flex">
        <Button size="sm" variant="outlinePrimary" disabled={pending || readOnly || t.status !== "DRAFT"} onClick={() => run("U dërgua.", () => submitTerminationAction({ id: t.id }))}>
          Dërgo në shqyrtim
        </Button>
        <Button
          size="sm"
          variant="outlinePrimary"
          disabled={pending || readOnly || t.status !== "PENDING_REVIEW"}
          onClick={() => run("U miratua.", () => approveTerminationAction({ id: t.id }))}
        >
          Mirato
        </Button>
        <Button size="sm" variant="outlinePrimary" disabled={pending || readOnly} onClick={() => run("U gjenerua.", () => generateTerminationDocumentActionServer({ id: t.id }))}>
          Gjenero dokumentin
        </Button>
        <Button size="sm" variant="outlinePrimary" disabled={pending || readOnly} onClick={() => run("U përgatit.", () => prepareFinalPayrollTerminationAction({ id: t.id }))}>
          Përgatit payroll
        </Button>
        <Button size="sm" disabled={pending || t.status !== "APPROVED"} onClick={() => run("U përfundua.", () => completeTerminationAction({ id: t.id }))}>
          Përfundo largimin
        </Button>
        <Button size="sm" variant="destructive" disabled={pending || readOnly} onClick={() => run("U anulua.", () => cancelTerminationAction({ id: t.id }))}>
          Anulo
        </Button>
      </div>
    </div>
  );
}

function EditTerminationDialog(props: {
  termination: LargimetDetailProps["termination"];
  pending: boolean;
  startTransition: (fn: () => void) => void;
  onSaved: () => void;
}) {
  const { termination: t, pending, startTransition, onSaved } = props;
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(t.type);
  const [terminationDate, setTerminationDate] = useState(t.terminationDate.slice(0, 10));
  const [lastWorkingDay, setLastWorkingDay] = useState(t.lastWorkingDay.slice(0, 10));
  const [reason, setReason] = useState(t.reason ?? "");
  const [details, setDetails] = useState(t.details ?? "");
  const [finalPayrollRequired, setFinalPayrollRequired] = useState(t.finalPayrollRequired);

  function save() {
    startTransition(async () => {
      const res = await updateTerminationAction({
        id: t.id,
        type,
        terminationDate: new Date(`${terminationDate}T12:00:00.000Z`).toISOString(),
        lastWorkingDay: new Date(`${lastWorkingDay}T12:00:00.000Z`).toISOString(),
        reason,
        details,
        finalPayrollRequired,
      });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("U ruajt.");
        setOpen(false);
        onSaved();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          Edito
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edito largimin</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-2">
            <Label>Lloji</Label>
            <select className="h-10 w-full rounded-md border px-2 text-sm" value={type} onChange={(e) => setType(e.target.value as TerminationType)}>
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
              <Input type="date" value={terminationDate} onChange={(e) => setTerminationDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Dita e fundit</Label>
              <Input type="date" value={lastWorkingDay} onChange={(e) => setLastWorkingDay(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Arsyeja</Label>
            <textarea className="min-h-[72px] w-full rounded-md border px-3 py-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Detaje</Label>
            <textarea className="min-h-[72px] w-full rounded-md border px-3 py-2 text-sm" value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={finalPayrollRequired} onChange={(e) => setFinalPayrollRequired(e.target.checked)} />
            Final payroll i detyrueshëm
          </label>
        </div>
        <DialogFooter>
          <Button type="button" onClick={save} disabled={pending}>
            Ruaj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

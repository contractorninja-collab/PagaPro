"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LeaveOperationalCalendar } from "@/modules/leaves/calendar/leave-operational-calendar";
import { LeaveRequestsMobileList } from "@/modules/leaves/components/leave-requests-mobile-list";
import { LeaveRequestsTable } from "@/modules/leaves/components/leave-requests-table";
import type { LeaveSubtype } from "@prisma/client";
import {
  approveLeaveRequestAction,
  cancelLeaveRequestAction,
  createLeaveRequestAction,
  generateLeaveDocumentAction,
  rejectLeaveRequestAction,
} from "@/modules/leaves/actions/leave-actions";
import {
  LEAVE_TYPE_HELP_SQ,
  LEAVE_TYPE_LABELS_SQ,
  LEAVE_SUBTYPE_LABELS_SQ,
  medicalLeaveSubtypeLabel,
  subtypesForLeaveType,
} from "@/modules/leaves/helpers/leave-type-metadata";
import type {
  PushimetBalanceRowDto,
  PushimetCalendarChipDto,
  PushimetEmployeeOptionDto,
  PushimetLeaveRowDto,
  PushimetTemplateOptionDto,
} from "@/modules/leaves/types/pushimet";

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function PushimetDashboardClient(props: {
  stats: { pending: number; approvedThisUtcMonth: number; draft: number };
  rows: PushimetLeaveRowDto[];
  pendingRows: PushimetLeaveRowDto[];
  chips: PushimetCalendarChipDto[];
  calendarYear: number;
  calendarMonth: number;
  balances: PushimetBalanceRowDto[];
  employees: PushimetEmployeeOptionDto[];
  templates: PushimetTemplateOptionDto[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendingUi, startTransition] = useTransition();

  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [genId, setGenId] = useState<string | null>(null);
  const [genTemplateId, setGenTemplateId] = useState(props.templates[0]?.id ?? "");

  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    employeeId: "",
    type: "PUSHIM_VJETOR" as PushimetLeaveRowDto["type"],
    subtype: "NONE" as LeaveSubtype,
    startDateIso: "",
    endDateIso: "",
    reason: "",
  });

  const prevHref = useMemo(() => {
    const { year, month } = shiftMonth(props.calendarYear, props.calendarMonth, -1);
    const p = new URLSearchParams(searchParams.toString());
    p.set("year", String(year));
    p.set("month", String(month));
    return `/pushimet?${p.toString()}`;
  }, [props.calendarMonth, props.calendarYear, searchParams]);

  const nextHref = useMemo(() => {
    const { year, month } = shiftMonth(props.calendarYear, props.calendarMonth, 1);
    const p = new URLSearchParams(searchParams.toString());
    p.set("year", String(year));
    p.set("month", String(month));
    return `/pushimet?${p.toString()}`;
  }, [props.calendarMonth, props.calendarYear, searchParams]);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function runApprove(id: string) {
    const r = await approveLeaveRequestAction(id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Pushimi u miratua.");
    refresh();
  }

  async function runCancel(id: string) {
    const r = await cancelLeaveRequestAction(id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Kërkesa u anulua.");
    refresh();
  }

  async function confirmReject() {
    if (!rejectId) return;
    const r = await rejectLeaveRequestAction({
      leaveId: rejectId,
      rejectionReason: rejectReason.trim() || undefined,
    });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Pushimi u refuzua.");
    setRejectId(null);
    setRejectReason("");
    refresh();
  }

  async function confirmGenerate() {
    if (!genId || !genTemplateId) {
      toast.error("Zgjidhni një shabllon dokumenti.");
      return;
    }
    const r = await generateLeaveDocumentAction({
      leaveRequestId: genId,
      documentTemplateId: genTemplateId,
    });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Dokumenti u gjenerua.");
    setGenId(null);
    refresh();
  }

  async function submitNewLeave(e: React.FormEvent) {
    e.preventDefault();
    if (!newForm.employeeId || !newForm.startDateIso || !newForm.endDateIso) {
      toast.error("Plotësoni punonjësin dhe datat.");
      return;
    }
    const r = await createLeaveRequestAction({
      employeeId: newForm.employeeId,
      type: newForm.type,
      subtype: newForm.subtype,
      startDateIso: newForm.startDateIso,
      endDateIso: newForm.endDateIso,
      reason: newForm.reason.trim() || null,
    });
    if (!r.ok || !r.data?.id) {
      toast.error(!r.ok ? r.error : "Ruajtja dështoi.");
      return;
    }
    toast.success("Kërkesa u dërgua për miratim.");
    setNewOpen(false);
    refresh();
  }

  function openGenerate(id: string) {
    setGenTemplateId(props.templates[0]?.id ?? "");
    setGenId(id);
  }

  return (
    <div className={`space-y-8 ${pendingUi ? "opacity-80 transition-opacity" : ""}`}>
      {pendingUi ? (
        <div className="flex justify-end">
          <Skeleton className="h-4 w-24" />
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/80 p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Në pritje</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{props.stats.pending}</p>
        </Card>
        <Card className="border-border/80 p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Miratuar (muaji UTC)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {props.stats.approvedThisUtcMonth}
          </p>
        </Card>
        <Card className="border-border/80 p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Draft</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{props.stats.draft}</p>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Miratimet në pritje</h2>
            <p className="text-xs text-muted-foreground">Operacion HR — reflektohet menjëherë në payroll pas miratimit.</p>
          </div>
          <Button type="button" className="hidden md:inline-flex" onClick={() => setNewOpen(true)}>
            Kërkesë e re
          </Button>
        </div>
        {props.pendingRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Nuk ka kërkesa në pritje.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <Table className="table-dense">
              <TableHeader>
                <TableRow>
                  <TableHead>Punonjësi</TableHead>
                  <TableHead>Lloji</TableHead>
                  <TableHead>Periudha</TableHead>
                  <TableHead className="text-right">Veprime të shpejta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {props.pendingRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.employeeName}</TableCell>
                    <TableCell>{LEAVE_TYPE_LABELS_SQ[row.type]}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.startDateIso.slice(0, 10)} → {row.endDateIso.slice(0, 10)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" size="sm" onClick={() => void runApprove(row.id)}>
                          Mirato
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={() => setRejectId(row.id)}>
                          Refuzo
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/pushimet/${row.id}`}>Hape</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Gjendje ditësh (balanca)</h2>
            <p className="text-xs text-muted-foreground">
              Akumuluar tregon ditët e pushimit të fituara deri në periudhën e zgjedhur. Festat zyrtare dhe pushimi
              mjekësor i aprovuar gjatë pushimit vjetor nuk zbriten nga bilanci i pushimit vjetor.{" "}
              <span className="font-medium text-amber-800 dark:text-amber-200">
                Vlerat negative alarmojnë HR para miratimit.
              </span>
            </p>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <Table className="table-dense min-w-[960px]">
            <TableHeader>
              <TableRow>
                <TableHead>Punonjësi</TableHead>
                <TableHead>Departamenti</TableHead>
                <TableHead>Lloji</TableHead>
                <TableHead>Viti</TableHead>
                <TableHead>Kuota vjetore</TableHead>
                <TableHead>Akumuluar</TableHead>
                <TableHead>Bartur</TableHead>
                <TableHead>Përdorur</TableHead>
                <TableHead>Në pritje</TableHead>
                <TableHead>Mbetur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.balances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-sm text-muted-foreground">
                    Nuk ka të dhëna balancë për vitin e filtrit — do të popullohet kur miratohen pushimet.
                  </TableCell>
                </TableRow>
              ) : (
                props.balances.map((b) => {
                  const neg = parseFloat(b.remainingDays) < 0;
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.employeeName}</TableCell>
                      <TableCell className="text-muted-foreground">{b.departmentName ?? "—"}</TableCell>
                      <TableCell>{LEAVE_TYPE_LABELS_SQ[b.leaveType]}</TableCell>
                      <TableCell className="tabular-nums">{b.year}</TableCell>
                      <TableCell className="tabular-nums">{b.yearlyQuota}</TableCell>
                      <TableCell className="tabular-nums">
                        {b.leaveType === "PUSHIM_VJETOR" ? b.accruedDays : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {b.leaveType === "PUSHIM_VJETOR" ? b.carryOverDays : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">{b.usedDays}</TableCell>
                      <TableCell className="tabular-nums">
                        {b.leaveType === "PUSHIM_VJETOR" ? b.pendingDays : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {neg ? (
                          <Badge variant="destructive">{b.remainingDays}</Badge>
                        ) : (
                          <span>{b.remainingDays}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_minmax(280px,360px)]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Lista operative</h2>
            <p className="text-xs text-muted-foreground">Filtrimi aplikon për tabelë dhe kalendar.</p>
          </div>
          <LeaveRequestsTable
            rows={props.rows}
            onApprove={(id) => void runApprove(id)}
            onReject={(id) => setRejectId(id)}
            onCancel={(id) => void runCancel(id)}
            onGenerate={(id) => openGenerate(id)}
          />
          <LeaveRequestsMobileList
            rows={props.rows}
            onApprove={(id) => void runApprove(id)}
            onReject={(id) => setRejectId(id)}
            onCancel={(id) => void runCancel(id)}
            onGenerate={(id) => openGenerate(id)}
          />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="secondary" size="sm" asChild>
              <Link href={prevHref} prefetch={false}>
                ← Muaji paraprak
              </Link>
            </Button>
            <Button type="button" variant="secondary" size="sm" asChild>
              <Link href={nextHref} prefetch={false}>
                Muaji tjetër →
              </Link>
            </Button>
          </div>
          <LeaveOperationalCalendar
            year={props.calendarYear}
            month={props.calendarMonth}
            chips={props.chips.filter((c) => c.status === "APPROVED" || c.status === "PENDING")}
          />
        </div>
      </section>

      <Dialog open={rejectId != null} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuzo kërkesën</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Mesazhi përfshihet në audit dhe në kronologjinë e punonjësit.</p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
            placeholder="Arsyeja e refuzimit…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setRejectId(null)}>
              Anulo
            </Button>
            <Button type="button" onClick={() => void confirmReject()}>
              Konfirmo refuzimin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={genId != null} onOpenChange={(o) => !o && setGenId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gjenero dokumentin e pushimit</DialogTitle>
          </DialogHeader>
          {props.templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nuk ka shabllone aktive në kategorinë LEAVE. Ngarkoni një shabllon te Dokumentet dhe publikoni një version.
            </p>
          ) : (
            <div className="space-y-2">
              <label htmlFor="gen-template" className="text-xs font-medium text-muted-foreground">
                Shablloni
              </label>
              <select
                id="gen-template"
                value={genTemplateId}
                onChange={(e) => setGenTemplateId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {props.templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setGenId(null)}>
              Mbyll
            </Button>
            <Button type="button" disabled={props.templates.length === 0} onClick={() => void confirmGenerate()}>
              Gjenero
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kërkesë e re për pushim</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => void submitNewLeave(e)}>
            <div className="space-y-1">
              <label htmlFor="nl-emp" className="text-xs font-medium text-muted-foreground">
                Punonjësi
              </label>
              <select
                id="nl-emp"
                required
                value={newForm.employeeId}
                onChange={(e) => setNewForm((s) => ({ ...s, employeeId: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Zgjidh…</option>
                {props.employees.map((em) => (
                  <option key={em.id} value={em.id}>
                    {em.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="nl-type" className="text-xs font-medium text-muted-foreground">
                Lloji
              </label>
              <select
                id="nl-type"
                value={newForm.type}
                onChange={(e) =>
                  setNewForm((s) => ({
                    ...s,
                    type: e.target.value as PushimetLeaveRowDto["type"],
                    subtype: "NONE",
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {(Object.keys(LEAVE_TYPE_LABELS_SQ) as PushimetLeaveRowDto["type"][]).map((k) => (
                  <option key={k} value={k}>
                    {LEAVE_TYPE_LABELS_SQ[k]}
                  </option>
                ))}
              </select>
              {newForm.type === "PUSHIM_MJEKESOR" && LEAVE_TYPE_HELP_SQ.PUSHIM_MJEKESOR ? (
                <p className="text-xs leading-relaxed text-muted-foreground">{LEAVE_TYPE_HELP_SQ.PUSHIM_MJEKESOR}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <label htmlFor="nl-subtype" className="text-xs font-medium text-muted-foreground">
                {newForm.type === "PUSHIM_MJEKESOR" ? "Nën-lloji mjekësor" : "Nën-lloji (Art 39 / Atersi / Lehonie)"}
              </label>
              <select
                id="nl-subtype"
                value={newForm.subtype}
                onChange={(e) => setNewForm((s) => ({ ...s, subtype: e.target.value as LeaveSubtype }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {subtypesForLeaveType(newForm.type).map((k) => (
                  <option key={k} value={k}>
                    {newForm.type === "PUSHIM_MJEKESOR" ? medicalLeaveSubtypeLabel(k) : LEAVE_SUBTYPE_LABELS_SQ[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="nl-start" className="text-xs font-medium text-muted-foreground">
                  Fillimi
                </label>
                <input
                  id="nl-start"
                  required
                  type="date"
                  value={newForm.startDateIso}
                  onChange={(e) => setNewForm((s) => ({ ...s, startDateIso: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="nl-end" className="text-xs font-medium text-muted-foreground">
                  Mbarimi
                </label>
                <input
                  id="nl-end"
                  required
                  type="date"
                  value={newForm.endDateIso}
                  onChange={(e) => setNewForm((s) => ({ ...s, endDateIso: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="nl-reason" className="text-xs font-medium text-muted-foreground">
                Arsyeja / shënim
              </label>
              <textarea
                id="nl-reason"
                rows={3}
                value={newForm.reason}
                onChange={(e) => setNewForm((s) => ({ ...s, reason: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => setNewOpen(false)}>
                Anulo
              </Button>
              <Button type="submit">Dërgo për miratim</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-24 right-4 z-40 md:hidden">
        <Button type="button" size="lg" className="shadow-lg" onClick={() => setNewOpen(true)}>
          + Pushim
        </Button>
      </div>
    </div>
  );
}

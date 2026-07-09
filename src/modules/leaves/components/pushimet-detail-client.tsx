"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { LeaveStatusBadge } from "@/modules/leaves/components/leave-status-badge";
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
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  approveLeaveRequestAction,
  cancelLeaveRequestAction,
  generateLeaveDocumentAction,
  linkSickInterruptingAnnualLeaveAction,
  rejectLeaveRequestAction,
  revokeLeaveRequestAction,
} from "@/modules/leaves/actions/leave-actions";
import { formatSqDate } from "@/modules/employees/components/employees-labels";
import { LEAVE_TYPE_LABELS_SQ, LEAVE_SUBTYPE_LABELS_SQ } from "@/modules/leaves/helpers/leave-type-metadata";
import { payrollImpactLabel } from "@/modules/leaves/helpers/payroll-impact-label";
import { LEAVE_STATUS_LABELS_SQ } from "@/modules/leaves/helpers/leave-status-labels";
import type {
  PushimetLeaveRowDto,
  PushimetTemplateOptionDto,
} from "@/modules/leaves/types/pushimet";

export type PushimetDetailSerialized = {
  row: PushimetLeaveRowDto;
  documents: { leaveDocumentId: string; artifactId: string; title: string | null; createdAtIso: string }[];
  createdByLabel: string | null;
};

export type PushimetTimelineSerialized = {
  id: string;
  occurredAtIso: string;
  eventType: string;
  title: string;
  body: string | null;
  actorLabel: string | null;
  metadataJson: string | null;
};

export type PushimetBalanceSerialized = {
  id: string;
  leaveType: PushimetLeaveRowDto["type"];
  year: number;
  yearlyQuota: string;
  accruedDays: string;
  carryOverDays: string;
  usedDays: string;
  pendingDays: string;
  remainingDays: string;
};

export function PushimetDetailClient(props: {
  detail: PushimetDetailSerialized;
  timeline: PushimetTimelineSerialized[];
  balancesByYear: { year: number; rows: PushimetBalanceSerialized[] }[];
  upcoming: PushimetLeaveRowDto[];
  history: PushimetLeaveRowDto[];
  templates: PushimetTemplateOptionDto[];
}) {
  const router = useRouter();
  const { row } = props.detail;

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [genOpen, setGenOpen] = useState(false);
  const [genTemplateId, setGenTemplateId] = useState(props.templates[0]?.id ?? "");
  const [linkInterruptOpen, setLinkInterruptOpen] = useState(false);
  const [sickInterruptLeaveId, setSickInterruptLeaveId] = useState("");

  function refresh() {
    router.refresh();
  }

  async function approve() {
    const r = await approveLeaveRequestAction(row.id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Pushimi u miratua.");
    refresh();
  }

  async function cancel() {
    const r = await cancelLeaveRequestAction(row.id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Kërkesa u anulua.");
    refresh();
  }

  async function rejectConfirm() {
    const r = await rejectLeaveRequestAction({
      leaveId: row.id,
      rejectionReason: rejectReason.trim() || undefined,
    });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Pushimi u refuzua.");
    setRejectOpen(false);
    setRejectReason("");
    refresh();
  }

  async function revokeConfirm() {
    const r = await revokeLeaveRequestAction({
      leaveId: row.id,
      reason: revokeReason.trim() || undefined,
    });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Pushimi u revokua dhe balancat u rikthyen.");
    setRevokeOpen(false);
    setRevokeReason("");
    refresh();
  }

  async function generateConfirm() {
    if (!genTemplateId) {
      toast.error("Zgjidhni një shabllon.");
      return;
    }
    const r = await generateLeaveDocumentAction({
      leaveRequestId: row.id,
      documentTemplateId: genTemplateId,
    });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Dokumenti u gjenerua.");
    setGenOpen(false);
    refresh();
  }

  async function confirmLinkInterrupt() {
    const trimmed = sickInterruptLeaveId.trim();
    if (!trimmed) {
      toast.error("Vendosni ID të pushimit mjekësor të miratuar.");
      return;
    }
    const r = await linkSickInterruptingAnnualLeaveAction({
      annualLeaveId: row.id,
      sickLeaveId: trimmed,
    });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Lidhja Art 34.2 u ruajt.");
    setLinkInterruptOpen(false);
    setSickInterruptLeaveId("");
    refresh();
  }

  const payrollNarrative =
    row.status === "APPROVED"
      ? row.affectsPayroll
        ? row.isPaid
          ? "Ky pushim klasifikohet si i paguar: orët e pushimit të paguar përfshihen në gjenerimin e payroll-it mujor si orë të mbuluara nga paga bazë."
          : "Ky pushim është pa pagesë: orët përjashtohen nga paga efektive dhe përpunohen si zbritje në spreadsheet-in e payroll-it."
        : "Ky rekord nuk ndikon në payroll (flamuri affectsPayroll është i fikur — përdoret për përjashtime operative)."
      : row.status === "CANCELLED" || row.status === "REJECTED"
        ? "Statusi nuk gjeneron rreshta payroll."
        : "Pas miratimit, sistemi sinjalizon automatikisht payroll-in për periudhat përkatëse.";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pushimi</h1>
            <LeaveStatusBadge status={row.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {row.employeeName}
            {row.departmentName ? ` · ${row.departmentName}` : ""}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            ID: <span className="font-mono tabular-nums">{row.id}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          {row.status === "PENDING" ? (
            <>
              <Button type="button" onClick={() => void approve()}>
                Mirato
              </Button>
              <Button type="button" variant="secondary" onClick={() => setRejectOpen(true)}>
                Refuzo
              </Button>
            </>
          ) : null}
          {row.status === "DRAFT" || row.status === "PENDING" ? (
            <Button type="button" variant="secondary" onClick={() => void cancel()}>
              Anulo
            </Button>
          ) : null}
          {row.status === "APPROVED" ? (
            <>
              <Button type="button" variant="secondary" onClick={() => setGenOpen(true)}>
                Gjenero dokument
              </Button>
              <Button type="button" variant="secondary" onClick={() => setRevokeOpen(true)}>
                Revoko
              </Button>
            </>
          ) : null}
          <Button variant="ghost" asChild>
            <Link href="/pushimet">Kthehu te lista</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/80 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Detajet e kërkesës</h2>
          <Separator className="my-4" />
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Lloji</dt>
              <dd className="font-medium">{LEAVE_TYPE_LABELS_SQ[row.type]}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Nën-lloji</dt>
              <dd className="font-medium">{LEAVE_SUBTYPE_LABELS_SQ[row.subtype]}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Ndikimi payroll</dt>
              <dd className="text-muted-foreground">{payrollImpactLabel(row)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Fillimi</dt>
              <dd className="font-medium tabular-nums">{formatSqDate(row.startDateIso)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Mbarimi</dt>
              <dd className="font-medium tabular-nums">{formatSqDate(row.endDateIso)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Ditë kalendari</dt>
              <dd className="tabular-nums text-muted-foreground">{row.totalDays ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Ditë pune</dt>
              <dd className="tabular-nums text-muted-foreground">{row.workingDays ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Orë të përgjithshme</dt>
              <dd className="tabular-nums text-muted-foreground">{row.totalHours ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Arsyeja</dt>
              <dd className="whitespace-pre-wrap text-muted-foreground">{row.reason?.trim() || "—"}</dd>
            </div>
            {row.rejectionReason ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Refuzimi</dt>
                <dd className="whitespace-pre-wrap text-destructive">{row.rejectionReason}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted-foreground">Vendimi</dt>
              <dd className="text-muted-foreground">
                {row.decidedAtIso ? formatSqDate(row.decidedAtIso) : "—"}
                {row.decidedByLabel ? ` · ${row.decidedByLabel}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Krijuar nga</dt>
              <dd className="text-muted-foreground">{props.detail.createdByLabel ?? "—"}</dd>
            </div>
          </dl>
          {row.type === "PUSHIM_VJETOR" && row.status === "APPROVED" ? (
            <div className="mt-4 space-y-2 border-t border-border/80 pt-4">
              <p className="text-xs font-medium text-muted-foreground">Ndërprerje gjatë pushimit vjetor (Art 34.2)</p>
              {row.interruptedByLeaveRequestId ? (
                <p className="text-sm text-muted-foreground">
                  I lidhur me pushimin mjekësor:{" "}
                  <Link
                    href={`/pushimet/${row.interruptedByLeaveRequestId}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {row.interruptedByLeaveRequestId.slice(0, 12)}…
                  </Link>
                </p>
              ) : (
                <>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Nëse punonjësi është përfshirë nga pushimi mjekësor gjatë këtij intervali, lidhni kërkesën mjekësore për
                    të shmangur dyfishimin e orëve në payroll.
                  </p>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setLinkInterruptOpen(true)}>
                    Lidh pushim mjekësor…
                  </Button>
                </>
              )}
            </div>
          ) : null}
          {row.status === "APPROVED" ? (
            <p className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
              {payrollNarrative}
            </p>
          ) : (
            <p className="mt-4 rounded-md border border-dashed border-border p-3 text-xs leading-relaxed text-muted-foreground">
              {payrollNarrative}
            </p>
          )}
        </Card>

        <Card className="border-border/80 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Dokumentet e gjeneruara</h2>
          <Separator className="my-4" />
          {props.detail.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ende pa dokument. Pas miratimit, gjeneroni nga shabllonet LEAVE dhe arkiva përditësohet automatikisht.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {props.detail.documents.map((d) => (
                <li key={d.leaveDocumentId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                  <div>
                    <p className="font-medium text-foreground">{d.title ?? "Dokument"}</p>
                    <p className="text-xs text-muted-foreground">{d.createdAtIso.slice(0, 19).replace("T", " ")}</p>
                  </div>
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/dokumentet/${d.artifactId}`}>Hape</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Gjendje ditësh sipas vitit</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Akumuluar tregon ditët e pushimit të fituara deri në periudhën e zgjedhur. Festat zyrtare dhe pushimi mjekësor
          i aprovuar gjatë pushimit vjetor nuk zbriten nga bilanci i pushimit vjetor.
        </p>
        {props.balancesByYear.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nuk ka të dhëna balancë për punonjësin.</p>
        ) : (
          props.balancesByYear.map((group) => (
            <Card key={group.year} className="overflow-hidden border-border/80 shadow-sm">
              <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold tabular-nums">
                Viti {group.year}
              </div>
              <Table className="table-dense">
                <TableHeader>
                  <TableRow>
                    <TableHead>Lloji</TableHead>
                    <TableHead>Kuota vjetore</TableHead>
                    <TableHead>Akumuluar</TableHead>
                    <TableHead>Bartur</TableHead>
                    <TableHead>Përdorur</TableHead>
                    <TableHead>Në pritje</TableHead>
                    <TableHead>Mbetur</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.rows.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{LEAVE_TYPE_LABELS_SQ[b.leaveType]}</TableCell>
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
                        {parseFloat(b.remainingDays) < 0 ? (
                          <Badge variant="destructive">{b.remainingDays}</Badge>
                        ) : (
                          b.remainingDays
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ))
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Pushimet në vijim</h2>
          <Separator className="my-4" />
          {props.upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nuk ka pushime aktive në horizont.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {props.upcoming.map((u) => (
                <li key={u.id}>
                  <Link
                    href={`/pushimet/${u.id}`}
                    className={`flex flex-col rounded-md border px-3 py-2 hover:bg-muted/50 ${u.id === row.id ? "border-primary/60 bg-primary/5" : "border-border"}`}
                  >
                    <span className="font-medium">
                      {LEAVE_TYPE_LABELS_SQ[u.type]} · {LEAVE_STATUS_LABELS_SQ[u.status]}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatSqDate(u.startDateIso)} → {formatSqDate(u.endDateIso)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="border-border/80 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Historiku i shkurtër</h2>
          <Separator className="my-4" />
          {props.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nuk ka historik.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {props.history.map((h) => (
                <li key={h.id}>
                  <Link href={`/pushimet/${h.id}`} className="block rounded-md border border-border px-3 py-2 hover:bg-muted/50">
                    <span className="font-medium">
                      {LEAVE_TYPE_LABELS_SQ[h.type]} · {LEAVE_STATUS_LABELS_SQ[h.status]}
                    </span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {formatSqDate(h.startDateIso)} → {formatSqDate(h.endDateIso)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="border-border/80 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Kronologjia & aktiviteti</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Ngjarjet e lidhura me këtë kërkesë (timeline HR + metadata për audit).
        </p>
        <Separator className="my-4" />
        {props.timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ende pa ngjarje të lidhura.</p>
        ) : (
          <ul className="space-y-4">
            {props.timeline.map((ev) => (
              <li key={ev.id} className="border-l-2 border-primary/40 pl-4">
                <p className="text-xs text-muted-foreground tabular-nums">{ev.occurredAtIso.slice(0, 19).replace("T", " ")}</p>
                <p className="font-medium text-foreground">{ev.title}</p>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{ev.eventType}</p>
                {ev.actorLabel ? (
                  <p className="text-xs text-muted-foreground">Aktori: {ev.actorLabel}</p>
                ) : null}
                {ev.body ? <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{ev.body}</p> : null}
                {ev.metadataJson ? (
                  <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted/50 p-2 text-[11px] leading-snug text-muted-foreground">
                    {ev.metadataJson}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuzo kërkesën</DialogTitle>
          </DialogHeader>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setRejectOpen(false)}>
              Mbyll
            </Button>
            <Button type="button" onClick={() => void rejectConfirm()}>
              Konfirmo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoko pushimin e miratuar</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Pushimi kalon në status të anuluar dhe ditët kthehen në balancë. E pamundur nëse
            përputhet me një payroll të kyçur. Arsyeja (opsionale):
          </p>
          <textarea
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setRevokeOpen(false)}>
              Mbyll
            </Button>
            <Button type="button" onClick={() => void revokeConfirm()}>
              Revoko
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gjenero dokument</DialogTitle>
          </DialogHeader>
          {props.templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nuk ka shabllone LEAVE aktive. Kaloni te moduli Dokumentet për të publikuar një version.
            </p>
          ) : (
            <select
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
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setGenOpen(false)}>
              Anulo
            </Button>
            <Button type="button" disabled={props.templates.length === 0} onClick={() => void generateConfirm()}>
              Gjenero
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={linkInterruptOpen} onOpenChange={setLinkInterruptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lidh ndërprerjen (Art 34.2)</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Vendosni ID-në e pushimit mjekësor të miratuar që mbivendoset me këtë pushim vjetor.
          </p>
          <input
            value={sickInterruptLeaveId}
            onChange={(e) => setSickInterruptLeaveId(e.target.value)}
            placeholder="ID kërkese"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setLinkInterruptOpen(false)}>
              Anulo
            </Button>
            <Button type="button" onClick={() => void confirmLinkInterrupt()}>
              Ruaj lidhjen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AppSubBar } from "@/components/layout/app-sub-bar";
import { LeaveStatusBadge } from "@/modules/leaves/components/leave-status-badge";
import {
  BTN_DESTRUCTIVE,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_SECONDARY_DENSE,
  LEAVE_CARD,
  MICRO_LABEL,
  TonePill,
} from "@/modules/leaves/components/leave-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  usedDays: string;
  pendingDays: string;
  remainingDays: string;
  carryOverDays: string;
};

const CARD_TITLE = "text-[13.5px] font-bold tracking-[-0.01em] text-[#0f172a]";
const HAIRLINE = "my-4 border-t border-[#eef2f7]";
const DT = "text-[12px] text-[#94a3b8]";
const DD = "text-[13px] font-medium text-[#111827]";
const DD_MUTED = "text-[13px] text-[#64748b]";
const BAL_TH = "px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.04em] text-[#94a3b8]";
const BAL_TD = "px-4 py-2.5 tabular-nums";

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
    <>
      <AppSubBar
        dense
        backHref="/pushimet"
        backLabel="Kthehu te lista"
        title={`Pushimi — ${LEAVE_TYPE_LABELS_SQ[row.type]}`}
        status={<LeaveStatusBadge status={row.status} />}
        description={
          <>
            {row.employeeName}
            {row.departmentName ? ` · ${row.departmentName}` : ""} · ID:{" "}
            <span className="font-mono tabular-nums">{row.id}</span>
          </>
        }
        actions={
          <>
            {row.status === "PENDING" ? (
              <>
                <button type="button" className={BTN_PRIMARY} onClick={() => void approve()}>
                  Mirato
                </button>
                <button type="button" className={BTN_DESTRUCTIVE} onClick={() => setRejectOpen(true)}>
                  Refuzo
                </button>
              </>
            ) : null}
            {row.status === "DRAFT" || row.status === "PENDING" ? (
              <button type="button" className={BTN_SECONDARY} onClick={() => void cancel()}>
                Anulo
              </button>
            ) : null}
            {row.status === "APPROVED" ? (
              <>
                <button type="button" className={BTN_PRIMARY} onClick={() => setGenOpen(true)}>
                  Gjenero dokument
                </button>
                <button type="button" className={BTN_SECONDARY} onClick={() => setRevokeOpen(true)}>
                  Revoko
                </button>
              </>
            ) : null}
          </>
        }
      />

      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <section className={`p-5 ${LEAVE_CARD}`}>
            <h2 className={CARD_TITLE}>Detajet e kërkesës</h2>
            <div className={HAIRLINE} />
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className={DT}>Lloji</dt>
                <dd className={DD}>{LEAVE_TYPE_LABELS_SQ[row.type]}</dd>
              </div>
              <div>
                <dt className={DT}>Nën-lloji</dt>
                <dd className={DD}>{LEAVE_SUBTYPE_LABELS_SQ[row.subtype]}</dd>
              </div>
              <div>
                <dt className={DT}>Ndikimi payroll</dt>
                <dd className={DD_MUTED}>{payrollImpactLabel(row)}</dd>
              </div>
              <div>
                <dt className={DT}>Fillimi</dt>
                <dd className={`${DD} tabular-nums`}>{formatSqDate(row.startDateIso)}</dd>
              </div>
              <div>
                <dt className={DT}>Mbarimi</dt>
                <dd className={`${DD} tabular-nums`}>{formatSqDate(row.endDateIso)}</dd>
              </div>
              <div>
                <dt className={DT}>Ditë kalendari</dt>
                <dd className={`${DD_MUTED} tabular-nums`}>{row.totalDays ?? "—"}</dd>
              </div>
              <div>
                <dt className={DT}>Ditë pune</dt>
                <dd className={`${DD_MUTED} tabular-nums`}>{row.workingDays ?? "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className={DT}>Orë të përgjithshme</dt>
                <dd className={`${DD_MUTED} tabular-nums`}>{row.totalHours ?? "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className={DT}>Arsyeja</dt>
                <dd className={`${DD_MUTED} whitespace-pre-wrap`}>{row.reason?.trim() || "—"}</dd>
              </div>
              {row.rejectionReason ? (
                <div className="sm:col-span-2">
                  <dt className={DT}>Refuzimi</dt>
                  <dd className="whitespace-pre-wrap text-[13px] text-[#dc2626]">{row.rejectionReason}</dd>
                </div>
              ) : null}
              <div>
                <dt className={DT}>Vendimi</dt>
                <dd className={DD_MUTED}>
                  {row.decidedAtIso ? formatSqDate(row.decidedAtIso) : "—"}
                  {row.decidedByLabel ? ` · ${row.decidedByLabel}` : ""}
                </dd>
              </div>
              <div>
                <dt className={DT}>Krijuar nga</dt>
                <dd className={DD_MUTED}>{props.detail.createdByLabel ?? "—"}</dd>
              </div>
            </dl>
            {row.type === "PUSHIM_VJETOR" && row.status === "APPROVED" ? (
              <div className="mt-4 space-y-2 border-t border-[#eef2f7] pt-4">
                <p className={MICRO_LABEL}>Ndërprerje gjatë pushimit vjetor (Art 34.2)</p>
                {row.interruptedByLeaveRequestId ? (
                  <p className="text-[13px] text-[#64748b]">
                    I lidhur me pushimin mjekësor:{" "}
                    <Link
                      href={`/pushimet/${row.interruptedByLeaveRequestId}`}
                      className="font-semibold text-brand-blue underline-offset-4 hover:underline"
                    >
                      {row.interruptedByLeaveRequestId.slice(0, 12)}…
                    </Link>
                  </p>
                ) : (
                  <>
                    <p className="text-[12px] leading-relaxed text-[#64748b]">
                      Nëse punonjësi është përfshirë nga pushimi mjekësor gjatë këtij intervali, lidhni kërkesën
                      mjekësore për të shmangur dyfishimin e orëve në payroll.
                    </p>
                    <button
                      type="button"
                      className={BTN_SECONDARY_DENSE}
                      onClick={() => setLinkInterruptOpen(true)}
                    >
                      Lidh pushim mjekësor…
                    </button>
                  </>
                )}
              </div>
            ) : null}
            {row.status === "APPROVED" ? (
              <p className="mt-4 rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] p-3 text-[12px] leading-relaxed text-[#64748b]">
                {payrollNarrative}
              </p>
            ) : (
              <p className="mt-4 rounded-[10px] border border-dashed border-[#e2e8f0] p-3 text-[12px] leading-relaxed text-[#64748b]">
                {payrollNarrative}
              </p>
            )}
          </section>

          <section className={`p-5 ${LEAVE_CARD}`}>
            <h2 className={CARD_TITLE}>Dokumentet e gjeneruara</h2>
            <div className={HAIRLINE} />
            {props.detail.documents.length === 0 ? (
              <p className="text-[13px] text-[#64748b]">
                Ende pa dokument. Pas miratimit, gjeneroni nga shabllonet LEAVE dhe arkiva përditësohet
                automatikisht.
              </p>
            ) : (
              <ul className="space-y-2">
                {props.detail.documents.map((d) => (
                  <li
                    key={d.leaveDocumentId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#eef2f7] px-3 py-2 transition-colors hover:bg-[#f8fafc]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[#0f172a]">{d.title ?? "Dokument"}</p>
                      <p className="text-[11.5px] tabular-nums text-[#94a3b8]">
                        {d.createdAtIso.slice(0, 19).replace("T", " ")}
                      </p>
                    </div>
                    <Link href={`/dokumentet/${d.artifactId}`} className={BTN_SECONDARY_DENSE}>
                      Hape
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="space-y-3">
          <div>
            <h2 className={CARD_TITLE}>Gjendje ditësh sipas vitit</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-[#64748b]">
              Akumuluar tregon ditët e pushimit të fituara deri në periudhën e zgjedhur. Festat zyrtare dhe
              pushimi mjekësor i aprovuar gjatë pushimit vjetor nuk zbriten nga bilanci i pushimit vjetor.
            </p>
          </div>
          {props.balancesByYear.length === 0 ? (
            <p className="text-[13px] text-[#64748b]">Nuk ka të dhëna balancë për punonjësin.</p>
          ) : (
            props.balancesByYear.map((group) => (
              <div key={group.year} className={`overflow-hidden ${LEAVE_CARD}`}>
                <div className="border-b border-[#eef2f7] bg-[#f8fafc] px-4 py-2 text-[12px] font-bold tabular-nums text-[#0f172a]">
                  Viti {group.year}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-[13px] text-[#111827]">
                    <thead>
                      <tr className="border-b border-[#eef2f7] bg-[#f8fafc]">
                        <th className={BAL_TH}>Lloji</th>
                        <th className={`${BAL_TH} text-right`}>Kuota vjetore</th>
                        <th className={`${BAL_TH} text-right`}>Akumuluar</th>
                        <th className={`${BAL_TH} text-right`}>Bartur</th>
                        <th className={`${BAL_TH} text-right`}>Përdorur</th>
                        <th className={`${BAL_TH} text-right`}>Në pritje</th>
                        <th className={`${BAL_TH} text-right`}>Mbetur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((b) => (
                        <tr
                          key={b.id}
                          className="border-b border-[#f1f5f9] transition-colors last:border-0 hover:bg-[#f8fafc]"
                        >
                          <td className="px-4 py-2.5 font-medium text-[#0f172a]">
                            {LEAVE_TYPE_LABELS_SQ[b.leaveType]}
                          </td>
                          <td className={`${BAL_TD} text-right`}>{b.yearlyQuota}</td>
                          <td className={`${BAL_TD} text-right`}>
                            {b.leaveType === "PUSHIM_VJETOR" ? b.accruedDays : "—"}
                          </td>
                          <td className={`${BAL_TD} text-right`}>
                            {b.leaveType === "PUSHIM_VJETOR" ? b.carryOverDays : "—"}
                          </td>
                          <td className={`${BAL_TD} text-right`}>{b.usedDays}</td>
                          <td className={`${BAL_TD} text-right`}>
                            {b.leaveType === "PUSHIM_VJETOR" ? b.pendingDays : "—"}
                          </td>
                          <td className={`${BAL_TD} text-right`}>
                            {parseFloat(b.remainingDays) < 0 ? (
                              <TonePill tone="destructive" size="sm">{b.remainingDays}</TonePill>
                            ) : (
                              b.remainingDays
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className={`p-5 ${LEAVE_CARD}`}>
            <h2 className={CARD_TITLE}>Pushimet në vijim</h2>
            <div className={HAIRLINE} />
            {props.upcoming.length === 0 ? (
              <p className="text-[13px] text-[#64748b]">Nuk ka pushime aktive në horizont.</p>
            ) : (
              <ul className="space-y-2">
                {props.upcoming.map((u) => (
                  <li key={u.id}>
                    <Link
                      href={`/pushimet/${u.id}`}
                      className={`flex flex-col rounded-[10px] border px-3 py-2 transition-colors hover:bg-[#f8fafc] ${
                        u.id === row.id ? "border-brand-blue/50 bg-[#eff6ff]" : "border-[#eef2f7]"
                      }`}
                    >
                      <span className="text-[13px] font-semibold text-[#0f172a]">
                        {LEAVE_TYPE_LABELS_SQ[u.type]} · {LEAVE_STATUS_LABELS_SQ[u.status]}
                      </span>
                      <span className="text-[11.5px] tabular-nums text-[#64748b]">
                        {formatSqDate(u.startDateIso)} → {formatSqDate(u.endDateIso)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`p-5 ${LEAVE_CARD}`}>
            <h2 className={CARD_TITLE}>Historiku i shkurtër</h2>
            <div className={HAIRLINE} />
            {props.history.length === 0 ? (
              <p className="text-[13px] text-[#64748b]">Nuk ka historik.</p>
            ) : (
              <ul className="space-y-2">
                {props.history.map((h) => (
                  <li key={h.id}>
                    <Link
                      href={`/pushimet/${h.id}`}
                      className="block rounded-[10px] border border-[#eef2f7] px-3 py-2 transition-colors hover:bg-[#f8fafc]"
                    >
                      <span className="text-[13px] font-semibold text-[#0f172a]">
                        {LEAVE_TYPE_LABELS_SQ[h.type]} · {LEAVE_STATUS_LABELS_SQ[h.status]}
                      </span>
                      <span className="block text-[11.5px] tabular-nums text-[#64748b]">
                        {formatSqDate(h.startDateIso)} → {formatSqDate(h.endDateIso)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className={`p-5 ${LEAVE_CARD}`}>
          <h2 className={CARD_TITLE}>Kronologjia & aktiviteti</h2>
          <p className="mt-1 text-[12px] text-[#64748b]">
            Ngjarjet e lidhura me këtë kërkesë (timeline HR + metadata për audit).
          </p>
          <div className={HAIRLINE} />
          {props.timeline.length === 0 ? (
            <p className="text-[13px] text-[#64748b]">Ende pa ngjarje të lidhura.</p>
          ) : (
            <ul className="space-y-4">
              {props.timeline.map((ev) => (
                <li key={ev.id} className="border-l-2 border-[#bfdbfe] pl-4">
                  <p className="text-[11.5px] tabular-nums text-[#94a3b8]">
                    {ev.occurredAtIso.slice(0, 19).replace("T", " ")}
                  </p>
                  <p className="text-[13.5px] font-semibold text-[#0f172a]">{ev.title}</p>
                  <p className={MICRO_LABEL}>{ev.eventType}</p>
                  {ev.actorLabel ? (
                    <p className="text-[12px] text-[#64748b]">Aktori: {ev.actorLabel}</p>
                  ) : null}
                  {ev.body ? (
                    <p className="mt-1 whitespace-pre-wrap text-[13px] text-[#64748b]">{ev.body}</p>
                  ) : null}
                  {ev.metadataJson ? (
                    <pre className="mt-2 max-h-40 overflow-auto rounded-[10px] border border-[#eef2f7] bg-[#f8fafc] p-2 text-[11px] leading-snug text-[#64748b]">
                      {ev.metadataJson}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

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
    </>
  );
}

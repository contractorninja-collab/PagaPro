"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCan } from "@/components/layout/capability-provider";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addManualPunchAction,
  voidPunchAction,
} from "@/modules/timeclock/actions/timeclock-actions";
import type { PresencePunchDto } from "@/modules/timeclock/services/timeclock-presence-service";

/**
 * Resolves a NEEDS_REVIEW day. The punch log is immutable, so the two fixes on
 * offer are the two that exist: add the missing scan as a MANUAL punch, or void
 * a stray one with a reason. Both leave the original record visible.
 */
export function PrezencaResolveDialog(props: {
  target: {
    employeeId: string;
    employeeName: string;
    workDateIso: string;
    reviewReason: string | null;
    punches: PresencePunchDto[];
  } | null;
  onClose: () => void;
  onResolved: () => void;
}) {
  const { target } = props;

  const canWriteTimeclock = useCan("timeclock.write");
  const [busy, setBusy] = useState(false);
  const [direction, setDirection] = useState<"IN" | "OUT">("OUT");
  // The missing scan is usually the evening out — default to the day at 16:00.
  const [timeValue, setTimeValue] = useState("16:00");
  const [note, setNote] = useState("");
  const [voidTargetId, setVoidTargetId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  if (!target) return null;

  async function submitManual() {
    if (busy || !target) return;
    if (!/^\d{2}:\d{2}$/.test(timeValue)) {
      toast.error("Shkruani orën si HH:MM.");
      return;
    }
    setBusy(true);
    try {
      const r = await addManualPunchAction({
        employeeId: target.employeeId,
        occurredAtIso: `${target.workDateIso}T${timeValue}:00.000Z`,
        direction,
        note: note || `Plotësim manual për ${target.workDateIso}`,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Skanimi u shtua dhe dita u rillogarit.");
      props.onResolved();
    } finally {
      setBusy(false);
    }
  }

  async function submitVoid() {
    if (busy || !voidTargetId) return;
    setBusy(true);
    try {
      const r = await voidPunchAction({ punchId: voidTargetId, reason: voidReason });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Skanimi u anulua dhe dita u rillogarit.");
      setVoidTargetId(null);
      setVoidReason("");
      props.onResolved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && props.onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {target.employeeName} · {target.workDateIso.split("-").reverse().join(".")}
          </DialogTitle>
        </DialogHeader>

        {target.reviewReason ? (
          <p className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[12.5px] text-[#92400e]">
            {target.reviewReason}
          </p>
        ) : null}

        {/* The day's punches, voids included — the full audit picture. */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">
            Skanimet përreth ditës
          </p>
          {target.punches.length === 0 ? (
            <p className="text-[13px] text-[#64748b]">Asnjë skanim i regjistruar.</p>
          ) : (
            <ul className="max-h-44 space-y-1 overflow-y-auto">
              {target.punches.map((p) => (
                <li
                  key={p.id}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px] ${
                    p.voidedAtIso
                      ? "border-[#f1f5f9] bg-[#f8fafc] text-[#94a3b8] line-through"
                      : "border-[#eef2f7]"
                  }`}
                >
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      p.direction === "IN"
                        ? "bg-[#ecfdf5] text-[#15803d]"
                        : "bg-[#eff6ff] text-brand-blue"
                    }`}
                  >
                    {p.direction === "IN" ? "HYRJE" : "DALJE"}
                  </span>
                  <span className="tabular-nums font-medium text-[#0f172a]">
                    {p.occurredAtIso.slice(0, 10).split("-").reverse().join(".")}{" "}
                    {p.occurredAtIso.slice(11, 16)}
                  </span>
                  <span className="text-[#94a3b8]">
                    {p.source === "MANUAL" ? "manual" : p.deviceLabel ?? "kiosk"}
                  </span>
                  {p.voidedAtIso ? (
                    <span className="ml-auto text-[10.5px]">anuluar</span>
                  ) : (
                    <button
                      type="button"
                      className="ml-auto text-[11px] font-semibold text-[#dc2626] hover:underline"
                      onClick={() => {
                        setVoidTargetId(voidTargetId === p.id ? null : p.id);
                        setVoidReason("");
                      }}
                    >
                      Anulo…
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {voidTargetId ? (
          <div className="space-y-2 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3">
            <label htmlFor="void-reason" className="text-[11.5px] font-semibold text-[#7f1d1d]">
              Arsyeja e anulimit të skanimit
            </label>
            <input
              id="void-reason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="p.sh. skanim i dyfishtë gabimisht"
              className="h-9 w-full rounded-lg border border-[#fca5a5] bg-white px-2.5 text-[13px]"
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy || !canWriteTimeclock || voidReason.trim().length < 3}
              onClick={() => void submitVoid()}
            >
              {busy ? "Duke anuluar…" : "Anulo skanimin"}
            </Button>
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border border-[#eef2f7] p-3">
            <p className="text-[11.5px] font-semibold text-[#0f172a]">Shto skanimin që mungon</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value === "IN" ? "IN" : "OUT")}
                aria-label="Drejtimi"
                className="h-9 rounded-lg border border-[#e2e8f0] bg-white px-2 text-[13px]"
              >
                <option value="OUT">Dalje</option>
                <option value="IN">Hyrje</option>
              </select>
              <input
                type="time"
                value={timeValue}
                onChange={(e) => setTimeValue(e.target.value)}
                aria-label="Ora"
                className="h-9 rounded-lg border border-[#e2e8f0] bg-white px-2 text-[13px] tabular-nums"
              />
              <span className="text-[12px] text-[#94a3b8]">
                më {target.workDateIso.split("-").reverse().join(".")} (UTC)
              </span>
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Shënim (opsional) — p.sh. harroi të skanojë në dalje"
              className="h-9 w-full rounded-lg border border-[#e2e8f0] bg-white px-2.5 text-[13px]"
            />
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" disabled={busy} onClick={props.onClose}>
            Mbyll
          </Button>
          {voidTargetId ? null : (
            <Button type="button" disabled={busy || !canWriteTimeclock} onClick={() => void submitManual()}>
              {busy ? "Duke ruajtur…" : "Shto skanimin"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

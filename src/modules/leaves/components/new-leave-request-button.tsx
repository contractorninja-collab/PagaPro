"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCan } from "@/components/layout/capability-provider";
import { Plus } from "lucide-react";
import type { LeaveSubtype, LeaveType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BTN_PRIMARY } from "@/modules/leaves/components/leave-ui";
import {
  createLeaveRequestAction,
  previewLeaveRangeAction,
  type LeaveRangePreview,
} from "@/modules/leaves/actions/leave-actions";
import {
  LEAVE_TYPE_HELP_SQ,
  LEAVE_TYPE_LABELS_SQ,
  LEAVE_SUBTYPE_LABELS_SQ,
  medicalLeaveSubtypeLabel,
  subtypesForLeaveType,
} from "@/modules/leaves/helpers/leave-type-metadata";
import type { PushimetEmployeeOptionDto } from "@/modules/leaves/types/pushimet";

const FIELD =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The single "new leave request" entry point.
 *
 * It used to exist twice on the same screen — a button in a card header and a
 * floating "+ Pushim" pill on mobile, both opening this dialog — so it is a
 * self-contained button here and lives in the sub-bar's actions slot, which is
 * where every other module puts its primary action.
 */
export function NewLeaveRequestButton({ employees }: { employees: PushimetEmployeeOptionDto[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const canWriteLeave = useCan("leave.write");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    employeeId: "",
    type: "PUSHIM_VJETOR" as LeaveType,
    subtype: "NONE" as LeaveSubtype,
    startDateIso: "",
    endDateIso: "",
    reason: "",
  });
  // The balance gate is the one block management may overrule in writing: when
  // the server says INSUFFICIENT_BALANCE, the dialog opens the override panel
  // instead of dead-ending — days go into debt and refill as months accrue.
  /**
   * What the request would mean, shown before it is sent.
   *
   * Holidays, hours-per-day and balances all live in the database, so this is a
   * debounced server call rather than client arithmetic — the same shape the
   * employee form uses for its net-hourly hint.
   */
  const [preview, setPreview] = useState<LeaveRangePreview | null>(null);

  const [overridePanel, setOverridePanel] = useState<{ message: string } | null>(null);
  const [overrideApprovedBy, setOverrideApprovedBy] = useState("");

  function resetOverride() {
    setOverridePanel(null);
    setOverrideApprovedBy("");
  }

  useEffect(() => {
    if (!form.employeeId || !form.startDateIso || !form.endDateIso) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(() => {
      void previewLeaveRangeAction({
        employeeId: form.employeeId,
        type: form.type,
        startDateIso: form.startDateIso,
        endDateIso: form.endDateIso,
      }).then((res) => setPreview(res.ok && res.data ? res.data : null));
    }, 400);
    return () => clearTimeout(timer);
  }, [form.employeeId, form.type, form.startDateIso, form.endDateIso]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employeeId || !form.startDateIso || !form.endDateIso) {
      toast.error("Plotësoni punonjësin dhe datat.");
      return;
    }
    if (overridePanel && overrideApprovedBy.trim().length < 3) {
      toast.error("Shkruani kush e aprovoi tejkalimin e bilancit.");
      return;
    }
    setSaving(true);
    try {
      const r = await createLeaveRequestAction({
        employeeId: form.employeeId,
        type: form.type,
        subtype: form.subtype,
        startDateIso: form.startDateIso,
        endDateIso: form.endDateIso,
        reason: form.reason.trim() || null,
        balanceOverrideApprovedBy: overridePanel ? overrideApprovedBy.trim() : null,
      });
      if (!r.ok) {
        if (r.code === "INSUFFICIENT_BALANCE") {
          setOverridePanel({ message: r.error });
          return;
        }
        toast.error(r.error);
        return;
      }
      if (!r.data?.id) {
        toast.error("Ruajtja dështoi.");
        return;
      }
      toast.success(
        overridePanel
          ? "Kërkesa u dërgua — bilanci tejkalohet me aprovimin e regjistruar."
          : "Kërkesa u dërgua për miratim.",
      );
      setOpen(false);
      setForm((s) => ({ ...s, startDateIso: "", endDateIso: "", reason: "" }));
      resetOverride();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  // The dialog exists only to submit a request, so without leave.write the
  // whole control goes rather than opening a form that cannot be sent.
  if (!canWriteLeave) return null;

  return (
    <>
      <button type="button" className={BTN_PRIMARY} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        Kërkesë e re
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kërkesë e re për pushim</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => void submit(e)}>
            <div className="space-y-1">
              <label htmlFor="nl-emp" className="text-xs font-medium text-muted-foreground">
                Punonjësi
              </label>
              <select
                id="nl-emp"
                required
                value={form.employeeId}
                onChange={(e) => {
                  resetOverride();
                  setForm((s) => ({ ...s, employeeId: e.target.value }));
                }}
                className={FIELD}
              >
                <option value="">Zgjidh…</option>
                {employees.map((em) => (
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
                value={form.type}
                onChange={(e) => {
                  resetOverride();
                  setForm((s) => ({ ...s, type: e.target.value as LeaveType, subtype: "NONE" }));
                }}
                className={FIELD}
              >
                {(Object.keys(LEAVE_TYPE_LABELS_SQ) as LeaveType[]).map((k) => (
                  <option key={k} value={k}>
                    {LEAVE_TYPE_LABELS_SQ[k]}
                  </option>
                ))}
              </select>
              {form.type === "PUSHIM_MJEKESOR" && LEAVE_TYPE_HELP_SQ.PUSHIM_MJEKESOR ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {LEAVE_TYPE_HELP_SQ.PUSHIM_MJEKESOR}
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <label htmlFor="nl-subtype" className="text-xs font-medium text-muted-foreground">
                {form.type === "PUSHIM_MJEKESOR"
                  ? "Nën-lloji mjekësor"
                  : "Nën-lloji (Art 39 / Atersi / Lehonie)"}
              </label>
              <select
                id="nl-subtype"
                value={form.subtype}
                onChange={(e) => setForm((s) => ({ ...s, subtype: e.target.value as LeaveSubtype }))}
                className={FIELD}
              >
                {subtypesForLeaveType(form.type).map((k) => (
                  <option key={k} value={k}>
                    {form.type === "PUSHIM_MJEKESOR"
                      ? medicalLeaveSubtypeLabel(k)
                      : LEAVE_SUBTYPE_LABELS_SQ[k]}
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
                  value={form.startDateIso}
                  onChange={(e) => {
                    resetOverride();
                    setForm((s) => ({ ...s, startDateIso: e.target.value }));
                  }}
                  className={FIELD}
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
                  value={form.endDateIso}
                  onChange={(e) => {
                    resetOverride();
                    setForm((s) => ({ ...s, endDateIso: e.target.value }));
                  }}
                  className={FIELD}
                />
              </div>
            </div>

            {/* What this request would mean, before it is sent. Renders a
                sentence in every state rather than collapsing, so the dialog
                does not jump as dates are picked. */}
            <div className="rounded-md border border-line bg-fill-faint px-3 py-2.5">
              {preview == null ? (
                <p className="text-xs text-muted-foreground">
                  Zgjidhni punonjësin dhe datat për të parë ditët, festat dhe bilancin.
                </p>
              ) : preview.reversed ? (
                <p className="text-xs font-medium text-destructive">
                  Data e mbarimit është para datës së fillimit.
                </p>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs tabular-nums text-ink-700">
                    <span className="font-semibold">{preview.workingDays} ditë pune</span>
                    {` (${preview.calendarDays} kalendarike · ${preview.totalHours} orë)`}
                    {preview.holidayNames.length > 0
                      ? ` · përfshin ${preview.holidayNames.length} festë: ${preview.holidayNames.join(", ")}`
                      : ""}
                  </p>
                  {preview.remainingAfter != null ? (
                    <p
                      className={`text-xs tabular-nums ${
                        Number(preview.remainingAfter) < 0
                          ? "font-semibold text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      Bilanci: {preview.remainingBefore} → {preview.remainingAfter} ditë pas miratimit
                      {Number(preview.remainingAfter) < 0 ? " — kalon në minus" : ""}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {preview.colleaguesOff === 0
                      ? "Askush tjetër nuk është jashtë në këto ditë."
                      : `${preview.colleaguesOff} koleg${preview.colleaguesOff === 1 ? "" : "ë"} jashtë në këto ditë.`}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="nl-reason" className="text-xs font-medium text-muted-foreground">
                Arsyeja / shënim
              </label>
              <textarea
                id="nl-reason"
                rows={3}
                value={form.reason}
                onChange={(e) => setForm((s) => ({ ...s, reason: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            {overridePanel ? (
              <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-[13px] font-semibold text-amber-900">
                  Nuk ka ditë të mjaftueshme të akumuluara
                </p>
                <p className="text-xs leading-relaxed text-amber-900">{overridePanel.message}</p>
                <p className="text-xs leading-relaxed text-amber-800">
                  Menaxhmenti mund ta aprovojë megjithatë: bilanci shkon në minus (borxh ditësh)
                  dhe rimbushet me akumulimin e muajve në vijim. Aprovimi regjistrohet me shkrim
                  në kërkesë dhe në historik.
                </p>
                <div className="space-y-1">
                  <label htmlFor="nl-override-by" className="text-xs font-medium text-amber-900">
                    Kush e aprovoi tejkalimin? (emri / pozita) *
                  </label>
                  <input
                    id="nl-override-by"
                    value={overrideApprovedBy}
                    onChange={(e) => setOverrideApprovedBy(e.target.value)}
                    placeholder="p.sh. Ilir Krasniqi, Drejtor"
                    className={FIELD}
                  />
                </div>
              </div>
            ) : null}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  resetOverride();
                }}
              >
                Mbyll
              </Button>
              <Button type="submit" disabled={saving}>
                {overridePanel ? "Dërgo me tejkalim bilanci" : "Dërgo për miratim"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

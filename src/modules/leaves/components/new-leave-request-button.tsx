"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
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
import { createLeaveRequestAction } from "@/modules/leaves/actions/leave-actions";
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
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    employeeId: "",
    type: "PUSHIM_VJETOR" as LeaveType,
    subtype: "NONE" as LeaveSubtype,
    startDateIso: "",
    endDateIso: "",
    reason: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employeeId || !form.startDateIso || !form.endDateIso) {
      toast.error("Plotësoni punonjësin dhe datat.");
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
      });
      if (!r.ok || !r.data?.id) {
        toast.error(!r.ok ? r.error : "Ruajtja dështoi.");
        return;
      }
      toast.success("Kërkesa u dërgua për miratim.");
      setOpen(false);
      setForm((s) => ({ ...s, startDateIso: "", endDateIso: "", reason: "" }));
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

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
                onChange={(e) => setForm((s) => ({ ...s, employeeId: e.target.value }))}
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
                onChange={(e) =>
                  setForm((s) => ({ ...s, type: e.target.value as LeaveType, subtype: "NONE" }))
                }
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
                  onChange={(e) => setForm((s) => ({ ...s, startDateIso: e.target.value }))}
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
                  onChange={(e) => setForm((s) => ({ ...s, endDateIso: e.target.value }))}
                  className={FIELD}
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
                value={form.reason}
                onChange={(e) => setForm((s) => ({ ...s, reason: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Mbyll
              </Button>
              <Button type="submit" disabled={saving}>
                Dërgo për miratim
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

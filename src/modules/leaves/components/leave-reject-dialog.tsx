"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { rejectLeaveRequestAction } from "@/modules/leaves/actions/leave-actions";

/**
 * The one way to refuse a leave request.
 *
 * Rejecting is an audited decision, so it always records a reason. The two
 * `/paneli` widgets used to call the action with a bare id — which the
 * validator rejects — so "Refuzo" there failed with a validation message while
 * the same button on `/pushimet` worked and demanded a reason.
 */
export function LeaveRejectDialog({
  leaveId,
  onOpenChange,
  onRejected,
}: {
  leaveId: string | null;
  onOpenChange: (open: boolean) => void;
  onRejected?: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (leaveId) setReason("");
  }, [leaveId]);

  async function confirm() {
    if (!leaveId || saving) return;
    setSaving(true);
    try {
      const r = await rejectLeaveRequestAction({
        leaveId,
        rejectionReason: reason.trim() || undefined,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Pushimi u refuzua.");
      onOpenChange(false);
      onRejected?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={leaveId != null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refuzo kërkesën</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Mesazhi përfshihet në audit dhe në kronologjinë e punonjësit.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="Arsyeja e refuzimit…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Mbyll
          </Button>
          <Button type="button" disabled={saving} onClick={() => void confirm()}>
            Konfirmo refuzimin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

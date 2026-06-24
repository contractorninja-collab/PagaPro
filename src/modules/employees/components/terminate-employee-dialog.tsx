"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { terminateEmployeeAction } from "@/modules/employees/actions/employee-actions";

export function TerminateEmployeeDialog(props: {
  employeeId: string;
  employeeLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const { employeeId, employeeLabel, open, onOpenChange, onSuccess } = props;
  const [pending, setPending] = useState(false);
  const [terminationDate, setTerminationDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [terminationReason, setTerminationReason] = useState("");

  const submit = async () => {
    setPending(true);
    try {
      const res = await terminateEmployeeAction({
        employeeId,
        terminationDate,
        terminationReason,
      });
      if (!res.ok) {
        const msg = res.fieldErrors ? Object.values(res.fieldErrors).flat()[0] : undefined;
        toast.error(msg ?? res.error);
        return;
      }
      toast.success("Largimi u regjistrua.");
      onOpenChange(false);
      setTerminationReason("");
      onSuccess?.();
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Largimi i punonjësit</DialogTitle>
          <DialogDescription>
            {employeeLabel} — vendosni datën dhe arsyen e largimit. Ky veprim përfshin përfundimin e periudhës së punës.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="term-date">Data e largimit</Label>
            <Input
              id="term-date"
              type="date"
              value={terminationDate}
              onChange={(e) => setTerminationDate(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="term-reason">Arsyeja</Label>
            <textarea
              id="term-reason"
              className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={terminationReason}
              onChange={(e) => setTerminationReason(e.target.value)}
              disabled={pending}
              placeholder="p.sh. Dorëheqje / marrëveshje / skadim kontrate"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => onOpenChange(false)}>
            Anulo
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={() => void submit()}>
            {pending ? "Duke ruajtur…" : "Konfirmo largimin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

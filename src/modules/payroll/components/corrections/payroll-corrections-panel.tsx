"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { PayrollCorrectionKind } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PayrollDetailDto } from "@/modules/payroll/services/payroll-period-service";
import { createPayrollCorrectionAction } from "@/modules/payroll/actions/payroll-actions";

const KIND_LABELS: Record<PayrollCorrectionKind, string> = {
  NET_ADJUSTMENT: "Ndryshim neto",
  GROSS_ADJUSTMENT: "Ndryshim bruto",
  TAX_ADJUSTMENT: "Tatim",
  PENSION_ADJUSTMENT: "Pension",
  OTHER: "Tjetër",
};

export function PayrollCorrectionsPanel(props: {
  payrollId: string;
  allowCreate: boolean;
  corrections: PayrollDetailDto["corrections"];
  employeeOptions: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState(props.employeeOptions[0]?.id ?? "");
  const [kind, setKind] = useState<PayrollCorrectionKind>("NET_ADJUSTMENT");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) {
      toast.error("Zgjidh punonjësin.");
      return;
    }
    setSaving(true);
    try {
      const r = await createPayrollCorrectionAction({
        payrollId: props.payrollId,
        employeeId,
        kind,
        amount,
        reason,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Korrigjimi u regjistrua.");
      setAmount("");
      setReason("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {!props.allowCreate ? null : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Shto korrigjim</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={(ev) => void submit(ev)}>
              <div className="grid gap-1 sm:col-span-2">
                <Label htmlFor="corr-emp">Punonjësi</Label>
                <select
                  id="corr-emp"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                >
                  {props.employeeOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="corr-kind">Lloji</Label>
                <select
                  id="corr-kind"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as PayrollCorrectionKind)}
                >
                  {(Object.keys(KIND_LABELS) as PayrollCorrectionKind[]).map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="corr-amt">Shuma (EUR)</Label>
                <Input id="corr-amt" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="grid gap-1 sm:col-span-2">
                <Label htmlFor="corr-reason">Arsyeja</Label>
                <Input id="corr-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saving}>
                  Ruaj korrigjimin
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Korrigjimet e regjistruara</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {props.corrections.length === 0 ? (
            <p className="text-muted-foreground">Nuk ka korrigjime për këtë payroll.</p>
          ) : (
            <ul className="space-y-2">
              {props.corrections.map((c) => (
                <li key={c.id} className="rounded-md border border-border bg-card px-3 py-2">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">{c.employeeName}</span>
                    <span className="tabular-nums text-muted-foreground">€{c.amount}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {KIND_LABELS[c.kind as PayrollCorrectionKind] ?? c.kind} · {c.personalId}
                  </div>
                  <p className="mt-1 text-xs">{c.reason}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(c.createdAt).toLocaleString("sq-XK")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

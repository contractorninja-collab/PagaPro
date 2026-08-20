"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Info, Plus } from "lucide-react";
import type { PayrollCorrectionKind, PayrollPeriodStatus } from "@prisma/client";
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
import type { PayrollDetailDto } from "@/modules/payroll/services/payroll-period-service";
import { createPayrollCorrectionAction } from "@/modules/payroll/actions/payroll-actions";
import { CARD, CARD_TITLE } from "@/modules/payroll/components/payroll-card";
import { cn } from "@/lib/utils";

const KIND_LABELS: Record<PayrollCorrectionKind, string> = {
  NET_ADJUSTMENT: "Ndryshim neto",
  GROSS_ADJUSTMENT: "Ndryshim bruto",
  TAX_ADJUSTMENT: "Tatim",
  PENSION_ADJUSTMENT: "Pension",
  OTHER: "Tjetër",
};

const SELECT =
  "h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink-700 focus-visible:border-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30";

/** A correction can add or take away; the sign has to be unmissable. */
function signedAmount(raw: string): { text: string; negative: boolean } {
  const n = Number(String(raw).trim().replace(",", "."));
  if (!Number.isFinite(n)) return { text: `€${raw}`, negative: false };
  const negative = n < 0;
  return {
    text: `${negative ? "−" : "+"}€${Math.abs(n).toFixed(2)}`,
    negative,
  };
}

export function PayrollCorrectionsPanel(props: {
  payrollId: string;
  status: PayrollPeriodStatus;
  allowCreate: boolean;
  corrections: PayrollDetailDto["corrections"];
  employeeOptions: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Before locking, the form simply vanished with no explanation, which read
          as a broken tab. Say where the edit actually belongs. */}
      {!props.allowCreate ? (
        <p className="flex items-start gap-2 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-[13px] text-[#1e40af]">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Korrigjimet regjistrohen vetëm pasi payroll-i të jetë i kyçur. Deri atëherë ndryshoni vlerat
          drejtpërdrejt në spreadsheet.
        </p>
      ) : null}

      <section className={CARD}>
        <div className={cn(CARD_TITLE, "flex flex-wrap items-center justify-between gap-3")}>
          <span>Korrigjimet e regjistruara</span>
          {props.allowCreate ? (
            <Button type="button" size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Shto korrigjim
            </Button>
          ) : null}
        </div>

        {props.corrections.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">
            Nuk ka korrigjime për këtë payroll.
          </p>
        ) : (
          <ul className="divide-y divide-fill">
            {props.corrections.map((c) => {
              const amt = signedAmount(c.amount);
              return (
                <li key={c.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[13px] font-semibold text-ink-900">{c.employeeName}</span>
                    <span
                      className={cn(
                        "text-[13px] font-bold [font-variant-numeric:tabular-nums]",
                        amt.negative ? "text-[#b91c1c]" : "text-[#047857]",
                      )}
                    >
                      {amt.text}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {KIND_LABELS[c.kind as PayrollCorrectionKind] ?? c.kind} · {c.personalId} ·{" "}
                    <span className="[font-variant-numeric:tabular-nums]">
                      {new Date(c.createdAt).toLocaleString("sq-XK")}
                    </span>
                  </p>
                  {c.reason ? <p className="mt-1 text-[13px] text-ink-600">{c.reason}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Shto korrigjim</DialogTitle>
            <DialogDescription>
              Korrigjimet nuk ndryshojnë payroll-in e kyçur — ato regjistrohen veçmas si gjurmë.
              Përdorni shenjën minus për një zbritje.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(ev) => void submit(ev)}>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="corr-emp">Punonjësi</Label>
              <select
                id="corr-emp"
                className={SELECT}
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
            <div className="grid gap-1.5">
              <Label htmlFor="corr-kind">Lloji</Label>
              <select
                id="corr-kind"
                className={SELECT}
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
            <div className="grid gap-1.5">
              <Label htmlFor="corr-amt">Shuma (EUR)</Label>
              <Input
                id="corr-amt"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00 ose -0.00"
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="corr-reason">Arsyeja</Label>
              <Input id="corr-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
                Anulo
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Duke ruajtur…" : "Ruaj korrigjimin"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

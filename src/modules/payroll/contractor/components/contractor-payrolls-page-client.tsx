"use client";

import type React from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppSubBar } from "@/components/layout/app-sub-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { createContractorPayrollAction } from "@/modules/payroll/contractor/contractor-actions";
import type { ContractorPeriodListRowDto } from "@/modules/payroll/contractor/contractor-payroll-service";
import { PayrollModeSwitch } from "@/modules/payroll/contractor/components/payroll-mode-switch";
import { payrollMonthLabel, payrollMonthNameSq } from "@/modules/payroll/helpers/month-label";

const STATUS_LABELS: Record<string, { label: string; variant: "secondary" | "success" }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  LOCKED: { label: "I kyçur", variant: "success" },
  ARCHIVED: { label: "I arkivuar", variant: "secondary" },
};

function formatEuro(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return `€${raw}`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }).format(n);
}

export function ContractorPayrollsPageClient(props: { rows: ContractorPeriodListRowDto[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const now = useMemo(() => new Date(), []);
  const [createMonth, setCreateMonth] = useState(String(now.getMonth() + 1));
  const [createYear, setCreateYear] = useState(String(now.getFullYear()));
  const [pending, setPending] = useState(false);

  const yearChoices = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1];
  }, [now]);

  return (
    <>
      <AppSubBar
        eyebrow="Payroll"
        title="Pagat — Kontraktor"
        description="Payroll i veçantë për kontraktorë: orë × tarifë orare, bruto = neto (pa tatim, pa Trust)."
        actions={
          <Button
            type="button"
            className="h-10 gap-[7px] rounded-[10px] bg-brand-blue px-[18px] text-[13.5px] font-semibold text-white hover:bg-[#1d4ed8]"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden />
            Krijo periudhë
          </Button>
        }
      />

      <div>
        <PayrollModeSwitch mode="kontraktor" />

        {props.rows.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-[#e2e8f0] bg-white p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Ende asnjë periudhë kontraktorësh. Krijoni të parën me butonin lart djathtas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[12px] border border-[#e2e8f0] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e2e8f0] text-left text-[12px] uppercase tracking-wide text-[#94a3b8]">
                  <th className="px-4 py-3 font-semibold">Periudha</th>
                  <th className="px-4 py-3 font-semibold">Statusi</th>
                  <th className="px-4 py-3 text-center font-semibold">Kontraktorë</th>
                  <th className="px-4 py-3 text-right font-semibold">Total bruto</th>
                  <th className="px-4 py-3 text-right font-semibold">Veprime</th>
                </tr>
              </thead>
              <tbody>
                {props.rows.map((r) => {
                  const status = STATUS_LABELS[r.status] ?? STATUS_LABELS.DRAFT!;
                  return (
                    <tr key={r.id} className="border-b border-[#f1f5f9] last:border-0 hover:bg-[#f8fafc]">
                      <td className="px-4 py-3 font-semibold text-[#0f172a]">
                        {payrollMonthLabel(r.year, r.month)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums">{r.entryCount}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatEuro(r.totalGross)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/pagat/kontraktor/${r.id}`}
                          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-blue hover:underline"
                        >
                          Hap <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Krijo periudhë kontraktorësh</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="ctr-create-month">Muaji</Label>
              <select
                id="ctr-create-month"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                value={createMonth}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCreateMonth(e.target.value)}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={String(i + 1)}>
                    {payrollMonthNameSq(i + 1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ctr-create-year">Viti</Label>
              <select
                id="ctr-create-year"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                value={createYear}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCreateYear(e.target.value)}
              >
                {yearChoices.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              Përfshihen automatikisht të gjithë punonjësit me tip punësimi <strong>Kontraktor</strong>{" "}
              (aktivë gjatë muajit). Orët plotësohen pas krijimit — me dorë ose nga ora e punës.
            </p>
          </div>
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>
              Anulo
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                void (async () => {
                  setPending(true);
                  const r = await createContractorPayrollAction({
                    year: Number(createYear),
                    month: Number(createMonth),
                  });
                  setPending(false);
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  toast.success("Periudha u krijua.");
                  setCreateOpen(false);
                  router.push(`/pagat/kontraktor/${r.data?.id}`);
                })()
              }
            >
              {pending ? "Duke krijuar…" : "Krijo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postMonthlyLeaveAccrualAction } from "@/modules/leaves/actions/leave-admin-actions";

function defaultPreviousUtcMonth(): { year: number; month: number } {
  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 12, 0, 0, 0));
  return { year: prev.getUTCFullYear(), month: prev.getUTCMonth() + 1 };
}

export function LeaveMonthlyAccrualPanel() {
  const defaults = useMemo(() => defaultPreviousUtcMonth(), []);
  const [yearStr, setYearStr] = useState(String(defaults.year));
  const [monthStr, setMonthStr] = useState(String(defaults.month));
  const [pending, startTransition] = useTransition();

  function runPost() {
    const periodYear = Number(yearStr);
    const periodMonth = Number(monthStr);
    if (!Number.isFinite(periodYear) || periodYear < 1970 || periodYear > 2100) {
      toast.error("Viti nuk është i vlefshëm.");
      return;
    }
    if (!Number.isFinite(periodMonth) || periodMonth < 1 || periodMonth > 12) {
      toast.error("Muaji duhet të jetë 1–12.");
      return;
    }

    startTransition(() => {
      void (async () => {
        const r = await postMonthlyLeaveAccrualAction({ periodYear, periodMonth });
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        if (r.data == null) {
          toast.error("Përgjigje e papritur.");
          return;
        }
        toast.success(
          `Akumulimi u përpunua: ${r.data.created} rreshta të rinj, ${r.data.skipped} anashkaluar (ekzistojnë ose jo aktivë).`,
        );
      })();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Akumulimi mujor (Art 36)</CardTitle>
        <CardDescription>
          Poston rreshta në <span className="font-mono text-xs">leave_accrual_ledger</span> për të gjithë punonjësit{" "}
          <span className="font-medium">ACTIVE</span>/<span className="font-medium">ON_LEAVE</span> sipas politikës së
          kompanisë (<span className="font-mono text-xs">monthlyAccrualDays</span>). Operacion idempotent për çdo
          kombinim punonjës–muaj.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid max-w-md grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="accrual-year">Viti (UTC)</Label>
            <Input
              id="accrual-year"
              className="tabular-nums"
              inputMode="numeric"
              value={yearStr}
              onChange={(e) => setYearStr(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accrual-month">Muaji (1–12)</Label>
            <Input
              id="accrual-month"
              className="tabular-nums"
              inputMode="numeric"
              value={monthStr}
              onChange={(e) => setMonthStr(e.target.value)}
              disabled={pending}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={pending} onClick={() => runPost()}>
            {pending ? "Duke u përpunuar…" : "Posto akumulimin për këtë muaj"}
          </Button>
          <p className="text-xs text-muted-foreground">
            API për automatizim: <span className="font-mono">POST /api/leaves/monthly-accrual</span> me cookie kompanie,
            ose <span className="font-mono">Bearer LEAVE_ACCRUAL_JOB_SECRET</span> +{" "}
            <span className="font-mono">companyId</span> në trup — shih <span className="font-mono">.env.example</span>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

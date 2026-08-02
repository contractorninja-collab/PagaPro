"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  setBrandGroupDiscountAction,
  setCompanyBillingAction,
} from "@/modules/admin/actions/admin-actions";
import type {
  BillingPaymentState,
  BillingPlanDto,
  CompanyBillingDto,
} from "@/modules/admin/services/admin-billing-service";

const PAYMENT_LABELS: Record<
  BillingPaymentState,
  { label: string; variant: "success" | "warning" | "secondary" | "destructive" }
> = {
  PAID: { label: "I paguar", variant: "success" },
  GRACE: { label: "Në tolerancë", variant: "warning" },
  OVERDUE: { label: "Vonesë", variant: "destructive" },
  UNPAID: { label: "I papaguar", variant: "destructive" },
  NO_PLAN: { label: "Pa paketë", variant: "secondary" },
};

function dateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm";

export function BillingCard(props: {
  companyId: string;
  billing: CompanyBillingDto;
  plans: BillingPlanDto[];
  brandGroup: {
    id: string;
    name: string;
    discountPercent: string | null;
    discountAmountEur: string | null;
  } | null;
}) {
  const { billing, plans } = props;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [planId, setPlanId] = useState(billing.billingPlanId ?? "");
  const [cycle, setCycle] = useState<"MONTHLY" | "ANNUAL">(billing.billingCycle);
  const [override, setOverride] = useState(billing.billingPriceOverrideEur ?? "");
  const [paid, setPaid] = useState(billing.billingPaid);
  const [paidUntil, setPaidUntil] = useState(dateInput(billing.billingPaidUntil));
  const [startDate, setStartDate] = useState(dateInput(billing.billingStartDate));
  const [endDate, setEndDate] = useState(dateInput(billing.billingEndDate));
  const [graceDays, setGraceDays] = useState(String(billing.billingGraceDays));
  const [notes, setNotes] = useState(billing.billingNotes ?? "");

  const [discountPercent, setDiscountPercent] = useState(props.brandGroup?.discountPercent ?? "");
  const [discountAmount, setDiscountAmount] = useState(props.brandGroup?.discountAmountEur ?? "");

  const selectedPlan = plans.find((p) => p.id === planId) ?? null;
  const planPrice = selectedPlan
    ? cycle === "ANNUAL"
      ? selectedPlan.annualPriceEur
      : selectedPlan.monthlyPriceEur
    : null;
  const effective = override.trim() !== "" ? override : planPrice;
  const payment = PAYMENT_LABELS[billing.paymentState];
  const cap = selectedPlan?.maxActiveEmployees ?? null;
  const overCap = cap != null && billing.activeEmployees > cap;

  function save() {
    startTransition(async () => {
      const res = await setCompanyBillingAction({
        companyId: props.companyId,
        billingPlanId: planId || null,
        billingCycle: cycle,
        billingPriceOverrideEur: override.trim() === "" ? null : override.replace(",", "."),
        billingPaid: paid,
        billingPaidUntil: paidUntil || null,
        billingStartDate: startDate || null,
        billingEndDate: endDate || null,
        billingGraceDays: graceDays === "" ? 7 : graceDays,
        billingNotes: notes,
      });
      if (res.ok) {
        toast.success("Faturimi u ruajt.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function saveDiscount() {
    if (!props.brandGroup) return;
    const groupId = props.brandGroup.id;
    startTransition(async () => {
      const res = await setBrandGroupDiscountAction({
        brandGroupId: groupId,
        discountPercent: discountPercent.trim() === "" ? null : discountPercent.replace(",", "."),
        discountAmountEur: discountAmount.trim() === "" ? null : discountAmount.replace(",", "."),
      });
      if (res.ok) {
        toast.success("Zbritja e grupit u ruajt.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" aria-hidden />
            Faturimi
          </CardTitle>
          <CardDescription>
            Paketa, cikli i pagesës dhe gjendja e pagesës — vetëm për konsolën, klienti nuk i sheh.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={payment.variant}>{payment.label}</Badge>
          <Badge variant={overCap ? "destructive" : "secondary"} className="font-normal">
            {billing.activeEmployees}
            {cap != null ? ` / ${cap}` : ""} punonjës aktivë
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="billing-plan">Paketa</Label>
            <select
              id="billing-plan"
              className={selectClass}
              value={planId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPlanId(e.target.value)}
            >
              <option value="">— Pa paketë —</option>
              {plans
                .filter((p) => p.isActive || p.id === planId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (€{p.monthlyPriceEur}/muaj · €{p.annualPriceEur}/vit)
                  </option>
                ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="billing-cycle">Cikli i pagesës</Label>
            <select
              id="billing-cycle"
              className={selectClass}
              value={cycle}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setCycle(e.target.value === "ANNUAL" ? "ANNUAL" : "MONTHLY")
              }
            >
              <option value="MONTHLY">Mujor</option>
              <option value="ANNUAL">Vjetor</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="billing-override">Çmim i negociuar (€, opsional)</Label>
            <Input
              id="billing-override"
              inputMode="decimal"
              placeholder={planPrice ? `Standard: €${planPrice}` : "—"}
              value={override}
              onChange={(e) => setOverride(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="billing-start">Data e fillimit</Label>
            <Input
              id="billing-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="billing-end">Data e mbarimit (bosh = pa afat)</Label>
            <Input
              id="billing-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="billing-grace">Tolerancë pagese (ditë)</Label>
            <Input
              id="billing-grace"
              inputMode="numeric"
              value={graceDays}
              onChange={(e) => setGraceDays(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="billing-paid-until">Paguar deri më</Label>
            <Input
              id="billing-paid-until"
              type="date"
              value={paidUntil}
              onChange={(e) => setPaidUntil(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Pas kësaj date + tolerancës, klienti shënohet automatikisht &quot;Vonesë&quot;.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="billing-paid">Pagesa aktuale</Label>
            <label className="flex h-10 cursor-pointer items-center gap-2 text-sm" htmlFor="billing-paid">
              <input
                id="billing-paid"
                type="checkbox"
                checked={paid}
                onChange={(e) => setPaid(e.target.checked)}
              />
              I paguar
            </label>
          </div>
          <div className="grid gap-2 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="billing-notes">Shënime</Label>
            <Input
              id="billing-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="p.sh. muaji i parë falas deri më…"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/60 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Çmimi efektiv:{" "}
            <strong className="text-foreground">
              {effective ? `€${effective} / ${cycle === "ANNUAL" ? "vit" : "muaj"}` : "—"}
            </strong>
          </p>
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? "Duke ruajtur…" : "Ruaj faturimin"}
          </Button>
        </div>

        {props.brandGroup ? (
          <div className="space-y-3 rounded-md border border-border p-4">
            <p className="text-sm font-semibold text-foreground">
              Zbritje për grupin &quot;{props.brandGroup.name}&quot;
            </p>
            <p className="text-xs text-muted-foreground">
              Aplikohet një herë mbi totalin e të gjitha kompanive të grupit — në përqindje, shumë
              fikse €, ose të dyja.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="discount-percent">Zbritje %</Label>
                <Input
                  id="discount-percent"
                  inputMode="decimal"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="discount-amount">Zbritje fikse €/muaj</Label>
                <Input
                  id="discount-amount"
                  inputMode="decimal"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button type="button" variant="secondary" onClick={saveDiscount} disabled={pending}>
                  Ruaj zbritjen
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

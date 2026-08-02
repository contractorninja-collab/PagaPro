"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/patterns/page-header";
import { adminPath } from "@/lib/admin-path";
import { upsertBillingPlanAction } from "@/modules/admin/actions/admin-actions";
import type {
  BillingPaymentState,
  BillingPlanDto,
  FinancesDto,
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

function euro(v: string | null): string {
  if (v == null) return "—";
  return `€${v}`;
}

interface PlanDraft {
  id?: string;
  name: string;
  monthlyPriceEur: string;
  annualPriceEur: string;
  maxActiveEmployees: string;
  isActive: boolean;
  notes: string;
}

const EMPTY_PLAN: PlanDraft = {
  name: "",
  monthlyPriceEur: "",
  annualPriceEur: "",
  maxActiveEmployees: "",
  isActive: true,
  notes: "",
};

export function FinancatClient(props: { finances: FinancesDto; plans: BillingPlanDto[] }) {
  const { finances, plans } = props;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [planDraft, setPlanDraft] = useState<PlanDraft | null>(null);

  function savePlan() {
    if (!planDraft) return;
    const draft = planDraft;
    startTransition(async () => {
      const res = await upsertBillingPlanAction({
        id: draft.id,
        name: draft.name,
        monthlyPriceEur: draft.monthlyPriceEur.replace(",", "."),
        annualPriceEur: draft.annualPriceEur.replace(",", "."),
        maxActiveEmployees: draft.maxActiveEmployees.trim() === "" ? null : draft.maxActiveEmployees,
        isActive: draft.isActive,
        notes: draft.notes,
      });
      if (res.ok) {
        toast.success("Paketa u ruajt.");
        setPlanDraft(null);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const ungroupedRows = finances.companies.filter((c) => !c.brandGroupId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financat"
        description="Të hyrat e pritura nga klientët — paketat, pagesat dhe zbritjet e grupeve."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Të hyra mujore të pritura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">€{finances.totals.expectedMonthlyEur}</p>
            <p className="text-xs text-muted-foreground">
              ≈ €{finances.totals.expectedAnnualEur} në vit
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Klientë pagues</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{finances.totals.payingCompanies}</p>
            <p className="text-xs text-muted-foreground">me pagesë në rregull ose në tolerancë</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Të papaguar / vonesë
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-destructive">
              {finances.totals.unpaidOrOverdue}
            </p>
            <p className="text-xs text-muted-foreground">kërkojnë ndjekje</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pa paketë</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{finances.totals.withoutPlan}</p>
            <p className="text-xs text-muted-foreground">ende pa plan të caktuar</p>
          </CardContent>
        </Card>
      </div>

      {finances.groups.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Grupet e brendeve</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grupi</TableHead>
                  <TableHead className="text-center">Kompani</TableHead>
                  <TableHead className="text-right">Nëntotali €/muaj</TableHead>
                  <TableHead className="text-right">Zbritja</TableHead>
                  <TableHead className="text-right">Totali €/muaj</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {finances.groups.map((g) => (
                  <TableRow key={g.brandGroupId}>
                    <TableCell className="font-medium">{g.brandGroupName}</TableCell>
                    <TableCell className="text-center">{g.companyCount}</TableCell>
                    <TableCell className="text-right tabular-nums">€{g.subtotalMonthlyEur}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      −€{g.discountMonthlyEur}
                      {g.discountPercent ? ` (${g.discountPercent}%)` : ""}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      €{g.totalMonthlyEur}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Klientët</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Biznesi</TableHead>
                <TableHead>Grupi</TableHead>
                <TableHead>Paketa</TableHead>
                <TableHead>Cikli</TableHead>
                <TableHead className="text-right">Çmimi</TableHead>
                <TableHead className="text-right">€/muaj ekuiv.</TableHead>
                <TableHead className="text-center">Punonjës aktivë</TableHead>
                <TableHead>Pagesa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {finances.companies.map((c) => {
                const payment = PAYMENT_LABELS[c.paymentState];
                const overCap =
                  c.planMaxActiveEmployees != null && c.activeEmployees > c.planMaxActiveEmployees;
                return (
                  <TableRow key={c.companyId}>
                    <TableCell>
                      <Link
                        href={adminPath(`bizneset/${c.companyId}`)}
                        className="font-medium hover:underline"
                      >
                        {c.legalName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.brandGroupName ?? "—"}</TableCell>
                    <TableCell>{c.planName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.cycle === "ANNUAL" ? "Vjetor" : "Mujor"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{euro(c.effectivePriceEur)}</TableCell>
                    <TableCell className="text-right tabular-nums">€{c.monthlyEquivalentEur}</TableCell>
                    <TableCell
                      className={`text-center tabular-nums ${overCap ? "font-semibold text-destructive" : ""}`}
                    >
                      {c.activeEmployees}
                      {c.planMaxActiveEmployees != null ? ` / ${c.planMaxActiveEmployees}` : ""}
                    </TableCell>
                    <TableCell>
                      <Badge variant={payment.variant}>{payment.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {ungroupedRows.length === 0 && finances.companies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Ende nuk ka klientë.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Paketat (çmimore)</CardTitle>
          <Button type="button" size="sm" onClick={() => setPlanDraft({ ...EMPTY_PLAN })}>
            <Plus className="h-4 w-4" aria-hidden />
            Paketë e re
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Emri</TableHead>
                <TableHead className="text-right">€/muaj</TableHead>
                <TableHead className="text-right">€/vit</TableHead>
                <TableHead className="text-center">Max punonjës</TableHead>
                <TableHead>Shënime</TableHead>
                <TableHead>Statusi</TableHead>
                <TableHead className="text-right">Veprime</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right tabular-nums">€{p.monthlyPriceEur}</TableCell>
                  <TableCell className="text-right tabular-nums">€{p.annualPriceEur}</TableCell>
                  <TableCell className="text-center">{p.maxActiveEmployees ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.notes ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={p.isActive ? "success" : "secondary"}>
                      {p.isActive ? "Aktive" : "E çaktivizuar"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setPlanDraft({
                          id: p.id,
                          name: p.name,
                          monthlyPriceEur: p.monthlyPriceEur,
                          annualPriceEur: p.annualPriceEur,
                          maxActiveEmployees: p.maxActiveEmployees?.toString() ?? "",
                          isActive: p.isActive,
                          notes: p.notes ?? "",
                        })
                      }
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      Ndrysho
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={planDraft != null} onOpenChange={(open) => !open && setPlanDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{planDraft?.id ? "Ndrysho paketën" : "Paketë e re"}</DialogTitle>
          </DialogHeader>
          {planDraft ? (
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="plan-name">Emri</Label>
                <Input
                  id="plan-name"
                  value={planDraft.name}
                  onChange={(e) => setPlanDraft({ ...planDraft, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="plan-monthly">€/muaj</Label>
                  <Input
                    id="plan-monthly"
                    inputMode="decimal"
                    value={planDraft.monthlyPriceEur}
                    onChange={(e) => setPlanDraft({ ...planDraft, monthlyPriceEur: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plan-annual">€/vit</Label>
                  <Input
                    id="plan-annual"
                    inputMode="decimal"
                    value={planDraft.annualPriceEur}
                    onChange={(e) => setPlanDraft({ ...planDraft, annualPriceEur: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plan-max">Max punonjës aktivë (bosh = pa kufi)</Label>
                <Input
                  id="plan-max"
                  inputMode="numeric"
                  value={planDraft.maxActiveEmployees}
                  onChange={(e) => setPlanDraft({ ...planDraft, maxActiveEmployees: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plan-notes">Shënime</Label>
                <Input
                  id="plan-notes"
                  value={planDraft.notes}
                  onChange={(e) => setPlanDraft({ ...planDraft, notes: e.target.value })}
                  placeholder="p.sh. 4–9 punonjës"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm" htmlFor="plan-active">
                <input
                  id="plan-active"
                  type="checkbox"
                  checked={planDraft.isActive}
                  onChange={(e) => setPlanDraft({ ...planDraft, isActive: e.target.checked })}
                />
                Aktive (e zgjedhshme për klientë të rinj)
              </label>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => setPlanDraft(null)}>
              Anulo
            </Button>
            <Button type="button" onClick={savePlan} disabled={pending}>
              {pending ? "Duke ruajtur…" : "Ruaj paketën"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

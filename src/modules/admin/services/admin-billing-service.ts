import { Prisma as PrismaNs } from "@prisma/client";
import type { BillingCycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Platform billing (admin console only). Everything here is about what WE
 * charge clients — it never leaks into tenant pages. Revenue is computed,
 * not stored: plan price (or negotiated override) per cycle, summed per
 * brand group, minus the group's manual discount.
 */

export interface BillingPlanDto {
  id: string;
  name: string;
  monthlyPriceEur: string;
  annualPriceEur: string;
  maxActiveEmployees: number | null;
  isActive: boolean;
  notes: string | null;
}

export async function listBillingPlansForAdmin(): Promise<BillingPlanDto[]> {
  const rows = await prisma.billingPlan.findMany({ orderBy: { monthlyPriceEur: "asc" } });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    monthlyPriceEur: p.monthlyPriceEur.toFixed(2),
    annualPriceEur: p.annualPriceEur.toFixed(2),
    maxActiveEmployees: p.maxActiveEmployees,
    isActive: p.isActive,
    notes: p.notes,
  }));
}

export interface UpsertBillingPlanInput {
  id?: string;
  name: string;
  monthlyPriceEur: number;
  annualPriceEur: number;
  maxActiveEmployees: number | null;
  isActive: boolean;
  notes: string | null;
}

export async function upsertBillingPlanForAdmin(
  input: UpsertBillingPlanInput,
): Promise<{ ok: true; id: string } | { ok: false; code: "DUPLICATE_NAME" | "DB_ERROR" }> {
  try {
    const data = {
      name: input.name,
      monthlyPriceEur: new PrismaNs.Decimal(input.monthlyPriceEur),
      annualPriceEur: new PrismaNs.Decimal(input.annualPriceEur),
      maxActiveEmployees: input.maxActiveEmployees,
      isActive: input.isActive,
      notes: input.notes,
    };
    const row = input.id
      ? await prisma.billingPlan.update({ where: { id: input.id }, data })
      : await prisma.billingPlan.create({ data });
    return { ok: true, id: row.id };
  } catch (e) {
    if (e instanceof PrismaNs.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, code: "DUPLICATE_NAME" };
    }
    console.error("upsertBillingPlanForAdmin failed", e);
    return { ok: false, code: "DB_ERROR" };
  }
}

export interface SetCompanyBillingInput {
  billingPlanId: string | null;
  billingCycle: BillingCycle;
  billingPriceOverrideEur: number | null;
  billingPaid: boolean;
  billingPaidUntil: Date | null;
  billingStartDate: Date | null;
  billingEndDate: Date | null;
  billingGraceDays: number;
  billingNotes: string | null;
}

export async function setCompanyBillingForAdmin(
  companyId: string,
  input: SetCompanyBillingInput,
): Promise<boolean> {
  const res = await prisma.company.updateMany({
    where: { id: companyId },
    data: {
      billingPlanId: input.billingPlanId,
      billingCycle: input.billingCycle,
      billingPriceOverrideEur:
        input.billingPriceOverrideEur != null
          ? new PrismaNs.Decimal(input.billingPriceOverrideEur)
          : null,
      billingPaid: input.billingPaid,
      billingPaidUntil: input.billingPaidUntil,
      billingStartDate: input.billingStartDate,
      billingEndDate: input.billingEndDate,
      billingGraceDays: input.billingGraceDays,
      billingNotes: input.billingNotes,
    },
  });
  return res.count > 0;
}

export async function setBrandGroupDiscountForAdmin(
  brandGroupId: string,
  discountPercent: number | null,
  discountAmountEur: number | null,
): Promise<boolean> {
  const res = await prisma.companyBrandGroup.updateMany({
    where: { id: brandGroupId },
    data: {
      discountPercent: discountPercent != null ? new PrismaNs.Decimal(discountPercent) : null,
      discountAmountEur: discountAmountEur != null ? new PrismaNs.Decimal(discountAmountEur) : null,
    },
  });
  return res.count > 0;
}

export type BillingPaymentState = "PAID" | "GRACE" | "OVERDUE" | "UNPAID" | "NO_PLAN";

export function derivePaymentState(params: {
  hasPlan: boolean;
  billingPaid: boolean;
  billingPaidUntil: Date | null;
  billingGraceDays: number;
  now?: Date;
}): BillingPaymentState {
  if (!params.hasPlan) return "NO_PLAN";
  const now = params.now ?? new Date();
  if (params.billingPaidUntil) {
    if (now.getTime() <= params.billingPaidUntil.getTime()) return "PAID";
    const graceEnd =
      params.billingPaidUntil.getTime() + params.billingGraceDays * 24 * 60 * 60 * 1000;
    if (now.getTime() <= graceEnd) return "GRACE";
    return "OVERDUE";
  }
  return params.billingPaid ? "PAID" : "UNPAID";
}

export interface CompanyBillingDto {
  billingPlanId: string | null;
  billingPlanName: string | null;
  planMaxActiveEmployees: number | null;
  billingCycle: BillingCycle;
  billingPriceOverrideEur: string | null;
  /** Plan price for the chosen cycle unless overridden. */
  effectivePriceEur: string | null;
  billingPaid: boolean;
  billingPaidUntil: string | null;
  billingStartDate: string | null;
  billingEndDate: string | null;
  billingGraceDays: number;
  billingNotes: string | null;
  paymentState: BillingPaymentState;
  activeEmployees: number;
}

function effectivePrice(
  plan: { monthlyPriceEur: PrismaNs.Decimal; annualPriceEur: PrismaNs.Decimal } | null,
  cycle: BillingCycle,
  override: PrismaNs.Decimal | null,
): PrismaNs.Decimal | null {
  if (override != null) return override;
  if (!plan) return null;
  return cycle === "ANNUAL" ? plan.annualPriceEur : plan.monthlyPriceEur;
}

export async function getCompanyBillingForAdmin(companyId: string): Promise<CompanyBillingDto | null> {
  const row = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      billingPlanId: true,
      billingPlan: {
        select: { name: true, monthlyPriceEur: true, annualPriceEur: true, maxActiveEmployees: true },
      },
      billingCycle: true,
      billingPriceOverrideEur: true,
      billingPaid: true,
      billingPaidUntil: true,
      billingStartDate: true,
      billingEndDate: true,
      billingGraceDays: true,
      billingNotes: true,
      _count: { select: { employees: { where: { status: "ACTIVE" } } } },
    },
  });
  if (!row) return null;

  const price = effectivePrice(row.billingPlan, row.billingCycle, row.billingPriceOverrideEur);
  return {
    billingPlanId: row.billingPlanId,
    billingPlanName: row.billingPlan?.name ?? null,
    planMaxActiveEmployees: row.billingPlan?.maxActiveEmployees ?? null,
    billingCycle: row.billingCycle,
    billingPriceOverrideEur: row.billingPriceOverrideEur?.toFixed(2) ?? null,
    effectivePriceEur: price?.toFixed(2) ?? null,
    billingPaid: row.billingPaid,
    billingPaidUntil: row.billingPaidUntil?.toISOString() ?? null,
    billingStartDate: row.billingStartDate?.toISOString() ?? null,
    billingEndDate: row.billingEndDate?.toISOString() ?? null,
    billingGraceDays: row.billingGraceDays,
    billingNotes: row.billingNotes,
    paymentState: derivePaymentState({
      hasPlan: row.billingPlanId != null,
      billingPaid: row.billingPaid,
      billingPaidUntil: row.billingPaidUntil,
      billingGraceDays: row.billingGraceDays,
    }),
    activeEmployees: row._count.employees,
  };
}

export interface FinanceCompanyRow {
  companyId: string;
  legalName: string;
  status: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  brandGroupId: string | null;
  brandGroupName: string | null;
  planName: string | null;
  cycle: BillingCycle;
  effectivePriceEur: string | null;
  /** Annual clients normalized to €/month so totals are comparable. */
  monthlyEquivalentEur: string;
  paymentState: BillingPaymentState;
  billingPaidUntil: string | null;
  billingEndDate: string | null;
  activeEmployees: number;
  planMaxActiveEmployees: number | null;
}

export interface FinanceGroupRollup {
  brandGroupId: string;
  brandGroupName: string;
  companyCount: number;
  subtotalMonthlyEur: string;
  discountPercent: string | null;
  discountAmountEur: string | null;
  discountMonthlyEur: string;
  totalMonthlyEur: string;
}

export interface FinancesDto {
  companies: FinanceCompanyRow[];
  groups: FinanceGroupRollup[];
  totals: {
    expectedMonthlyEur: string;
    expectedAnnualEur: string;
    payingCompanies: number;
    unpaidOrOverdue: number;
    withoutPlan: number;
  };
}

export async function getFinancesForAdmin(): Promise<FinancesDto> {
  const [companies, groups] = await Promise.all([
    prisma.company.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { legalName: "asc" },
      select: {
        id: true,
        legalName: true,
        status: true,
        brandGroupId: true,
        brandGroup: { select: { name: true } },
        billingPlanId: true,
        billingPlan: {
          select: { name: true, monthlyPriceEur: true, annualPriceEur: true, maxActiveEmployees: true },
        },
        billingCycle: true,
        billingPriceOverrideEur: true,
        billingPaid: true,
        billingPaidUntil: true,
        billingEndDate: true,
        billingGraceDays: true,
        _count: { select: { employees: { where: { status: "ACTIVE" } } } },
      },
    }),
    prisma.companyBrandGroup.findMany({
      select: { id: true, name: true, discountPercent: true, discountAmountEur: true },
    }),
  ]);

  const zero = new PrismaNs.Decimal(0);
  const rows: FinanceCompanyRow[] = companies.map((c) => {
    const price = effectivePrice(c.billingPlan, c.billingCycle, c.billingPriceOverrideEur);
    const monthlyEq =
      price == null ? zero : c.billingCycle === "ANNUAL" ? price.div(12) : price;
    return {
      companyId: c.id,
      legalName: c.legalName,
      status: c.status,
      brandGroupId: c.brandGroupId,
      brandGroupName: c.brandGroup?.name ?? null,
      planName: c.billingPlan?.name ?? null,
      cycle: c.billingCycle,
      effectivePriceEur: price?.toFixed(2) ?? null,
      monthlyEquivalentEur: monthlyEq.toFixed(2),
      paymentState: derivePaymentState({
        hasPlan: c.billingPlanId != null,
        billingPaid: c.billingPaid,
        billingPaidUntil: c.billingPaidUntil,
        billingGraceDays: c.billingGraceDays,
      }),
      billingPaidUntil: c.billingPaidUntil?.toISOString() ?? null,
      billingEndDate: c.billingEndDate?.toISOString() ?? null,
      activeEmployees: c._count.employees,
      planMaxActiveEmployees: c.billingPlan?.maxActiveEmployees ?? null,
    };
  });

  const groupRollups: FinanceGroupRollup[] = [];
  let totalMonthly = zero;

  for (const g of groups) {
    const members = rows.filter((r) => r.brandGroupId === g.id);
    if (members.length === 0) continue;
    const subtotal = members.reduce(
      (sum, r) => sum.plus(new PrismaNs.Decimal(r.monthlyEquivalentEur)),
      zero,
    );
    let discount = zero;
    if (g.discountPercent != null) discount = discount.plus(subtotal.mul(g.discountPercent).div(100));
    if (g.discountAmountEur != null) discount = discount.plus(g.discountAmountEur);
    if (discount.gt(subtotal)) discount = subtotal;
    const total = subtotal.minus(discount);
    totalMonthly = totalMonthly.plus(total);
    groupRollups.push({
      brandGroupId: g.id,
      brandGroupName: g.name,
      companyCount: members.length,
      subtotalMonthlyEur: subtotal.toFixed(2),
      discountPercent: g.discountPercent?.toFixed(2) ?? null,
      discountAmountEur: g.discountAmountEur?.toFixed(2) ?? null,
      discountMonthlyEur: discount.toFixed(2),
      totalMonthlyEur: total.toFixed(2),
    });
  }

  for (const r of rows) {
    if (!r.brandGroupId) totalMonthly = totalMonthly.plus(new PrismaNs.Decimal(r.monthlyEquivalentEur));
  }

  return {
    companies: rows,
    groups: groupRollups,
    totals: {
      expectedMonthlyEur: totalMonthly.toFixed(2),
      expectedAnnualEur: totalMonthly.mul(12).toFixed(2),
      payingCompanies: rows.filter((r) => r.paymentState === "PAID" || r.paymentState === "GRACE").length,
      unpaidOrOverdue: rows.filter(
        (r) => r.paymentState === "UNPAID" || r.paymentState === "OVERDUE",
      ).length,
      withoutPlan: rows.filter((r) => r.paymentState === "NO_PLAN").length,
    },
  };
}

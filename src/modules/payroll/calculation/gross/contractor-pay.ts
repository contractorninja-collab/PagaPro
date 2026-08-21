import type { HourBreakdown, PremiumRules } from "../types";
import { D } from "../money/decimal";
import { roundMoneyEUR } from "../money/rounding";
import { computeGrossFromHours } from "./from-hours";
import { computePremiumPays } from "./premiums";

/**
 * What a contractor is paid for one month.
 *
 * Contractors are gross-out by construction — `applyTrust`/`applyTax` are forced
 * off for them, and they never reach the PIT or pension steps — so whichever
 * figure this returns is both the gross and the net. That is the whole reason
 * two bases can sit side by side without a solver: nothing is withheld from
 * either, so a "flat net fee" is simply the amount, unchanged.
 *
 * Pure: no DB, no clock. The service snapshots the inputs and stores the result.
 */

export type ContractorPayBasisValue = "HOURLY" | "MONTHLY_FLAT";

export interface ContractorPayInput {
  basis: ContractorPayBasisValue;
  /** Used when basis = HOURLY. */
  hourlyRate: string;
  /** Used when basis = MONTHLY_FLAT. */
  monthlyFlatAmount: string;
  /**
   * Denominator that turns a flat fee into an hourly rate for premium hours
   * (overtime, weekend, holiday, night) — a flat contractor who works nights
   * gets the uplift on top of the fee, priced at fee/standard hours. Optional:
   * without it the flat basis stays fee-only, as before.
   */
  standardMonthlyHours?: string;
  hours: HourBreakdown;
  premiumRules: PremiumRules;
}

export interface ContractorPayResult {
  /** Net = gross for a contractor; one figure, two names. */
  pay: string;
  breakdown: Record<string, unknown>;
  /** Set when the inputs cannot produce a payable figure — the UI surfaces it. */
  warning: "MISSING_HOURLY_RATE" | "MISSING_MONTHLY_AMOUNT" | null;
}

export function computeContractorPay(input: ContractorPayInput): ContractorPayResult {
  if (input.basis === "MONTHLY_FLAT") {
    const amount = D(input.monthlyFlatAmount);
    if (!amount.isFinite() || amount.lte(0)) {
      return {
        pay: "0.00",
        breakdown: { basis: "MONTHLY_FLAT", warning: "MISSING_MONTHLY_AMOUNT" },
        warning: "MISSING_MONTHLY_AMOUNT",
      };
    }
    /**
     * Flat covers the agreed month of REGULAR work; premium hours are real
     * extra effort and are priced on top, at the full premium multiple of the
     * fee-derived hourly rate (base + uplift — these hours are not inside the
     * fee). Regular hours stay attendance-only: that is what "flat" means.
     */
    const stdHours = D(input.standardMonthlyHours ?? "0");
    const derivedRate =
      stdHours.isFinite() && stdHours.gt(0) ? amount.div(stdHours) : D("0");
    const ot = D(input.hours.overtimeHours ?? "0");
    const hol = D(input.hours.holidayHours ?? "0");
    const we = D(input.hours.weekendHours ?? "0");
    const ni = D(input.hours.nightHours ?? "0");
    const anyPremiumHours = ot.gt(0) || hol.gt(0) || we.gt(0) || ni.gt(0);

    let premiumTotal = D("0");
    let premiumBreakdown: Record<string, string> | null = null;
    if (anyPremiumHours && derivedRate.gt(0)) {
      // computePremiumPays returns the FULL pay for each bucket (rate ×
      // multiplier × hours) — the same figures an employee's premium hours
      // produce — so the fee is the only other addend.
      const pays = computePremiumPays(derivedRate, input.premiumRules, ot, hol, we, ni);
      premiumTotal = roundMoneyEUR(
        pays.overtimePay.plus(pays.holidayPay).plus(pays.weekendPay).plus(pays.nightPay),
      );
      premiumBreakdown = {
        derivedHourlyRate: derivedRate.toFixed(4),
        overtimePay: roundMoneyEUR(pays.overtimePay).toFixed(2),
        holidayPay: roundMoneyEUR(pays.holidayPay).toFixed(2),
        weekendPay: roundMoneyEUR(pays.weekendPay).toFixed(2),
        nightPay: roundMoneyEUR(pays.nightPay).toFixed(2),
      };
    }

    return {
      pay: roundMoneyEUR(amount).plus(premiumTotal).toFixed(2),
      breakdown: {
        basis: "MONTHLY_FLAT",
        monthlyFlatAmount: roundMoneyEUR(amount).toFixed(2),
        premiumPay: premiumTotal.toFixed(2),
        ...(premiumBreakdown ? { premiums: premiumBreakdown } : {}),
        regularHoursNotPriced: input.hours.regularHours ?? "0",
      },
      warning: null,
    };
  }

  const rate = D(input.hourlyRate);
  if (!rate.isFinite() || rate.lte(0)) {
    return {
      pay: "0.00",
      breakdown: { basis: "HOURLY", warning: "MISSING_HOURLY_RATE", hours: input.hours },
      warning: "MISSING_HOURLY_RATE",
    };
  }

  const { breakdown, grossDecimal } = computeGrossFromHours({
    hours: input.hours,
    rates: { hourlyRate: input.hourlyRate },
    snapshot: { premiumRules: input.premiumRules },
  });

  return {
    pay: grossDecimal.toFixed(2),
    breakdown: {
      ...breakdown,
      basis: "HOURLY",
      hourlyRate: input.hourlyRate,
      hours: input.hours,
      premiumRules: input.premiumRules,
    },
    warning: null,
  };
}

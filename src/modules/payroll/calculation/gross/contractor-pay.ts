import type { HourBreakdown, PremiumRules } from "../types";
import { D } from "../money/decimal";
import { roundMoneyEUR } from "../money/rounding";
import { computeGrossFromHours } from "./from-hours";

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
    // Hours are recorded for attendance but never priced on this basis — that is
    // exactly what "flat" means, and the breakdown says so out loud so a locked
    // period can be explained later.
    return {
      pay: roundMoneyEUR(amount).toFixed(2),
      breakdown: {
        basis: "MONTHLY_FLAT",
        monthlyFlatAmount: roundMoneyEUR(amount).toFixed(2),
        hoursNotPriced: input.hours,
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

import type { LegislationSnapshot, PayrollCalculationIssue } from "../types";
import { D } from "../money/decimal";

export function validatePremiumRules(
  rules: LegislationSnapshot["premiumRules"],
): PayrollCalculationIssue[] {
  const issues: PayrollCalculationIssue[] = [];
  const keys = [
    "overtimeHourMultiplier",
    "holidayHourMultiplier",
    "weekendHourMultiplier",
  ] as const;

  for (const key of keys) {
    const raw = rules[key];
    if (raw === undefined) continue;
    const m = D(raw);
    if (!m.isFinite() || m.lte(0)) {
      issues.push({
        code: "INVALID_PREMIUM_RULES",
        message: `Premium multiplier ${key} must be a finite number > 0`,
      });
    }
  }

  return issues;
}

export function validatePitBands(
  pitBands: LegislationSnapshot["pitBands"],
): PayrollCalculationIssue[] {
  const issues: PayrollCalculationIssue[] = [];
  if (!pitBands.length) {
    issues.push({
      code: "INVALID_PIT_BANDS",
      message: "pitBands must contain at least one bracket",
    });
    return issues;
  }

  const sorted = [...pitBands].sort((a, b) =>
    D(a.cumulativeUpperInclusive).comparedTo(D(b.cumulativeUpperInclusive)),
  );

  let prevUpper: ReturnType<typeof D> | null = null;

  for (const band of sorted) {
    const upper = D(band.cumulativeUpperInclusive);
    const rate = D(band.rate);

    if (!upper.isFinite()) {
      issues.push({
        code: "INVALID_PIT_BANDS",
        message: "Each pit band needs a finite cumulativeUpperInclusive",
      });
      continue;
    }

    if (prevUpper === null) {
      if (!upper.gt(0)) {
        issues.push({
          code: "INVALID_PIT_BANDS",
          message: "First pit band cumulativeUpperInclusive must be > 0",
        });
      }
    } else if (!(upper.gt(prevUpper))) {
      issues.push({
        code: "INVALID_PIT_BANDS",
        message:
          "pitBands cumulativeUpperInclusive values must be strictly increasing",
      });
    }
    prevUpper = upper;

    if (!rate.isFinite() || rate.isNegative() || rate.gt(1)) {
      issues.push({
        code: "INVALID_PIT_BANDS",
        message: "pitBands rates must be finite and within [0,1]",
      });
    }
  }

  return issues;
}

export function validateLegislationSnapshot(snapshot: LegislationSnapshot): PayrollCalculationIssue[] {
  return [...validatePremiumRules(snapshot.premiumRules), ...validatePitBands(snapshot.pitBands)];
}

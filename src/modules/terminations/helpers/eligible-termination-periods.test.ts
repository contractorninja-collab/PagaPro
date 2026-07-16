import { describe, expect, it } from "vitest";
import {
  eligibleTerminationMonths,
  eligibleTerminationYears,
} from "@/modules/terminations/helpers/eligible-termination-periods";

describe("eligible termination periods", () => {
  const hireDate = new Date("2024-05-20T00:00:00.000Z");

  it("lists employment years through the current year", () => {
    expect(eligibleTerminationYears(hireDate, 2026)).toEqual([2026, 2025, 2024]);
  });

  it("starts the hire year at the hire month", () => {
    expect(eligibleTerminationMonths(hireDate, 2024)).toEqual([
      5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it("offers all months in later employment years", () => {
    expect(eligibleTerminationMonths(hireDate, 2026)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });
});

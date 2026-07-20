import { describe, expect, it } from "vitest";
import { eligibleLeaveYears } from "@/modules/leaves/helpers/eligible-leave-years";

describe("eligibleLeaveYears", () => {
  it("lists employment years through the current year in descending order", () => {
    expect(eligibleLeaveYears(new Date("2023-06-15T00:00:00.000Z"), null, 2026)).toEqual([
      2026, 2025, 2024, 2023,
    ]);
  });

  it("stops at the termination year", () => {
    expect(
      eligibleLeaveYears(
        new Date("2021-01-10T00:00:00.000Z"),
        new Date("2024-08-31T00:00:00.000Z"),
        2026,
      ),
    ).toEqual([2024, 2023, 2022, 2021]);
  });

  it("returns no years before employment begins", () => {
    expect(eligibleLeaveYears(new Date("2027-01-01T00:00:00.000Z"), null, 2026)).toEqual([]);
  });
});

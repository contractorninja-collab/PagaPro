import { describe, expect, it } from "vitest";
import {
  combinedLeaveHoursTotal,
  paidLeaveFromCombinedTotal,
} from "@/modules/payroll/helpers/leave-hours-cell";

describe("combinedLeaveHoursTotal", () => {
  it("sums paid + sick + unpaid", () => {
    expect(combinedLeaveHoursTotal("16.00", "8.00", "0.00")).toBe("24");
  });

  it("handles zeros and empty strings", () => {
    expect(combinedLeaveHoursTotal("0", "", "0")).toBe("0");
  });

  it("keeps fractional hours exact (decimal, not float)", () => {
    expect(combinedLeaveHoursTotal("0.1", "0.2", "0")).toBe("0.3");
  });
});

describe("paidLeaveFromCombinedTotal", () => {
  it("derives paid = total − sick − unpaid", () => {
    const r = paidLeaveFromCombinedTotal("24", "8", "0");
    expect(r).toEqual({ ok: true, paid: "16" });
  });

  it("accepts comma decimal input", () => {
    const r = paidLeaveFromCombinedTotal("12,5", "4", "0");
    expect(r).toEqual({ ok: true, paid: "8.5" });
  });

  it("rejects totals below the fixed sick+unpaid floor", () => {
    const r = paidLeaveFromCombinedTotal("6", "8", "2");
    expect(r).toEqual({ ok: false, minimum: "10" });
  });

  it("allows total exactly at the floor (paid → 0)", () => {
    const r = paidLeaveFromCombinedTotal("10", "8", "2");
    expect(r).toEqual({ ok: true, paid: "0" });
  });

  it("rejects negative and non-numeric input", () => {
    expect(paidLeaveFromCombinedTotal("-1", "0", "0")).toEqual({ ok: false, minimum: "0" });
    expect(paidLeaveFromCombinedTotal("abc", "0", "0")).toEqual({ ok: false, minimum: "0" });
  });
});

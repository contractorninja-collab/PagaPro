import { describe, expect, it } from "vitest";
import {
  balanceLineSegments,
  sortBalancesForDisplay,
  type EmployeeLeaveBalanceSummary,
} from "@/modules/leaves/helpers/employee-leave-view";

function bal(over: Partial<EmployeeLeaveBalanceSummary>): EmployeeLeaveBalanceSummary {
  return {
    leaveType: "PUSHIM_VJETOR",
    quota: "20.00",
    used: "0.00",
    pending: "0.00",
    remaining: "12.27",
    carryIn: "0.00",
    carryExpiresAtIso: null,
    ...over,
  };
}

describe("balanceLineSegments", () => {
  it("suppresses every zero — the 13-identical-cards regression, profile edition", () => {
    expect(balanceLineSegments(bal({}))).toEqual(["Kuota 20", "Mbetur 12.27"]);
  });

  it("shows used/pending/carry only when non-zero", () => {
    expect(
      balanceLineSegments(bal({ used: "3.00", pending: "2.00", carryIn: "1.50", remaining: "9.27" })),
    ).toEqual(["Kuota 20", "Përdorur 3", "Pritje 2", "Bartur 1.5", "Mbetur 9.27"]);
  });

  it("always states the remaining figure, even at zero", () => {
    expect(balanceLineSegments(bal({ used: "20.00", remaining: "0.00" }))).toEqual([
      "Kuota 20",
      "Përdorur 20",
      "Mbetur 0",
    ]);
  });
});

describe("sortBalancesForDisplay", () => {
  it("puts annual leave first regardless of input order", () => {
    const rows = [
      bal({ leaveType: "PUSHIM_MJEKESOR" }),
      bal({ leaveType: "PUSHIM_PERSONAL" }),
      bal({ leaveType: "PUSHIM_VJETOR" }),
    ];
    expect(sortBalancesForDisplay(rows).map((r) => r.leaveType)).toEqual([
      "PUSHIM_VJETOR",
      "PUSHIM_PERSONAL",
      "PUSHIM_MJEKESOR",
    ]);
  });
});

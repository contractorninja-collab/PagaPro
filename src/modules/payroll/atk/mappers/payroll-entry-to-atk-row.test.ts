import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  atkSnapshotCanonicalParts,
  filterAtkEligibleRows,
  mapSourceToAtkCellStrings,
  poJo,
  type AtkRowSource,
} from "@/modules/payroll/atk/mappers/payroll-entry-to-atk-row";

function snapshotHash(payrollId: string, payrollStatus: string, rows: AtkRowSource[]): string {
  return createHash("sha256")
    .update(JSON.stringify(atkSnapshotCanonicalParts(payrollId, payrollStatus, rows)), "utf8")
    .digest("hex");
}

function baseRow(partial: Partial<AtkRowSource> & Pick<AtkRowSource, "entryId">): AtkRowSource {
  return {
    employmentTypeSnapshot: "EMPLOYEE",
    employerPrimacySnapshot: "PRIMARY",
    grossSalary: "1000.00",
    pensionEmployee: "50.00",
    pensionEmployer: "50.00",
    employee: {
      firstName: "A",
      lastName: "B",
      personalId: "123",
      applyTrust: true,
      applyTax: false,
    },
    ...partial,
  };
}

describe("payroll-entry-to-atk-row", () => {
  it("maps PRIMARY employer primacy and trust/tax flags to Po/Jo", () => {
    const cells = mapSourceToAtkCellStrings(
      baseRow({
        entryId: "entry-1",
        employerPrimacySnapshot: "PRIMARY",
        employee: {
          firstName: "Edon",
          lastName: "Berisha",
          personalId: "1122334455",
          applyTrust: true,
          applyTax: false,
        },
      }),
    );
    expect(cells.primaryWork).toBe(poJo(true));
    expect(cells.includeContributions).toBe("Po");
    expect(cells.applyPayrollTax).toBe("Jo");
    expect(cells.pensionSupplementEmployee).toBe("0");
    expect(cells.pensionSupplementEmployer).toBe("0");
    expect(cells.grossSalary).toBe("1000.00");
  });

  it("maps SECONDARY employer primacy to Jo for primary-work column", () => {
    const cells = mapSourceToAtkCellStrings(
      baseRow({
        entryId: "entry-2",
        employerPrimacySnapshot: "SECONDARY",
      }),
    );
    expect(cells.primaryWork).toBe(poJo(false));
  });

  it("excludes contractor rows from eligibility filter", () => {
    const rows = [
      { employmentTypeSnapshot: "EMPLOYEE" as const },
      { employmentTypeSnapshot: "CONTRACTOR" as const },
    ];
    expect(filterAtkEligibleRows(rows)).toHaveLength(1);
  });

  it("computes stable snapshot hash regardless of input row order", () => {
    const a = baseRow({
      entryId: "e1",
      employee: {
        firstName: "Z",
        lastName: "A",
        personalId: "000",
        applyTrust: true,
        applyTax: true,
      },
    });
    const b = baseRow({
      entryId: "e2",
      grossSalary: "500.00",
      employee: {
        firstName: "Y",
        lastName: "B",
        personalId: "999",
        applyTrust: false,
        applyTax: true,
      },
    });
    const h1 = snapshotHash("payroll-x", "APPROVED", [a, b]);
    const h2 = snapshotHash("payroll-x", "APPROVED", [b, a]);
    expect(h1).toBe(h2);
  });
});

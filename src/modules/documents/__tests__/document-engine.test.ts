import { describe, expect, it } from "vitest";
import {
  composePlaceholderRegistry,
  mergeContractContext,
  mergeTemplateContext,
  parsePlaceholdersFromText,
  validatePlaceholdersForRender,
} from "../engine";
import { buildLeavePlaceholderMap } from "../context/leave-context";
import { buildTerminationPlaceholderMap } from "../context/termination-context";

describe("parsePlaceholdersFromText", () => {
  it("extracts unique snake_case keys", () => {
    const text = "Hello {{ employee_name }} — {{salary_gross}} and {{ employee_name }}";
    expect(parsePlaceholdersFromText(text)).toEqual(["employee_name", "salary_gross"]);
  });
});

describe("buildLeavePlaceholderMap", () => {
  const leave = {
    startDate: new Date(Date.UTC(2026, 6, 20)),
    endDate: new Date(Date.UTC(2026, 6, 31)),
    type: "PUSHIM_VJETOR",
    status: "APPROVED",
    reason: "Verë",
    workingDays: "8" as unknown as { toString(): string },
    totalDays: "12" as unknown as { toString(): string },
    decidedAt: new Date(Date.UTC(2026, 6, 10)),
    isPaid: true,
  };
  const balance = {
    yearlyQuota: "20", usedDays: "8", remainingDays: "12.5", carryOverDays: "0",
  } as unknown as { yearlyQuota: { toString(): string }; usedDays: { toString(): string }; remainingDays: { toString(): string }; carryOverDays: { toString(): string } };

  it("fills the leave facts, Albanian labels, and the balance", () => {
    const m = buildLeavePlaceholderMap(leave, balance);
    expect(m.leave_type_label).toBe("Pushim vjetor");
    expect(m.leave_status_label).toBe("I miratuar");
    expect(m.leave_working_days).toBe("8");
    expect(m.leave_total_days).toBe("12");
    expect(m.leave_year).toBe("2026");
    expect(m.leave_paid_label).toBe("me pagesë");
    expect(m.leave_quota_days).toBe("20");
    expect(m.leave_used_days).toBe("8");
    expect(m.leave_remaining_days).toBe("12.5"); // fractional preserved, no trailing .00
    expect(m.leave_decision_date).not.toBe("");
  });

  it("degrades gracefully when the balance is missing", () => {
    const m = buildLeavePlaceholderMap(leave, null);
    expect(m.leave_working_days).toBe("8");
    expect(m.leave_quota_days).toBe("");
    expect(m.leave_remaining_days).toBe("");
  });
});

describe("buildTerminationPlaceholderMap", () => {
  it("resolves Albanian type/status labels, notice date, and severance", () => {
    const m = buildTerminationPlaceholderMap({
      terminationDate: new Date(Date.UTC(2026, 5, 30)),
      lastWorkingDay: new Date(Date.UTC(2026, 5, 30)),
      noticeDate: new Date(Date.UTC(2026, 4, 31)),
      type: "NGA_PUNEDHENESI",
      status: "COMPLETED",
      noticeDays: 30,
      severanceAmount: "500",
      reason: "Arsye ekonomike",
      details: "Ristrukturim i njësisë.",
    });
    expect(m.termination_type_label).toBe("Nga punëdhënësi");
    expect(m.termination_status_label).toBe("I përfunduar");
    expect(m.termination_notice_days).toBe("30");
    expect(m.termination_notice_date).not.toBe("");
    expect(m.termination_severance).toContain("500");
    expect(m.termination_reason).toBe("Arsye ekonomike");
  });
});

describe("composePlaceholderRegistry", () => {
  it("includes leave-specific keys only when LEAVE category is composed", () => {
    const leaveReg = composePlaceholderRegistry(["LEAVE"]);
    expect(leaveReg.leave_start_date).toBeDefined();
    expect(leaveReg.leave_remaining_days).toBeDefined();
    expect(leaveReg.contract_start_date).toBeUndefined();

    const contractReg = composePlaceholderRegistry(["CONTRACT"]);
    expect(contractReg.contract_start_date).toBeDefined();
    expect(contractReg.leave_start_date).toBeUndefined();
  });

  it("includes payroll period placeholders for PAYROLL", () => {
    const reg = composePlaceholderRegistry(["PAYROLL"]);
    expect(reg.payroll_period_label).toBeDefined();
    expect(reg.payroll_month_name).toBeDefined();
  });

  it("includes the employee start date for termination documents", () => {
    const reg = composePlaceholderRegistry(["TERMINATION"]);
    expect(reg.employment_start_date).toBeDefined();
    expect(reg.employment_start_date?.requiredByDefault).toBe(true);
  });

  it("includes generic OTHER metadata keys", () => {
    const reg = composePlaceholderRegistry(["OTHER"]);
    expect(reg.document_title).toBeDefined();
    expect(reg.document_date).toBeDefined();
  });

  it.each(["CONTRACT", "LEAVE", "TERMINATION", "WARNING", "PAYROLL", "OTHER"] as const)(
    "includes the employee workplace for %s paperwork",
    (category) => {
      const reg = composePlaceholderRegistry([category]);
      expect(reg.workplace).toBeDefined();
      expect(reg.workplace?.applicableCategories).toBeUndefined();
    },
  );
});

describe("validatePlaceholdersForRender", () => {
  it("requires registry-required keys when present in template", () => {
    const registry = composePlaceholderRegistry(["CONTRACT"]);
    expect(() =>
      validatePlaceholdersForRender(["employee_name"], { employee_name: "" }, registry),
    ).toThrow(/Missing placeholder values/);
  });

  it("accepts merged overrides", () => {
    const registry = composePlaceholderRegistry(["CONTRACT"]);
    expect(() =>
      validatePlaceholdersForRender(
        ["employee_name"],
        mergeTemplateContext({}, { employee_name: "A B" }),
        registry,
      ),
    ).not.toThrow();
  });

  it("uses category-specific required semantics", () => {
    const registry = composePlaceholderRegistry(["LEAVE"]);
    expect(() =>
      validatePlaceholdersForRender(["leave_start_date"], { leave_start_date: "" }, registry),
    ).toThrow(/Missing placeholder values/);
  });
});

describe("compat aliases", () => {
  it("mergeContractContext matches mergeTemplateContext", () => {
    expect(mergeContractContext({ a: "1" }, { b: "2" })).toEqual(mergeTemplateContext({ a: "1" }, { b: "2" }));
  });
});

import { describe, expect, it } from "vitest";
import {
  composePlaceholderRegistry,
  mergeContractContext,
  mergeTemplateContext,
  parsePlaceholdersFromText,
  validatePlaceholdersForRender,
} from "../engine";

describe("parsePlaceholdersFromText", () => {
  it("extracts unique snake_case keys", () => {
    const text = "Hello {{ employee_name }} — {{salary_gross}} and {{ employee_name }}";
    expect(parsePlaceholdersFromText(text)).toEqual(["employee_name", "salary_gross"]);
  });
});

describe("composePlaceholderRegistry", () => {
  it("includes leave-specific keys only when LEAVE category is composed", () => {
    const leaveReg = composePlaceholderRegistry(["LEAVE"]);
    expect(leaveReg.leave_start_date).toBeDefined();
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

  it("includes generic OTHER metadata keys", () => {
    const reg = composePlaceholderRegistry(["OTHER"]);
    expect(reg.document_title).toBeDefined();
    expect(reg.document_date).toBeDefined();
  });
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

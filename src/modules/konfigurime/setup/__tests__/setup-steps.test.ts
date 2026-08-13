import { describe, expect, it } from "vitest";
import {
  deriveSetupSteps,
  firstOpenSetupStepIndex,
  setupFactsFromDto,
  setupProgress,
  type SetupFacts,
  type SetupStepId,
} from "@/modules/konfigurime/setup/setup-steps";

/**
 * These tests encode the deadlock a new tenant hits, so a future change that
 * quietly reorders the chain fails here rather than in a client's first hour.
 */

function facts(partial: Partial<SetupFacts> = {}): SetupFacts {
  return {
    activeJobTitleCount: 0,
    activeEmployeeCount: 0,
    hasSavedRepresentative: false,
    savedFiscalNumber: null,
    savedAddressLine: null,
    savedMinimumSalaryCurrent: null,
    savedStandardWeeklyHours: null,
    savedWorkingDaysPerWeek: null,
    savedAnnualLeaveDaysDefault: null,
    savedLogoStorageKey: null,
    logoSkipped: false,
    ...partial,
  };
}

const byId = (steps: ReturnType<typeof deriveSetupSteps>, id: SetupStepId) =>
  steps.find((s) => s.id === id)!;

describe("deriveSetupSteps — a brand-new company", () => {
  const steps = deriveSetupSteps(facts());

  it("opens only the positions step; everything after it is blocked", () => {
    expect(byId(steps, "pozitat")).toMatchObject({ done: false, blocked: false });
    for (const id of ["punonjesit", "perfaqesuesi", "parametrat", "logoja", "testi"] as const) {
      expect(byId(steps, id).blocked, `${id} must be blocked`).toBe(true);
    }
  });

  it("explains each block instead of just refusing", () => {
    expect(byId(steps, "punonjesit").blockedReason).toContain("pa pozitë");
    expect(byId(steps, "perfaqesuesi").blockedReason).toContain("punonjës");
    expect(byId(steps, "parametrat").blockedReason).toContain("pa përfaqësues");
  });

  it("starts at the first step", () => {
    expect(firstOpenSetupStepIndex(steps)).toBe(0);
  });

  it("is not complete", () => {
    expect(setupProgress(steps)).toMatchObject({ doneCount: 0, requiredCount: 4, complete: false });
  });
});

describe("deriveSetupSteps — walking the chain", () => {
  it("a job title unblocks employees only", () => {
    const steps = deriveSetupSteps(facts({ activeJobTitleCount: 1 }));
    expect(byId(steps, "pozitat").done).toBe(true);
    expect(byId(steps, "punonjesit").blocked).toBe(false);
    expect(byId(steps, "perfaqesuesi").blocked).toBe(true);
    expect(firstOpenSetupStepIndex(steps)).toBe(1);
  });

  it("an employee unblocks the representative, but not the parameters", () => {
    const steps = deriveSetupSteps(facts({ activeJobTitleCount: 2, activeEmployeeCount: 3 }));
    expect(byId(steps, "perfaqesuesi").blocked).toBe(false);
    expect(byId(steps, "parametrat").blocked).toBe(true);
    expect(byId(steps, "parametrat").blockedReason).toContain("pa përfaqësues");
    expect(firstOpenSetupStepIndex(steps)).toBe(2);
  });

  it("archived job titles do not count — they cannot be assigned", () => {
    const dto = {
      companyLogoStorageKey: null,
      company: { fiscalNumber: null, addressLine: null },
      representatives: [{ employeeId: null }],
      configuration: {
        minimumSalaryCurrent: null,
        standardWeeklyHours: null,
        workingDaysPerWeek: null,
        annualLeaveDaysDefault: null,
      },
      jobTitles: [{ status: "ARCHIVED" }, { status: "ARCHIVED" }],
      employees: [],
    };
    expect(setupFactsFromDto(dto, { logoSkipped: false }).activeJobTitleCount).toBe(0);
    expect(deriveSetupSteps(setupFactsFromDto(dto, { logoSkipped: false }))[0]!.done).toBe(false);
  });

  it("a representative needs NUI and address before its step is done", () => {
    const base = { activeJobTitleCount: 1, activeEmployeeCount: 1, hasSavedRepresentative: true };
    expect(byId(deriveSetupSteps(facts(base)), "perfaqesuesi").done).toBe(false);
    expect(
      byId(
        deriveSetupSteps(facts({ ...base, savedFiscalNumber: "811234567", savedAddressLine: "Rr. B" })),
        "perfaqesuesi",
      ).done,
    ).toBe(true);
  });

  it("treats whitespace-only values as unset", () => {
    const steps = deriveSetupSteps(
      facts({
        activeJobTitleCount: 1,
        activeEmployeeCount: 1,
        hasSavedRepresentative: true,
        savedFiscalNumber: "   ",
        savedAddressLine: "Rr. B",
      }),
    );
    expect(byId(steps, "perfaqesuesi").done).toBe(false);
  });
});

describe("deriveSetupSteps — completion", () => {
  const ready = facts({
    activeJobTitleCount: 1,
    activeEmployeeCount: 1,
    hasSavedRepresentative: true,
    savedFiscalNumber: "811234567",
    savedAddressLine: "Rr. B, Prishtinë",
    savedMinimumSalaryCurrent: "500",
    savedStandardWeeklyHours: "40",
    savedWorkingDaysPerWeek: "5",
    savedAnnualLeaveDaysDefault: "20",
  });

  it("is complete without a logo — the logo is optional", () => {
    const steps = deriveSetupSteps(ready);
    expect(byId(steps, "logoja").done).toBe(false);
    expect(setupProgress(steps).complete).toBe(true);
  });

  it("counts a skipped logo as done", () => {
    expect(byId(deriveSetupSteps({ ...ready, logoSkipped: true }), "logoja").done).toBe(true);
  });

  it("counts an uploaded logo as done", () => {
    expect(byId(deriveSetupSteps({ ...ready, savedLogoStorageKey: "k" }), "logoja").done).toBe(true);
  });

  it("never lets the advisory final check hold completion open", () => {
    const steps = deriveSetupSteps(ready);
    expect(byId(steps, "testi")).toMatchObject({ done: false, optional: true, blocked: false });
    expect(setupProgress(steps).complete).toBe(true);
  });

  it("misses completion when one parameter is still unset", () => {
    const steps = deriveSetupSteps({ ...ready, savedAnnualLeaveDaysDefault: null });
    expect(setupProgress(steps)).toMatchObject({ doneCount: 3, requiredCount: 4, complete: false });
  });
});

describe("setupFactsFromDto", () => {
  it("reads a synthesised blank representative row as 'none saved'", () => {
    // The loader fabricates one placeholder row when no real rep exists.
    const dto = {
      companyLogoStorageKey: null,
      company: { fiscalNumber: null, addressLine: null },
      representatives: [{ employeeId: null }],
      configuration: {
        minimumSalaryCurrent: null,
        standardWeeklyHours: null,
        workingDaysPerWeek: null,
        annualLeaveDaysDefault: null,
      },
      jobTitles: [],
      employees: [],
    };
    expect(setupFactsFromDto(dto, { logoSkipped: false }).hasSavedRepresentative).toBe(false);

    const saved = { ...dto, representatives: [{ employeeId: "cme1" }] };
    expect(setupFactsFromDto(saved, { logoSkipped: false }).hasSavedRepresentative).toBe(true);
  });
});

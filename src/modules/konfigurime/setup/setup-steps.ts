/**
 * First-run setup, derived from data rather than stored.
 *
 * A brand-new company cannot save Konfigurimet at all: the payload demands at
 * least one representative, a representative must be an Employee carrying a job
 * title, and an Employee cannot be created without a JobTitle. So the only
 * order that works is Pozitë → Punonjës → Përfaqësues → Konfigurimet, and this
 * module is where that chain is written down: `blocked` + `blockedReason` turn
 * the deadlock from a wall into an explanation.
 *
 * Nothing here is persisted. Every fact comes from rows that already exist, so
 * a client who set some of this up by hand sees those steps already done, an
 * established company sees a finished card on first render, and there is no
 * setup state to migrate, reset, or get out of sync with reality.
 *
 * Pure — no DB, no React. Tested directly.
 */

export type SetupStepId =
  | "pozitat"
  | "punonjesit"
  | "perfaqesuesi"
  | "parametrat"
  | "logoja"
  | "testi";

export interface SetupFacts {
  /** ACTIVE only — an archived title cannot be assigned to an employee. */
  activeJobTitleCount: number;
  activeEmployeeCount: number;
  /**
   * A real saved representative. The loader synthesises a blank row with a null
   * `employeeId` when none exist, so this must test the id, not the array.
   */
  hasSavedRepresentative: boolean;
  savedFiscalNumber: string | null;
  savedAddressLine: string | null;
  savedMinimumSalaryCurrent: string | null;
  savedStandardWeeklyHours: string | null;
  savedWorkingDaysPerWeek: string | null;
  savedAnnualLeaveDaysDefault: string | null;
  savedLogoStorageKey: string | null;
  /** Client chose to go without a logo — the one thing kept in localStorage. */
  logoSkipped: boolean;
}

export interface SetupStep {
  id: SetupStepId;
  label: string;
  hint: string;
  /** Optional steps never hold the card open. */
  optional: boolean;
  done: boolean;
  /** True when an earlier step must happen first. */
  blocked: boolean;
  blockedReason: string | null;
}

const filled = (v: string | null): boolean => v !== null && v.trim().length > 0;

/**
 * The six steps in dependency order, each knowing why it cannot start yet.
 *
 * `testi` is advisory: it proves the setup works but writes nothing, so it
 * never counts toward completion and never keeps the card on screen.
 */
export function deriveSetupSteps(facts: SetupFacts): SetupStep[] {
  const hasJobTitle = facts.activeJobTitleCount > 0;
  const hasEmployee = facts.activeEmployeeCount > 0;
  const hasRep = facts.hasSavedRepresentative;

  return [
    {
      id: "pozitat",
      label: "Pozitat e punës",
      hint: "Çdo punonjës lidhet me një pozitë — prandaj fillojmë këtu.",
      optional: false,
      done: hasJobTitle,
      blocked: false,
      blockedReason: null,
    },
    {
      id: "punonjesit",
      label: "Punonjësit",
      hint: "Shtoni punonjësit rresht pas rreshti.",
      optional: false,
      done: hasEmployee,
      blocked: !hasJobTitle,
      blockedReason: hasJobTitle
        ? null
        : "Punonjësi nuk ruhet pa pozitë — krijoni së pari një pozitë.",
    },
    {
      id: "perfaqesuesi",
      label: "Kompania dhe përfaqësuesi",
      hint: "NUI, adresa dhe personi që nënshkruan dokumentet.",
      optional: false,
      done: hasRep && filled(facts.savedFiscalNumber) && filled(facts.savedAddressLine),
      blocked: !hasEmployee,
      blockedReason: hasEmployee
        ? null
        : "Përfaqësuesi zgjidhet nga punonjësit — shtoni së pari një punonjës.",
    },
    {
      id: "parametrat",
      label: "Parametrat bazë",
      hint: "Paga minimale, orët javore dhe pushimi vjetor.",
      optional: false,
      done:
        filled(facts.savedMinimumSalaryCurrent) &&
        filled(facts.savedStandardWeeklyHours) &&
        filled(facts.savedWorkingDaysPerWeek) &&
        filled(facts.savedAnnualLeaveDaysDefault),
      blocked: !hasRep,
      blockedReason: hasRep
        ? null
        : "Konfigurimet nuk mund të ruhen pa përfaqësues.",
    },
    {
      id: "logoja",
      label: "Logoja e kompanisë",
      hint: "Shfaqet në krye të dokumenteve. Mund ta shtoni më vonë.",
      optional: true,
      done: filled(facts.savedLogoStorageKey) || facts.logoSkipped,
      blocked: !hasRep,
      blockedReason: hasRep
        ? null
        : "Konfigurimet nuk mund të ruhen pa përfaqësues.",
    },
    {
      id: "testi",
      label: "Kontrolli final",
      hint: "Kontrollojmë një kontratë të vërtetë për fusha bosh.",
      optional: true,
      done: false,
      blocked: !hasEmployee || !hasRep,
      blockedReason:
        hasEmployee && hasRep
          ? null
          : "Kontrolli kërkon një punonjës dhe një përfaqësues.",
    },
  ];
}

/** The step the card should open on — the first unfinished one. */
export function firstOpenSetupStepIndex(steps: SetupStep[]): number {
  const idx = steps.findIndex((s) => !s.done && !s.blocked);
  if (idx !== -1) return idx;
  const blocked = steps.findIndex((s) => !s.done);
  return blocked === -1 ? Math.max(0, steps.length - 1) : blocked;
}

export interface SetupProgress {
  doneCount: number;
  requiredCount: number;
  /** Every required step done — the card retires itself to a quiet summary. */
  complete: boolean;
}

export function setupProgress(steps: SetupStep[]): SetupProgress {
  const required = steps.filter((s) => !s.optional);
  const doneRequired = required.filter((s) => s.done);
  return {
    doneCount: doneRequired.length,
    requiredCount: required.length,
    complete: doneRequired.length === required.length,
  };
}

/** Shape of the page DTO this reads — declared structurally to stay decoupled. */
export interface SetupFactsSource {
  companyLogoStorageKey: string | null;
  company: { fiscalNumber: string | null; addressLine: string | null };
  representatives: { employeeId: string | null }[];
  configuration: {
    minimumSalaryCurrent: string | null;
    standardWeeklyHours: string | null;
    workingDaysPerWeek: string | null;
    annualLeaveDaysDefault: string | null;
  };
  jobTitles: { status: string }[];
  employees: unknown[];
}

/**
 * Server truth. The card overlays its own optimistic deltas on top of this
 * between steps, because refreshing mid-flow would reset the form state the
 * client is typing into.
 */
export function setupFactsFromDto(
  dto: SetupFactsSource,
  local: { logoSkipped: boolean },
): SetupFacts {
  return {
    // listJobTitlesForCompany returns archived rows too; only ACTIVE ones can
    // be assigned to an employee.
    activeJobTitleCount: dto.jobTitles.filter((j) => j.status === "ACTIVE").length,
    activeEmployeeCount: dto.employees.length,
    hasSavedRepresentative: dto.representatives.some((r) => Boolean(r.employeeId)),
    savedFiscalNumber: dto.company.fiscalNumber,
    savedAddressLine: dto.company.addressLine,
    savedMinimumSalaryCurrent: dto.configuration.minimumSalaryCurrent,
    savedStandardWeeklyHours: dto.configuration.standardWeeklyHours,
    savedWorkingDaysPerWeek: dto.configuration.workingDaysPerWeek,
    savedAnnualLeaveDaysDefault: dto.configuration.annualLeaveDaysDefault,
    savedLogoStorageKey: dto.companyLogoStorageKey,
    logoSkipped: local.logoSkipped,
  };
}

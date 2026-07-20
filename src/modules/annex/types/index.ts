import type { ContractTermType } from "@prisma/client";

export const CONTRACT_TERM_LABELS: Record<ContractTermType, string> = {
  INDEFINITE: "Në kohë të pacaktuar",
  FIXED_TERM: "Në kohë të caktuar",
  SPECIFIC_TASK: "Për punë dhe detyra specifike",
};

/** The Neni-11 elements an annex can amend. */
export type AnnexChangeCategory =
  | "SALARY"
  | "JOB_TITLE"
  | "JOB_DESCRIPTION"
  | "DEPARTMENT"
  | "HOURS"
  | "WORKPLACE"
  | "CONTRACT_TERM";

export const ANNEX_CATEGORY_LABELS: Record<AnnexChangeCategory, string> = {
  SALARY: "Paga bazë mujore",
  JOB_TITLE: "Pozita",
  JOB_DESCRIPTION: "Përshkrimi i detyrave",
  DEPARTMENT: "Njësia organizative",
  HOURS: "Orari javor i punës",
  WORKPLACE: "Vendi i punës",
  CONTRACT_TERM: "Kohëzgjatja e kontratës",
};

/** One line rendered in the annex document ("<label>: nga <from> në <to>"). */
export interface AnnexChange {
  category: AnnexChangeCategory;
  label: string;
  from: string;
  to: string;
}

/** A suggested change the app pre-fills in the dialog; `changed` marks a detected difference. */
export interface AnnexChangeSuggestion extends AnnexChange {
  changed: boolean;
  /** True when we have no reliable previous value (first annex, non-salary) — HR should confirm. */
  fromUnknown: boolean;
}

export interface AnnexDiff {
  hasPreviousAnnex: boolean;
  suggestions: AnnexChangeSuggestion[];
  /** Current contract term, for the renewal controls. */
  contractEndDate: string | null;
  contractType: ContractTermType;
}

/** Stable validation codes for HR UI, payroll gates, and audit metadata. */
export const LeaveValidationCode = {
  OVERLAP_BLOCK: "KOSOVO_LEAVE_OVERLAP_BLOCK",
  DATE_RANGE_BLOCK: "KOSOVO_LEAVE_DATE_RANGE_BLOCK",
  INSUFFICIENT_BALANCE_BLOCK: "KOSOVO_INSUFFICIENT_BALANCE_BLOCK",
  PAYROLL_LOCKED_BLOCK: "KOSOVO_PAYROLL_LOCKED_BLOCK",
  SPLIT_LEAVE_WARN: "KOSOVO_SPLIT_LEAVE_WARN",
  CARRY_EXPIRE_WARN: "KOSOVO_CARRY_EXPIRE_WARN",
  INSUFFICIENT_BALANCE_WARN: "KOSOVO_INSUFFICIENT_BALANCE_WARN",
  FIRST_YEAR_ENTITLEMENT_WARN: "KOSOVO_FIRST_YEAR_ENTITLEMENT_WARN",
} as const;

export type LeaveValidationCodeType = (typeof LeaveValidationCode)[keyof typeof LeaveValidationCode];

export interface LeaveValidationIssue {
  code: LeaveValidationCodeType | string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface LeaveValidationResult {
  blocks: LeaveValidationIssue[];
  warnings: LeaveValidationIssue[];
}

export function emptyValidationResult(): LeaveValidationResult {
  return { blocks: [], warnings: [] };
}

export function mergeValidationResults(...parts: LeaveValidationResult[]): LeaveValidationResult {
  const blocks: LeaveValidationIssue[] = [];
  const warnings: LeaveValidationIssue[] = [];
  for (const p of parts) {
    blocks.push(...p.blocks);
    warnings.push(...p.warnings);
  }
  return { blocks, warnings };
}

export function hasBlockingIssues(v: LeaveValidationResult): boolean {
  return v.blocks.length > 0;
}

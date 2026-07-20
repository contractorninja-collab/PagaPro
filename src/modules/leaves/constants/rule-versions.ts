/** Versioned leave-metric behavior persisted on each request. */
export const LEAVE_ENGINE_RULE_VERSION_V1 = "kosovo-leave-engine.v1" as const;
export const LEAVE_ENGINE_RULE_VERSION_V2 = "kosovo-leave-engine.v2" as const;

/** Current rule for newly created leave requests and freshly computed balances. */
export const LEAVE_ENGINE_RULE_VERSION = LEAVE_ENGINE_RULE_VERSION_V2;

export type LeaveEngineRuleVersion =
  | typeof LEAVE_ENGINE_RULE_VERSION_V1
  | typeof LEAVE_ENGINE_RULE_VERSION_V2;

/** Unknown/legacy persisted values remain on v1 behavior for backward compatibility. */
export function resolveLeaveEngineRuleVersion(value: string | null | undefined): LeaveEngineRuleVersion {
  return value === LEAVE_ENGINE_RULE_VERSION_V2
    ? LEAVE_ENGINE_RULE_VERSION_V2
    : LEAVE_ENGINE_RULE_VERSION_V1;
}

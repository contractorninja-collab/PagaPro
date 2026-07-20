import type { TimelineEntryDto } from "../types/dashboard-types";

export interface DashboardActivityCandidate extends TimelineEntryDto {
  entityType: string;
  entityId: string;
  operation: string;
  sourcePriority: number;
}

const OPERATION_STEMS = [
  "TERMINAT",
  "REGENERAT",
  "GENERAT",
  "DOWNLOAD",
  "ARCHIV",
  "APPROV",
  "REJECT",
  "REVOK",
  "CANCEL",
  "SUBMIT",
  "CREATE",
  "UPDATE",
  "DELETE",
  "UNLOCK",
  "LOCK",
  "VOID",
] as const;

export function canonicalActivityOperation(value: string): string {
  const upper = value.toUpperCase();
  return OPERATION_STEMS.find((stem) => upper.includes(stem)) ?? upper;
}

/**
 * One domain write can emit a readable activity, an HR timeline row, and an
 * audit row. Collapse only matching entity/operation/actor records emitted
 * within three seconds, preserving the most useful source.
 */
export function collapseDashboardActivity(
  candidates: DashboardActivityCandidate[],
): TimelineEntryDto[] {
  const sorted = [...candidates].sort(
    (a, b) => Date.parse(b.occurredAtIso) - Date.parse(a.occurredAtIso),
  );
  const kept: DashboardActivityCandidate[] = [];

  for (const candidate of sorted) {
    const occurredAt = Date.parse(candidate.occurredAtIso);
    const duplicateIndex = kept.findIndex(
      (entry) =>
        entry.entityType === candidate.entityType &&
        entry.entityId === candidate.entityId &&
        canonicalActivityOperation(entry.operation) ===
          canonicalActivityOperation(candidate.operation) &&
        entry.actorLabel === candidate.actorLabel &&
        Math.abs(Date.parse(entry.occurredAtIso) - occurredAt) <= 3_000,
    );

    if (duplicateIndex === -1) {
      kept.push(candidate);
    } else {
      const duplicate = kept[duplicateIndex];
      if (duplicate && candidate.sourcePriority > duplicate.sourcePriority) {
        kept[duplicateIndex] = candidate;
      }
    }
  }

  return kept
    .sort((a, b) => Date.parse(b.occurredAtIso) - Date.parse(a.occurredAtIso))
    .map(
      ({
        entityType: _entityType,
        entityId: _entityId,
        operation: _operation,
        sourcePriority: _priority,
        ...entry
      }) => entry,
    );
}

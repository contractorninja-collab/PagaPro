import { describe, expect, it } from "vitest";
import {
  canonicalActivityOperation,
  collapseDashboardActivity,
  type DashboardActivityCandidate,
} from "../dashboard-activity-service";

function candidate(
  overrides: Partial<DashboardActivityCandidate>,
): DashboardActivityCandidate {
  return {
    id: "activity-1",
    source: "domain",
    occurredAtIso: "2026-07-15T10:00:00.000Z",
    title: "Profili i punonjësit u përditësua",
    subtitle: "Arta Berisha",
    actorLabel: "Admin",
    entityType: "Employee",
    entityId: "employee-1",
    operation: "UPDATED",
    sourcePriority: 2,
    ...overrides,
  };
}

describe("collapseDashboardActivity", () => {
  it("collapses HR, domain, and audit records emitted for one employee update", () => {
    const result = collapseDashboardActivity([
      candidate({}),
      candidate({
        id: "hr-1",
        source: "employee_timeline",
        occurredAtIso: "2026-07-15T10:00:00.500Z",
        operation: "EMPLOYEE_UPDATED",
        sourcePriority: 3,
      }),
      candidate({
        id: "audit-1",
        source: "audit",
        occurredAtIso: "2026-07-15T10:00:01.000Z",
        operation: "EMPLOYEE_UPDATE",
        sourcePriority: 1,
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.source).toBe("employee_timeline");
  });

  it("keeps separate writes outside the deduplication window", () => {
    const result = collapseDashboardActivity([
      candidate({}),
      candidate({ id: "activity-2", occurredAtIso: "2026-07-15T10:00:04.000Z" }),
    ]);

    expect(result).toHaveLength(2);
  });
});

describe("canonicalActivityOperation", () => {
  it("normalizes technical and domain update codes", () => {
    expect(canonicalActivityOperation("EMPLOYEE_UPDATE")).toBe("UPDATE");
    expect(canonicalActivityOperation("UPDATED")).toBe("UPDATE");
  });
});

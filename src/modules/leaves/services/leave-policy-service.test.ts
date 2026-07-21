import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst, create } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leavePolicyParameterSet: { findFirst, create },
  },
}));

import {
  ensureDefaultLeavePolicyParameterSet,
  resolveLeavePolicyParameterSet,
} from "@/modules/leaves/services/leave-policy-service";

const policy = {
  id: "policy-1",
  companyId: "company-1",
  effectiveFrom: new Date("2000-01-01T00:00:00.000Z"),
};

describe("leave policy resolution", () => {
  beforeEach(() => {
    findFirst.mockReset();
    create.mockReset();
  });

  it("returns an existing company policy", async () => {
    findFirst.mockResolvedValue(policy);

    await expect(ensureDefaultLeavePolicyParameterSet("company-1")).resolves.toBe(policy);
    expect(create).not.toHaveBeenCalled();
  });

  it("creates the Kosovo baseline when a legacy company has no policy", async () => {
    findFirst.mockResolvedValue(null);
    create.mockResolvedValue(policy);

    await expect(
      resolveLeavePolicyParameterSet("company-1", new Date("2026-07-20T00:00:00.000Z")),
    ).resolves.toBe(policy);
    expect(create).toHaveBeenCalledWith({
      data: {
        companyId: "company-1",
        effectiveFrom: new Date("2000-01-01T00:00:00.000Z"),
      },
    });
  });
});

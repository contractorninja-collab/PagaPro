import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { KOSOVO_REGULAR_MEDICAL_LEAVE_WORKING_DAYS } from "@/modules/leaves/constants/kosovo-law";
import { resolveMedicalLeaveYearlyQuota } from "@/modules/leaves/services/leave-balance-service";

describe("resolveMedicalLeaveYearlyQuota", () => {
  it("defaults to 20 working days when company config is missing", () => {
    expect(resolveMedicalLeaveYearlyQuota(null).toNumber()).toBe(KOSOVO_REGULAR_MEDICAL_LEAVE_WORKING_DAYS);
    expect(resolveMedicalLeaveYearlyQuota(undefined).toNumber()).toBe(20);
  });

  it("uses company medicalLeaveDaysDefault when configured", () => {
    expect(resolveMedicalLeaveYearlyQuota(new Prisma.Decimal(18)).toNumber()).toBe(18);
  });

  it("does not fall back to the legacy 40-day quota", () => {
    expect(resolveMedicalLeaveYearlyQuota(null).toNumber()).not.toBe(40);
  });
});

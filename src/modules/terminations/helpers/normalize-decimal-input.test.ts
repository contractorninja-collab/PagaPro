import { describe, expect, it } from "vitest";
import { normalizeOptionalDecimalInput } from "@/modules/terminations/helpers/normalize-decimal-input";

describe("normalizeOptionalDecimalInput", () => {
  it.each([
    [undefined, undefined],
    [null, undefined],
    ["", undefined],
    ["   ", undefined],
    ["125.50", "125.50"],
    [" 125,50 ", "125.50"],
  ])("normalizes %j to %j", (input, expected) => {
    expect(normalizeOptionalDecimalInput(input)).toBe(expected);
  });
});

import { describe, expect, it } from "vitest";
import { AMOUNT_MASK, maskAmount } from "./mask-amount";

describe("maskAmount", () => {
  it("prints the figure when nothing is hidden", () => {
    expect(maskAmount("1.400,00 €", false)).toBe("1.400,00 €");
  });

  it("replaces the figure when hiding is on", () => {
    expect(maskAmount("1.400,00 €", true)).toBe(AMOUNT_MASK);
  });

  it("leaks no digits through the mask", () => {
    expect(maskAmount("12.345,67 €", true)).not.toMatch(/\d/);
  });

  it("masks a zero salary too — an amount of zero is still an amount", () => {
    expect(maskAmount("0,00 €", true)).toBe(AMOUNT_MASK);
  });

  it("keeps a constant width regardless of the figure behind it", () => {
    expect(maskAmount("9,99 €", true)).toBe(maskAmount("1.234.567,89 €", true));
  });
});

import Decimal from "decimal.js";

export type MoneyDecimal = Decimal;

export function D(value: string | number | Decimal): Decimal {
  return new Decimal(value);
}

export { Decimal };

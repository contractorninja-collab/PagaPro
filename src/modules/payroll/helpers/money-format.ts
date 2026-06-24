import { Prisma } from "@prisma/client";

export function decimalToMoneyString(v: Prisma.Decimal | null | undefined): string {
  if (v == null) return "0.00";
  return Number(v.toString()).toLocaleString("sq-XK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function decimalToPlain(v: Prisma.Decimal | null | undefined): string {
  if (v == null) return "0.00";
  return new Prisma.Decimal(v.toString()).toFixed(2);
}

export function eligibleTerminationYears(hireDate: Date, currentYear: number): number[] {
  const firstYear = hireDate.getUTCFullYear();
  if (firstYear > currentYear) return [];

  return Array.from(
    { length: currentYear - firstYear + 1 },
    (_, index) => currentYear - index,
  );
}

export function eligibleTerminationMonths(hireDate: Date, year: number): number[] {
  const hireYear = hireDate.getUTCFullYear();
  if (year < hireYear) return [];

  const firstMonth = year === hireYear ? hireDate.getUTCMonth() + 1 : 1;
  return Array.from({ length: 13 - firstMonth }, (_, index) => firstMonth + index);
}

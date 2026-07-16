export function eligibleLeaveYears(
  hireDate: Date,
  terminationDate: Date | null,
  currentYear: number,
): number[] {
  const firstYear = hireDate.getUTCFullYear();
  const lastYear = Math.min(
    currentYear,
    terminationDate?.getUTCFullYear() ?? currentYear,
  );

  if (firstYear > lastYear) return [];

  return Array.from(
    { length: lastYear - firstYear + 1 },
    (_, index) => lastYear - index,
  );
}

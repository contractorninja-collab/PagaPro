import type { ContractRuntimeDto } from "./types";
import { formatTemplateDate } from "./format";

function addMonths(date: Date, months: number): Date {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function resolveProbationEndDate(contract: ContractRuntimeDto): Date {
  const sixMonthsFromStart = addMonths(contract.effectiveDate, 6);
  if (contract.endDate && contract.endDate < sixMonthsFromStart) return contract.endDate;
  return sixMonthsFromStart;
}

export function buildContractRuntimePlaceholderMap(
  contract: ContractRuntimeDto,
  locale = "sq-AL",
): Record<string, string> {
  const startDate = formatTemplateDate(contract.effectiveDate, locale);
  return {
    contract_start_date: startDate,
    contract_end_date: contract.endDate ? formatTemplateDate(contract.endDate, locale) : "",
    employment_start_date: startDate,
    probation_end_date: formatTemplateDate(resolveProbationEndDate(contract), locale),
    travel_compensation: "sipas rregullores së brendshme",
  };
}

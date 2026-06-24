# Kosovo payroll — compliance notes (configuration)



This document summarizes **configurable** payroll knobs in PagaPRO that mirror common Kosovo labor contexts. It is **not legal advice**. Upload or link the official consolidated Labor Law PDF when your legal counsel provides it.



## Payroll multipliers (per company)



All premium multipliers are stored on **`PayrollSettings`** and fed into the calculation snapshot (`premiumRules`). Defaults used when bootstrapping / syncing (unless overridden by an active **PayrollParameterSet** JSON) align with common Kosovo-oriented examples:



| Bucket | Default multiplier | Formula (engine) |

|--------|-------------------|------------------|

| Overtime | 1.30× | `hourly_rate × overtime_hours × overtime_multiplier` |

| Weekend (Sat–Sun) | 1.50× | `hourly_rate × weekend_hours × weekend_multiplier` |

| Holiday (entered hours) | 2.00× | `hourly_rate × holiday_hours × holiday_multiplier` |

| Night | 1.30× | `hourly_rate × night_hours × night_multiplier` |



The **night window description** shown to HR (`nightWorkPeriodDescription`, default `22:00–06:00`) is configurable text for transparency; premiums still follow **`nightWorkMultiplier`**.



## Working days and expected regular hours



- Expected monthly regular hours = **`working_days × hoursPerWorkingDay`** (default **8** hours per working day on **`PayrollSettings`**).

- **Working days** = Monday–Friday dates in the payroll month **minus**:

  - weekday dates matching the **built-in Kosovo fixed public holiday calendar** (month/day list in code), **plus**

  - extra ISO dates `YYYY-MM-DD` in **`payrollExtraHolidayDates`**, **minus**

  - exclusions in **`payrollExcludedHolidayDates`**.

- Movable / lunar holidays: add explicit ISO dates via **`payrollExtraHolidayDates`** until a fuller calendar is maintained.



## Overtime thresholds (transparency & warnings)



- **`overtimeWeeklyThresholdHours`** (default **40**) documents the usual full-time weekly norm for HR; monthly overtime hours are still captured in the **`overtime_hours`** column.

- **`overtimeWeeklyCapHours`** (default **8**) drives **warning-only** heuristics (monthly OT vs cap × ~4.5); it does not block saves.



## Sick / medical leave pay



- **`PayrollSettings.sickLeavePayPercent`** expresses paid sick/medical hours as a fraction of the regular hourly rate (`1` = 100%). Tune per policy; describe HR rules in Konfigurime **“Leje mjekësore”** notes.



## Paid leave (including annual)



- Approved **`LeaveType.ANNUAL`** (and other paid categories in the integration) contribute to **`paid_leave_hours`**; engine pays **`hourly_rate × paid_leave_hours`** and reduces **`actual_regular_hours`** on regeneration so leave is not double-counted against expected hours.



## Unpaid leave



- Deduction: **`hourly_rate × unpaid_leave_hours`**; those hours also reduce regenerated **`actual_regular_hours`**.



## Minimum wage and pensions



- Monthly minimums and pension percentages flow from the active **`PayrollParameterSet`** and **`PayrollSettings`** rows created from Konfigurime — keep parameter sets effective-dated correctly.



## Payroll transparency (HR)



Each calculated row stores **`payrollTransparency`** inside **`calculationBreakdown`**: formulas and substitutions for hourly rate, overtime/weekend/holiday/night premiums, leave lines, pension references, PIT narrative, net pay, employer total cost, and calendar facts.



## Contractors



- Monthly payroll selection and spreadsheet regeneration include **`employmentType = EMPLOYEE`** only; contractors are excluded from this path by design.


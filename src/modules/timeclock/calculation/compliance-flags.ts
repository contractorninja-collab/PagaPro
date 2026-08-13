/**
 * Compliance signals over a month of classified time-clock days — the Labour
 * Law articles a payroll office is actually asked about:
 *
 * - Neni 23: full working time is 40 hours a week.
 * - Neni 27: night work (22:00–06:00) — surfaced, not judged; night work is
 *   lawful but carries obligations, so the office should see who does it.
 * - Neni 30: overtime is capped at 8 hours a week.
 * - Neni 31: at least 12 hours of rest between two working days.
 *
 * Pure — computed from day rows alone, so every threshold is unit-testable.
 * All dates are UTC calendar days as YYYY-MM-DD.
 */

export interface ComplianceDayInput {
  workDateIso: string;
  workedMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
  nightStackMinutes: number;
  firstInAt: Date | null;
  lastOutAt: Date | null;
}

export interface ComplianceFlag {
  article: "Neni 23" | "Neni 27" | "Neni 30" | "Neni 31";
  severity: "warn" | "info";
  /** Short Albanian label for a pill. */
  label: string;
  /** One sentence with the measured facts. */
  detail: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const h1 = (minutes: number): string => (minutes / 60).toFixed(1).replace(/\.0$/, "");

/** Monday of the ISO week containing the given UTC day. */
function weekStartIso(dayIso: string): string {
  const d = new Date(`${dayIso}T00:00:00.000Z`);
  const shift = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - shift * DAY_MS).toISOString().slice(0, 10);
}

function dayLabelSq(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return `${d.getUTCDate()} ${d.toLocaleDateString("sq-AL", { month: "long", timeZone: "UTC" })}`;
}

export function computeComplianceFlags(
  days: readonly ComplianceDayInput[],
  options?: {
    weeklyCapHours?: number;
    overtimeWeeklyCapHours?: number;
    minDailyRestHours?: number;
  },
): ComplianceFlag[] {
  const weeklyCap = (options?.weeklyCapHours ?? 40) * 60;
  const overtimeCap = (options?.overtimeWeeklyCapHours ?? 8) * 60;
  const minRestMs = (options?.minDailyRestHours ?? 12) * 60 * 60 * 1000;

  const flags: ComplianceFlag[] = [];

  // Weekly buckets, Monday-start.
  const weeks = new Map<string, { worked: number; overtime: number }>();
  for (const day of days) {
    const key = weekStartIso(day.workDateIso);
    const w = weeks.get(key) ?? { worked: 0, overtime: 0 };
    w.worked += day.workedMinutes;
    w.overtime += day.overtimeMinutes;
    weeks.set(key, w);
  }

  for (const [start, w] of [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (w.worked > weeklyCap) {
      flags.push({
        article: "Neni 23",
        severity: "warn",
        label: `${h1(w.worked)} h / javë`,
        detail: `Java që fillon më ${dayLabelSq(start)}: ${h1(w.worked)} orë të punuara — mbi orarin e plotë prej ${weeklyCap / 60} orësh (Neni 23).`,
      });
    }
    if (w.overtime > overtimeCap) {
      flags.push({
        article: "Neni 30",
        severity: "warn",
        label: `${h1(w.overtime)} h shtesë / javë`,
        detail: `Java që fillon më ${dayLabelSq(start)}: ${h1(w.overtime)} orë shtesë — mbi kufirin prej ${overtimeCap / 60} orësh në javë (Neni 30).`,
      });
    }
  }

  // Night work — informational: lawful, but the office should see it.
  const nightTotal = days.reduce((acc, d) => acc + d.nightMinutes + d.nightStackMinutes, 0);
  if (nightTotal > 0) {
    const nightDays = days.filter((d) => d.nightMinutes + d.nightStackMinutes > 0).length;
    flags.push({
      article: "Neni 27",
      severity: "info",
      label: `${h1(nightTotal)} h natë`,
      detail: `${h1(nightTotal)} orë pune nate në ${nightDays} ditë (22:00–06:00, Neni 27).`,
    });
  }

  // Rest between working days: the gap from one day's last OUT to the next
  // day's first IN. Days without both timestamps cannot assert a gap.
  const timed = days
    .filter((d) => d.firstInAt != null && d.lastOutAt != null)
    .sort((a, b) => a.workDateIso.localeCompare(b.workDateIso));
  for (let i = 1; i < timed.length; i++) {
    const prev = timed[i - 1]!;
    const next = timed[i]!;
    const gap = next.firstInAt!.getTime() - prev.lastOutAt!.getTime();
    if (gap >= 0 && gap < minRestMs) {
      flags.push({
        article: "Neni 31",
        severity: "warn",
        label: `${(gap / 3_600_000).toFixed(1).replace(/\.0$/, "")} h pushim`,
        detail: `Vetëm ${(gap / 3_600_000).toFixed(1).replace(/\.0$/, "")} orë pushim ndërmjet ${dayLabelSq(prev.workDateIso)} dhe ${dayLabelSq(next.workDateIso)} — minimumi është ${minRestMs / 3_600_000} orë (Neni 31).`,
      });
    }
  }

  return flags;
}

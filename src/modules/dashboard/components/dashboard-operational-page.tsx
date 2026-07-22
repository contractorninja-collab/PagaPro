import { AppSubBar } from "@/components/layout/app-sub-bar";
import { payrollMonthLabel, payrollMonthNameSq } from "@/modules/payroll/helpers/month-label";
import type { DepartmentOptionDto } from "@/modules/employees/types";
import type { DashboardOperationalPayload } from "../types/dashboard-types";
import { daysBetweenUtc } from "../helpers/dashboard-time";
import { DashboardActionCenter, type AtkDeadlineItem } from "../widgets/dashboard-action-center";
import { ActivityLogCard } from "../widgets/activity-log-card";
import { DashboardBrutoTrendCard } from "../widgets/dashboard-trend-card";
import { DashboardEmployeeDistribution } from "../widgets/dashboard-employee-distribution";
import { DashboardFiltersBar } from "../widgets/dashboard-filters-bar";
import { DashboardPayrollPanel } from "../widgets/dashboard-payroll-panel";
import { DashboardQuickActions } from "../widgets/dashboard-quick-actions";
import { DashboardKpiCards } from "../widgets/dashboard-summary-cards";

/**
 * Greeting by KOSOVO local time (the server runs UTC, so raw getHours() is off
 * by 1–2h): 00:01–10:30 Mirëmëngjes · 10:31–18:00 Përshëndetje ·
 * 18:01–24:00 Mirëmbrëma (midnight itself counts as evening).
 */
export function greetingForKosovoTime(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Belgrade",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const m = hour * 60 + minute;

  if (m === 0) return "Mirëmbrëma"; // exactly 00:00
  if (m <= 10 * 60 + 30) return "Mirëmëngjes"; // 00:01–10:30
  if (m <= 18 * 60) return "Përshëndetje"; // 10:31–18:00
  return "Mirëmbrëma"; // 18:01–23:59
}

/** "E enjte · 9 korrik 2026" — Albanian weekday + date eyebrow. */
function albanianDateEyebrow(now: Date): string {
  const weekdayRaw = new Intl.DateTimeFormat("sq-AL", { weekday: "long" }).format(now);
  const weekday = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1);
  const dateLabel = new Intl.DateTimeFormat("sq-AL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  return `${weekday} · ${dateLabel}`;
}

/**
 * ATK monthly declaration is due on the 15th of the month following the
 * filtered payroll period — presentation-side derivation, shown while upcoming.
 */
function buildAtkDeadline(data: DashboardOperationalPayload, now: Date): AtkDeadlineItem | null {
  const { year, month } = data.filters;
  const dueDate = new Date(Date.UTC(year, month, 15)); // month is 1-based → index = following month
  const daysLeft = daysBetweenUtc(now, dueDate);
  if (daysLeft < 0 || daysLeft > 45) return null;

  const dueMonth = month === 12 ? 1 : month + 1;
  const remaining =
    daysLeft === 0
      ? "Sot është dita e fundit"
      : daysLeft === 1
        ? "1 ditë e mbetur"
        : `${daysLeft} ditë të mbetura`;

  return {
    title: `Deklarata ATK skadon më 15 ${payrollMonthNameSq(dueMonth)}`,
    detail: `${remaining} për dorëzimin mujor · periudha ${payrollMonthLabel(year, month)}`,
    severity: daysLeft <= 3 ? "critical" : daysLeft <= 7 ? "warning" : "info",
    href: data.payroll.payrollId ? `/pagat/${data.payroll.payrollId}` : "/pagat",
  };
}

export function DashboardOperationalPage(props: {
  data: DashboardOperationalPayload;
  departments: DepartmentOptionDto[];
  userDisplayName?: string | null;
}) {
  const { data, departments } = props;

  const now = new Date();
  const firstName = props.userDisplayName?.trim().split(/\s+/)[0] || null;
  const greeting = greetingForKosovoTime(now);
  const atkDeadline = buildAtkDeadline(data, now);

  return (
    <>
      <AppSubBar
        eyebrow={albanianDateEyebrow(now)}
        title={firstName ? `${greeting}, ${firstName}` : greeting}
        actions={
          <>
            <DashboardFiltersBar departments={departments} filters={data.filters} />
            <DashboardQuickActions />
          </>
        }
      />

      <div className="pb-24 md:pb-8">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="min-w-0 space-y-[22px]" data-dashboard-column="main">
            <DashboardActionCenter
              alerts={data.alerts}
              leavePending={data.leavePending}
              today={data.leaveToday}
              contractExpiries={data.contractExpiries}
              atkDeadline={atkDeadline}
              pendingLeaveTotal={data.summary.leaveRequestsPending}
              expiringContractsTotal={data.summary.contractsExpiringWithin30Days}
            />
            <DashboardBrutoTrendCard payroll={data.payroll} />
            <DashboardEmployeeDistribution distribution={data.distribution} />
            <ActivityLogCard entries={data.timeline} />
          </div>

          <div className="min-w-0 space-y-[18px]" data-dashboard-column="sidebar">
            <DashboardPayrollPanel
              payroll={data.payroll}
              activeEmployeeCount={data.summary.activeEmployees}
            />
            <DashboardKpiCards summary={data.summary} />
          </div>
        </div>
      </div>
    </>
  );
}

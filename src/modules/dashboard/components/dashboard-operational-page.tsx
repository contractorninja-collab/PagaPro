import { AppSubBar } from "@/components/layout/app-sub-bar";
import { payrollMonthLabel, payrollMonthNameSq } from "@/modules/payroll/helpers/month-label";
import type { DepartmentOptionDto } from "@/modules/employees/types";
import type { DashboardOperationalPayload } from "../types/dashboard-types";
import { daysBetweenUtc } from "../helpers/dashboard-time";
import { DashboardActionCenter, type AtkDeadlineItem } from "../widgets/dashboard-action-center";
import { DashboardActivityTimeline } from "../widgets/dashboard-activity-timeline";
import { DashboardBrutoTrendCard } from "../widgets/dashboard-trend-card";
import { DashboardDocumentsSection } from "../widgets/dashboard-documents-section";
import { DashboardEmployeeDistribution } from "../widgets/dashboard-employee-distribution";
import { DashboardFiltersBar } from "../widgets/dashboard-filters-bar";
import { DashboardPayrollPanel } from "../widgets/dashboard-payroll-panel";
import { DashboardQuickActions } from "../widgets/dashboard-quick-actions";
import { DashboardKpiCards } from "../widgets/dashboard-summary-cards";

/** Greeting by server-side hour: Mirëmëngjes <12h, Mirëdita <18h, else Mirëmbrëma. */
function greetingForHour(hour: number): string {
  if (hour < 12) return "Mirëmëngjes";
  if (hour < 18) return "Mirëdita";
  return "Mirëmbrëma";
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
  const greeting = greetingForHour(now.getHours());
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="min-w-0 space-y-[22px]">
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
          </div>

          <div className="min-w-0 space-y-[18px]">
            <DashboardPayrollPanel payroll={data.payroll} />
            <div className="grid grid-cols-2 gap-3">
              <DashboardKpiCards summary={data.summary} />
            </div>
            <DashboardEmployeeDistribution distribution={data.distribution} />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DashboardDocumentsSection
            byCategory={data.documentsThisMonthByCategory}
            recent={data.recentDocuments}
          />
          <DashboardActivityTimeline entries={data.timeline} />
        </div>
      </div>
    </>
  );
}

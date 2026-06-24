import { PageHeader } from "@/components/patterns/page-header";
import type { DepartmentOptionDto } from "@/modules/employees/types";
import type { DashboardOperationalPayload } from "../types/dashboard-types";
import { DashboardActivityTimeline } from "../widgets/dashboard-activity-timeline";
import { DashboardAlertsPanel } from "../widgets/dashboard-alerts-panel";
import { DashboardContractExpiryTable } from "../widgets/dashboard-contract-expiry-table";
import { DashboardDocumentsSection } from "../widgets/dashboard-documents-section";
import { DashboardEmployeeDistribution } from "../widgets/dashboard-employee-distribution";
import { DashboardFiltersBar } from "../widgets/dashboard-filters-bar";
import { DashboardLeaveRequestsClient } from "../widgets/dashboard-leave-requests-client";
import { DashboardPayrollPanel } from "../widgets/dashboard-payroll-panel";
import { DashboardQuickActions } from "../widgets/dashboard-quick-actions";
import { DashboardSummaryCardsGrid } from "../widgets/dashboard-summary-cards";

export function DashboardOperationalPage(props: {
  data: DashboardOperationalPayload;
  departments: DepartmentOptionDto[];
}) {
  const { data, departments } = props;

  return (
    <div className="space-y-8 pb-24 md:pb-8">
      <PageHeader
        title="Paneli operativ"
        description="Përmbledhje nga databaza për kompaninë aktive — pa modalitet demo."
        actions={<DashboardQuickActions />}
      />

      <DashboardFiltersBar departments={departments} filters={data.filters} />

      <DashboardAlertsPanel alerts={data.alerts} />

      <DashboardSummaryCardsGrid summary={data.summary} />

      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardPayrollPanel payroll={data.payroll} />
        <DashboardEmployeeDistribution distribution={data.distribution} />
      </div>

      <DashboardContractExpiryTable rows={data.contractExpiries} />

      <DashboardLeaveRequestsClient pending={data.leavePending} today={data.leaveToday} />

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardActivityTimeline entries={data.timeline} />
        <DashboardDocumentsSection byCategory={data.documentsThisMonthByCategory} recent={data.recentDocuments} />
      </div>
    </div>
  );
}

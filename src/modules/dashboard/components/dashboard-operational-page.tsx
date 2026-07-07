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
import { DashboardKpiCards } from "../widgets/dashboard-summary-cards";

export function DashboardOperationalPage(props: {
  data: DashboardOperationalPayload;
  departments: DepartmentOptionDto[];
}) {
  const { data, departments } = props;

  return (
    <div className="dashboard-container pb-24 md:pb-8">
      <div className="mb-6 space-y-6">
        <PageHeader
          title="Paneli operativ"
          description="Kontrollo statusin e pagave, çështjet që kërkojnë vëmendje dhe hapat e radhës."
          actions={<DashboardQuickActions />}
        />
        <DashboardFiltersBar departments={departments} filters={data.filters} />
      </div>

      <div className="dashboard-main-grid mb-5">
        <DashboardPayrollPanel payroll={data.payroll} />
        <DashboardAlertsPanel alerts={data.alerts} />
      </div>

      <div className="dashboard-grid">
        {data.leavePending.length > 0 ? (
          <div className="card-full">
            <DashboardLeaveRequestsClient pending={data.leavePending} today={data.leaveToday} />
          </div>
        ) : null}

        <DashboardKpiCards summary={data.summary} />

        <div className="card-half">
          <DashboardEmployeeDistribution distribution={data.distribution} />
        </div>

        <div className="card-half">
          <DashboardContractExpiryTable rows={data.contractExpiries} />
        </div>

        <div className="card-half">
          <DashboardDocumentsSection
            byCategory={data.documentsThisMonthByCategory}
            recent={data.recentDocuments}
          />
        </div>

        <div className="card-half">
          <DashboardActivityTimeline entries={data.timeline} />
        </div>
      </div>

      <div id="leave-requests" className="scroll-mt-24" aria-hidden />
    </div>
  );
}

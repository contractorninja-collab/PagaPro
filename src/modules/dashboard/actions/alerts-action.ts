"use server";

import { getCompanyContext } from "@/server/company-context";
import { loadDashboardOperationalData } from "@/modules/dashboard/services/dashboard-data-service";
import type { OperationalAlert } from "@/modules/dashboard/types/dashboard-types";

export async function fetchAlertsAction(): Promise<OperationalAlert[]> {
  const result = await getCompanyContext();
  if (!result.ok) return [];
  const { companyId } = result.context;
  try {
    const now = new Date();
    const data = await loadDashboardOperationalData(companyId, {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
      departmentId: null,
    });
    return data.alerts ?? [];
  } catch {
    return [];
  }
}

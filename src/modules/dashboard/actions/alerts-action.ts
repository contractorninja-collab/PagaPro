"use server";

import { resolveActiveCompanyId } from "@/server/company-scope";
import { loadDashboardOperationalData } from "@/modules/dashboard/services/dashboard-data-service";
import type { OperationalAlert } from "@/modules/dashboard/types/dashboard-types";

export async function fetchAlertsAction(): Promise<OperationalAlert[]> {
  const companyId = await resolveActiveCompanyId();
  if (!companyId) return [];
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

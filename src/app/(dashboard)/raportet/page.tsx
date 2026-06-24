import type { Metadata } from "next";
import { RaportetDashboardClient } from "@/modules/reports/components/raportet-dashboard-client";
import { listReportCatalog } from "@/modules/reports/services/report-registry";
import {
  listGeneratedReports,
  loadReportPickerContext,
} from "@/modules/reports/services/report-query-service";
import { resolveActiveCompanyId } from "@/server/company-scope";

export const metadata: Metadata = {
  title: "Raportet",
};

function first(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  if (Array.isArray(v)) return v[0] ?? "";
  return typeof v === "string" ? v : "";
}

export default async function RaportetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const companyId = await resolveActiveCompanyId();

  if (!companyId) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-12">
        <h1 className="text-2xl font-semibold text-foreground">Raportet</h1>
        <p className="text-sm text-muted-foreground">
          Nuk ka kompani aktive për këtë sesion. Vendosni cookie-in{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">pp_active_company_id</code> ose{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">DEV_DEFAULT_COMPANY_ID</code>.
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  const yearRaw = Number(first(sp, "year"));
  const monthRaw = Number(first(sp, "month"));

  const catalog = listReportCatalog();

  let generated;
  let picker;
  try {
    generated = await listGeneratedReports(companyId, {
      payrollId: first(sp, "payrollId") || undefined,
      year: Number.isFinite(yearRaw) ? yearRaw : undefined,
      month: Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : undefined,
    });
    picker = await loadReportPickerContext(companyId);
  } catch (err) {
    console.error("[pagapro] RaportetPage load failed", err);
    return (
      <div className="mx-auto max-w-xl py-12">
        <p className="text-sm text-destructive">Nuk mund të ngarkohen raportet.</p>
      </div>
    );
  }

  const serializedGenerated = JSON.parse(JSON.stringify(generated)) as unknown;
  const serializedPicker = JSON.parse(JSON.stringify(picker)) as unknown;

  return (
    <RaportetDashboardClient
      catalog={catalog}
      generated={serializedGenerated as never}
      picker={serializedPicker as never}
    />
  );
}

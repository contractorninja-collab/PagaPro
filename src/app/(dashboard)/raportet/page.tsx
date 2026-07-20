import type { Metadata } from "next";
import { RaportetDashboardClient } from "@/modules/reports/components/raportet-dashboard-client";
import { listReportCatalog } from "@/modules/reports/services/report-registry";
import {
  listGeneratedReports,
  loadReportPickerContext,
} from "@/modules/reports/services/report-query-service";
import { requireCompanyContextPage } from "@/server/company-context";

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
  const { companyId } = await requireCompanyContextPage();

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

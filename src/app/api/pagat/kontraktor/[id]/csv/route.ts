import { NextResponse } from "next/server";
import { companyContextHttpError, getCompanyContext } from "@/server/company-context";
import { getContractorPayrollDetail } from "@/modules/payroll/contractor/contractor-payroll-service";
import { rowsToCsvBuffer } from "@/modules/reports/exporters/csv-export";
import type { ReportColumnDef, ReportRow } from "@/modules/reports/types";

const COLUMNS: ReportColumnDef[] = [
  { key: "fullName", headerSq: "Kontraktori" },
  { key: "personalId", headerSq: "Numri personal" },
  { key: "hourlyRate", headerSq: "Tarifa €/orë" },
  { key: "regularHours", headerSq: "Orë të rregullta" },
  { key: "overtimeHours", headerSq: "Orë shtesë" },
  { key: "weekendHours", headerSq: "Orë vikendi" },
  { key: "holidayHours", headerSq: "Orë feste" },
  { key: "nightHours", headerSq: "Orë nate" },
  { key: "hoursSource", headerSq: "Burimi i orëve" },
  { key: "grossPay", headerSq: "Bruto (€)" },
];

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const result = await getCompanyContext();
  if (!result.ok) return companyContextHttpError(result.reason);
  const { companyId } = result.context;

  const { id } = await context.params;
  const detail = await getContractorPayrollDetail(companyId, id);
  if (!detail) {
    return NextResponse.json({ error: "Periudha nuk u gjet." }, { status: 404 });
  }

  const rows: ReportRow[] = detail.entries.map((e) => ({
    fullName: `${e.lastName}, ${e.firstName}`,
    personalId: e.personalId,
    hourlyRate: e.hourlyRate,
    regularHours: e.regularHours,
    overtimeHours: e.overtimeHours,
    weekendHours: e.weekendHours,
    holidayHours: e.holidayHours,
    nightHours: e.nightHours,
    hoursSource: e.hoursSource === "TIMECLOCK" ? "Ora e punës" : "Manual",
    grossPay: e.grossPay,
  }));

  const sum = (pick: (r: ReportRow) => unknown): string =>
    rows.reduce((acc, r) => acc + Number(pick(r) ?? 0), 0).toFixed(2);

  rows.push({
    fullName: "TOTALI",
    personalId: "",
    hourlyRate: "",
    regularHours: sum((r) => r.regularHours),
    overtimeHours: sum((r) => r.overtimeHours),
    weekendHours: sum((r) => r.weekendHours),
    holidayHours: sum((r) => r.holidayHours),
    nightHours: sum((r) => r.nightHours),
    hoursSource: "",
    grossPay: detail.totalGross,
  });

  const slug = `${detail.year}-${String(detail.month).padStart(2, "0")}`;
  const buf = rowsToCsvBuffer(COLUMNS, rows);

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="Pagat_Kontraktor_${slug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

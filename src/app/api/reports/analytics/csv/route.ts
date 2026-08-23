import { NextResponse } from "next/server";
import { companyContextHttpError, getCompanyContext } from "@/server/company-context";
import {
  leavePressure,
  payrollCostSeries,
  workforceShape,
} from "@/modules/reports/services/report-analytics-service";
import { rowsToCsvBuffer } from "@/modules/reports/exporters/csv-export";
import type { ReportColumnDef, ReportRow } from "@/modules/reports/types";

/**
 * CSV of what the /raportet sections show: `?section=cost|workforce|leave&year=2026`.
 *
 * The page could render the cost series and no one could take it to finance —
 * three chart sections, zero download buttons. Same aggregates, same year
 * scope, one file per section.
 */

const MIN_YEAR = 1970;
const MAX_YEAR = 2100;

function csvResponse(filename: string, columns: ReportColumnDef[], rows: ReportRow[]): NextResponse {
  const buf = rowsToCsvBuffer(columns, rows);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(request: Request) {
  const result = await getCompanyContext();
  if (!result.ok) return companyContextHttpError(result.reason);
  const { companyId } = result.context;

  const url = new URL(request.url);
  const section = url.searchParams.get("section") ?? "";
  const yearRaw = Number(url.searchParams.get("year"));
  const year =
    Number.isInteger(yearRaw) && yearRaw >= MIN_YEAR && yearRaw <= MAX_YEAR
      ? yearRaw
      : new Date().getUTCFullYear();

  if (section === "cost") {
    const series = await payrollCostSeries(companyId, year);
    const columns: ReportColumnDef[] = [
      { key: "muaji", headerSq: "Muaji" },
      { key: "bruto", headerSq: "Bruto (€)" },
      { key: "neto", headerSq: "Neto (€)" },
      { key: "kosto", headerSq: "Kosto e punëdhënësit (€)" },
      { key: "barra", headerSq: "Barra e punëdhënësit (€)" },
      { key: "tatimi", headerSq: "Tatimi (€)" },
      { key: "trustiPunonjes", headerSq: "Trusti punonjësi (€)" },
      { key: "trustiPunedhenes", headerSq: "Trusti punëdhënësi (€)" },
      { key: "punonjes", headerSq: "Punonjës" },
      { key: "statusi", headerSq: "Statusi" },
    ];
    const rows: ReportRow[] = series.map((p) => ({
      muaji: p.label,
      bruto: p.gross.toFixed(2),
      neto: p.net.toFixed(2),
      kosto: p.employerCost.toFixed(2),
      barra: p.employerBurden.toFixed(2),
      tatimi: p.pit.toFixed(2),
      trustiPunonjes: p.pensionEmployee.toFixed(2),
      trustiPunedhenes: p.pensionEmployer.toFixed(2),
      punonjes: p.employees,
      statusi: p.isDraft ? "DRAFT" : "Final",
    }));
    return csvResponse(`Kostoja_e_Pagave_${year}.csv`, columns, rows);
  }

  if (section === "workforce") {
    const shape = await workforceShape(companyId, year);
    const columns: ReportColumnDef[] = [
      { key: "muaji", headerSq: "Muaji" },
      { key: "punesime", headerSq: "Punësime" },
      { key: "largime", headerSq: "Largime" },
      { key: "neto", headerSq: "Ndryshimi neto" },
    ];
    const rows: ReportRow[] = shape.movement.map((m) => ({
      muaji: m.label,
      punesime: m.joiners,
      largime: m.leavers,
      neto: m.net,
    }));
    return csvResponse(`Levizja_e_Fuqise_Punetore_${year}.csv`, columns, rows);
  }

  if (section === "leave") {
    const pressure = await leavePressure(companyId, year);
    const columns: ReportColumnDef[] = [
      { key: "punonjesi", headerSq: "Punonjësi" },
      { key: "departamenti", headerSq: "Departamenti" },
      { key: "bartje", headerSq: "Ditë të bartura" },
      { key: "mbetur", headerSq: "Ditë të mbetura" },
      { key: "skadon", headerSq: "Bartja skadon më" },
    ];
    const rows: ReportRow[] = pressure.carryAtRisk.map((r) => ({
      punonjesi: r.employeeName,
      departamenti: r.departmentName ?? "",
      bartje: r.carryDays.toFixed(2),
      mbetur: r.remainingDays.toFixed(2),
      skadon: r.expiresIso ? r.expiresIso.slice(0, 10) : "",
    }));
    return csvResponse(`Pushimet_ne_Rrezik_Bartjeje_${year}.csv`, columns, rows);
  }

  return NextResponse.json({ error: "section duhet të jetë cost, workforce ose leave" }, { status: 400 });
}

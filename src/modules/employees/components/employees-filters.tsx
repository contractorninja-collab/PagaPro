import Link from "next/link";
import { Search, X } from "lucide-react";
import type { DepartmentOptionDto } from "@/modules/employees/types";

export interface EmployeesFilterValues {
  q: string;
  status: string;
  employmentType: string;
  departmentId: string;
  documentsMissing: boolean;
}

const SELECT_PILL =
  "h-10 shrink-0 rounded-[10px] border border-[#e2e8f0] bg-white px-3 text-[13px] font-medium text-[#334155] transition-colors hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30";

/** Riprodhon URL-në e filtrave aktualë pa flamurin documentsMissing (për çipin aktiv). */
function hrefWithoutDocFilter(defaults: EmployeesFilterValues): string {
  const params = new URLSearchParams();
  if (defaults.q) params.set("q", defaults.q);
  if (defaults.status) params.set("status", defaults.status);
  if (defaults.employmentType) params.set("employmentType", defaults.employmentType);
  if (defaults.departmentId) params.set("departmentId", defaults.departmentId);
  const qs = params.toString();
  return qs ? `/punonjesit?${qs}` : "/punonjesit";
}

/** Filtrim server-side përmes GET — pa JavaScript të domosdoshëm */
export function EmployeesFilters(props: {
  departments: DepartmentOptionDto[];
  defaults: EmployeesFilterValues;
}) {
  const { departments, defaults } = props;

  return (
    <form
      action="/punonjesit"
      method="get"
      className="rounded-xl border border-[#e2e8f0] bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
    >
      {/* Butoni i padukshëm i parë në DOM: siguron që Enter në kërkim të mos aktivizojë çipin "Dok. mungojnë" (implicit submission përdor submit-butonin e parë). */}
      <button type="submit" className="hidden" tabIndex={-1} aria-hidden />

      {defaults.documentsMissing ? (
        <input type="hidden" name="documentsMissing" value="1" />
      ) : null}

      <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative min-w-0 flex-1 lg:min-w-[220px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]"
            aria-hidden
          />
          <input
            id="emp-q"
            name="q"
            type="search"
            aria-label="Kërko punonjës"
            placeholder="Kërko: emër, numër personal, email…"
            defaultValue={defaults.q}
            className="h-10 w-full rounded-[10px] border border-[#e2e8f0] bg-white pl-9 pr-3 text-[13.5px] text-[#111827] placeholder:text-[#94a3b8] focus-visible:border-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30"
          />
        </div>

        <select
          id="emp-status"
          name="status"
          aria-label="Statusi"
          defaultValue={defaults.status}
          className={SELECT_PILL}
        >
          <option value="">Statusi: Të gjitha</option>
          <option value="ACTIVE">Aktiv</option>
          <option value="INACTIVE">Jo aktiv</option>
          <option value="ON_LEAVE">Në pushim</option>
          <option value="SUSPENDED">Pezulluar</option>
          <option value="TERMINATED">I larguar</option>
        </select>

        <select
          id="emp-type"
          name="employmentType"
          aria-label="Lloji"
          defaultValue={defaults.employmentType}
          className={SELECT_PILL}
        >
          <option value="">Lloji: Të gjitha</option>
          <option value="EMPLOYEE">Punonjës</option>
          <option value="CONTRACTOR">Kontraktor</option>
        </select>

        <select
          id="emp-dept"
          name="departmentId"
          aria-label="Departamenti"
          defaultValue={defaults.departmentId}
          className={SELECT_PILL}
        >
          <option value="">Departamenti: Të gjitha</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        {defaults.documentsMissing ? (
          <Link
            href={hrefWithoutDocFilter(defaults)}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-[#d97706] bg-[#fef3c7] px-4 text-[12.5px] font-semibold text-[#b45309] transition-colors hover:bg-[#fde68a]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#d97706]" aria-hidden />
            Dok. mungojnë
            <X className="h-3.5 w-3.5" aria-hidden />
          </Link>
        ) : (
          <button
            type="submit"
            name="documentsMissing"
            value="1"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-[#fde68a] bg-[#fffbeb] px-4 text-[12.5px] font-semibold text-[#b45309] transition-colors hover:bg-[#fef3c7]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#d97706]" aria-hidden />
            Dok. mungojnë
          </button>
        )}

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-[10px] bg-brand-blue px-[18px] text-[13.5px] font-semibold text-white transition-colors hover:bg-[#1d4ed8]"
          >
            Filtro
          </button>
          <Link
            href={defaults.documentsMissing ? "/punonjesit?documentsMissing=1" : "/punonjesit"}
            className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[#e2e8f0] bg-white px-4 text-[13.5px] font-semibold text-[#334155] transition-colors hover:bg-[#eef2f7]"
          >
            Pastro
          </Link>
        </div>
      </div>

      {defaults.documentsMissing ? (
        <p className="mt-2.5 text-xs text-[#94a3b8]">
          Filtri aktiv: vetëm punonjës me dokumentacion të paplotë.
        </p>
      ) : null}
    </form>
  );
}

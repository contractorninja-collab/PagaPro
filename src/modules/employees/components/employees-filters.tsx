"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import type { DepartmentOptionDto } from "@/modules/employees/types";
import { UNASSIGNED_DEPARTMENT_FILTER } from "@/modules/employees/filters/department-filter";

export interface EmployeesFilterValues {
  q: string;
  status: string;
  employmentType: string;
  departmentId: string;
  documentsMissing: boolean;
}

const SELECT_PILL =
  "h-10 shrink-0 rounded-[10px] border border-line bg-white px-3 text-[13px] font-medium text-ink-700 transition-colors hover:bg-fill-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30";

/**
 * Server-side filtering through a plain GET form — still works without
 * JavaScript, where the submit button is the fallback. With JS the selects
 * submit themselves on change, so there is nothing to press.
 *
 * The "Dok. mungojnë" quick filter lives on its stat card, not here; having it
 * in both places meant two controls doing one thing a few pixels apart.
 */
export function EmployeesFilters(props: {
  departments: DepartmentOptionDto[];
  defaults: EmployeesFilterValues;
}) {
  const { departments, defaults } = props;

  const submitOnChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <form
      action="/punonjesit"
      method="get"
      className="rounded-xl border border-line bg-white p-3 shadow-card"
    >
      {defaults.documentsMissing ? (
        <input type="hidden" name="documentsMissing" value="1" />
      ) : null}

      <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative min-w-0 flex-1 lg:min-w-[220px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
            aria-hidden
          />
          <input
            id="emp-q"
            name="q"
            type="search"
            aria-label="Kërko punonjës"
            placeholder="Kërko: emër, numër personal, email…"
            defaultValue={defaults.q}
            className="h-10 w-full rounded-[10px] border border-line bg-white pl-9 pr-3 text-[13.5px] text-[#111827] placeholder:text-ink-400 focus-visible:border-brand-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30"
          />
        </div>

        <select
          id="emp-status"
          name="status"
          aria-label="Statusi"
          defaultValue={defaults.status}
          onChange={submitOnChange}
          className={SELECT_PILL}
        >
          <option value="">Statusi: Në listë</option>
          <option value="ACTIVE">Aktiv</option>
          <option value="INACTIVE">Jo aktiv</option>
          <option value="ON_LEAVE">Në pushim</option>
          <option value="SUSPENDED">Pezulluar</option>
          <option value="TERMINATED">I larguar</option>
          <option value="ALL">Të gjithë, me të larguarit</option>
        </select>

        <select
          id="emp-type"
          name="employmentType"
          aria-label="Lloji"
          defaultValue={defaults.employmentType}
          onChange={submitOnChange}
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
          onChange={submitOnChange}
          className={SELECT_PILL}
        >
          <option value="">Departamenti: Të gjitha</option>
          <option value={UNASSIGNED_DEPARTMENT_FILTER}>Pa departament</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <div className="flex shrink-0 items-center gap-2">
          {/* Fallback for no-JS; the selects submit themselves otherwise. */}
          <noscript>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-[10px] bg-brand-blue px-[18px] text-[13.5px] font-semibold text-white"
            >
              Filtro
            </button>
          </noscript>
          <Link
            href="/punonjesit"
            className="inline-flex h-10 items-center justify-center rounded-[10px] border border-line bg-white px-4 text-[13.5px] font-semibold text-ink-700 transition-colors hover:bg-fill-hover"
          >
            Pastro
          </Link>
        </div>
      </div>
    </form>
  );
}

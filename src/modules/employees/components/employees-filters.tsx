import Link from "next/link";
import type { DepartmentOptionDto } from "@/modules/employees/types";

export interface EmployeesFilterValues {
  q: string;
  status: string;
  employmentType: string;
  departmentId: string;
}

/** Filtrim server-side përmes GET — pa JavaScript të domosdoshëm */
export function EmployeesFilters(props: {
  departments: DepartmentOptionDto[];
  defaults: EmployeesFilterValues;
}) {
  const { departments, defaults } = props;

  return (
    <form action="/punonjesit" method="get" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm md:flex-row md:flex-wrap md:items-end">
      <div className="flex min-w-[200px] flex-1 flex-col gap-1">
        <label htmlFor="emp-q" className="text-xs font-medium text-muted-foreground">
          Kërko
        </label>
        <input
          id="emp-q"
          name="q"
          type="search"
          placeholder="Emër, mbiemër, numër personal, email…"
          defaultValue={defaults.q}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="flex min-w-[140px] flex-col gap-1">
        <label htmlFor="emp-status" className="text-xs font-medium text-muted-foreground">
          Statusi
        </label>
        <select
          id="emp-status"
          name="status"
          defaultValue={defaults.status}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Të gjitha</option>
          <option value="ACTIVE">Aktiv</option>
          <option value="INACTIVE">Jo aktiv</option>
          <option value="ON_LEAVE">Në pushim</option>
          <option value="SUSPENDED">Pezulluar</option>
          <option value="TERMINATED">I larguar</option>
        </select>
      </div>
      <div className="flex min-w-[140px] flex-col gap-1">
        <label htmlFor="emp-type" className="text-xs font-medium text-muted-foreground">
          Lloji
        </label>
        <select
          id="emp-type"
          name="employmentType"
          defaultValue={defaults.employmentType}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Të gjitha</option>
          <option value="EMPLOYEE">Punonjës</option>
          <option value="CONTRACTOR">Kontraktor</option>
        </select>
      </div>
      <div className="flex min-w-[160px] flex-1 flex-col gap-1">
        <label htmlFor="emp-dept" className="text-xs font-medium text-muted-foreground">
          Departamenti
        </label>
        <select
          id="emp-dept"
          name="departmentId"
          defaultValue={defaults.departmentId}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Të gjitha</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 pb-0.5">
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          Filtro
        </button>
        <Link
          href="/punonjesit"
          className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted"
        >
          Pastro
        </Link>
      </div>
    </form>
  );
}

import Link from "next/link";
import type { LeaveRequestStatus, LeaveType } from "@prisma/client";
import type { PushimetDepartmentOptionDto, PushimetEmployeeOptionDto } from "@/modules/leaves/types/pushimet";

const LEAVE_TYPES: LeaveType[] = [
  "PUSHIM_VJETOR",
  "PUSHIM_MJEKESOR",
  "PUSHIM_PERSONAL",
  "PUSHIM_PA_PAGESE",
  "PUSHIM_LEHONIE",
  "TJETER",
];

const STATUSES: LeaveRequestStatus[] = ["DRAFT", "PENDING", "APPROVED", "REJECTED", "CANCELLED"];

const TYPE_LABELS: Record<LeaveType, string> = {
  PUSHIM_VJETOR: "Pushim vjetor",
  PUSHIM_MJEKESOR: "Pushim mjekësor",
  PUSHIM_PERSONAL: "Pushim personal",
  PUSHIM_PA_PAGESE: "Pa pagesë",
  PUSHIM_LEHONIE: "Pushim lehonie",
  TJETER: "Tjetër",
};

export type PushimetFilterDefaults = {
  employeeId: string;
  departmentId: string;
  type: string;
  status: string;
  year: string;
  month: string;
};

export function PushimetFiltersForm(props: {
  employees: PushimetEmployeeOptionDto[];
  departments: PushimetDepartmentOptionDto[];
  defaults: PushimetFilterDefaults;
}) {
  const { employees, departments, defaults } = props;

  return (
    <form
      action="/pushimet"
      method="get"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm md:flex-row md:flex-wrap md:items-end"
    >
      <div className="flex min-w-[200px] flex-1 flex-col gap-1">
        <label htmlFor="pf-emp" className="text-xs font-medium text-muted-foreground">
          Punonjësi
        </label>
        <select
          id="pf-emp"
          name="employeeId"
          defaultValue={defaults.employeeId}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Të gjithë</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-[180px] flex-1 flex-col gap-1">
        <label htmlFor="pf-dept" className="text-xs font-medium text-muted-foreground">
          Departamenti
        </label>
        <select
          id="pf-dept"
          name="departmentId"
          defaultValue={defaults.departmentId}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Të gjithë</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-[160px] flex-col gap-1">
        <label htmlFor="pf-type" className="text-xs font-medium text-muted-foreground">
          Lloji i pushimit
        </label>
        <select
          id="pf-type"
          name="type"
          defaultValue={defaults.type}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Të gjitha</option>
          {LEAVE_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-[140px] flex-col gap-1">
        <label htmlFor="pf-status" className="text-xs font-medium text-muted-foreground">
          Statusi
        </label>
        <select
          id="pf-status"
          name="status"
          defaultValue={defaults.status}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Të gjitha</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-[100px] flex-col gap-1">
        <label htmlFor="pf-year" className="text-xs font-medium text-muted-foreground">
          Viti
        </label>
        <input
          id="pf-year"
          name="year"
          type="number"
          min={2000}
          max={2100}
          defaultValue={defaults.year}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="flex min-w-[110px] flex-col gap-1">
        <label htmlFor="pf-month" className="text-xs font-medium text-muted-foreground">
          Muaji
        </label>
        <select
          id="pf-month"
          name="month"
          defaultValue={defaults.month}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={String(m)}>
              {m}
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
          href="/pushimet"
          className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted"
        >
          Pastro
        </Link>
      </div>
    </form>
  );
}

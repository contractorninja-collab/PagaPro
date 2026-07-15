import Link from "next/link";
import type { LeaveRequestStatus, LeaveType } from "@prisma/client";
import { LEAVE_TYPE_LABELS_SQ } from "@/modules/leaves/helpers/leave-type-metadata";
import { LEAVE_STATUS_LABELS_SQ } from "@/modules/leaves/helpers/leave-status-labels";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  FIELD_CONTROL,
  LEAVE_CARD,
  MICRO_LABEL,
} from "@/modules/leaves/components/leave-ui";
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
      className={`flex flex-col gap-3 p-4 md:flex-row md:flex-wrap md:items-end ${LEAVE_CARD}`}
    >
      <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
        <label htmlFor="pf-emp" className={MICRO_LABEL}>
          Punonjësi
        </label>
        <select id="pf-emp" name="employeeId" defaultValue={defaults.employeeId} className={FIELD_CONTROL}>
          <option value="">Të gjithë</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
        <label htmlFor="pf-dept" className={MICRO_LABEL}>
          Departamenti
        </label>
        <select id="pf-dept" name="departmentId" defaultValue={defaults.departmentId} className={FIELD_CONTROL}>
          <option value="">Të gjithë</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-[160px] flex-col gap-1.5">
        <label htmlFor="pf-type" className={MICRO_LABEL}>
          Lloji i pushimit
        </label>
        <select id="pf-type" name="type" defaultValue={defaults.type} className={FIELD_CONTROL}>
          <option value="">Të gjitha</option>
          {LEAVE_TYPES.map((t) => (
            <option key={t} value={t}>
              {LEAVE_TYPE_LABELS_SQ[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-[140px] flex-col gap-1.5">
        <label htmlFor="pf-status" className={MICRO_LABEL}>
          Statusi
        </label>
        <select id="pf-status" name="status" defaultValue={defaults.status} className={FIELD_CONTROL}>
          <option value="">Të gjitha</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {LEAVE_STATUS_LABELS_SQ[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-[100px] flex-col gap-1.5">
        <label htmlFor="pf-year" className={MICRO_LABEL}>
          Viti
        </label>
        <input
          id="pf-year"
          name="year"
          type="number"
          min={2000}
          max={2100}
          defaultValue={defaults.year}
          className={`${FIELD_CONTROL} tabular-nums`}
        />
      </div>
      <div className="flex min-w-[110px] flex-col gap-1.5">
        <label htmlFor="pf-month" className={MICRO_LABEL}>
          Muaji
        </label>
        <select id="pf-month" name="month" defaultValue={defaults.month} className={FIELD_CONTROL}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={String(m)}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" className={BTN_PRIMARY}>
          Filtro
        </button>
        <Link href="/pushimet" className={BTN_SECONDARY}>
          Pastro
        </Link>
      </div>
    </form>
  );
}

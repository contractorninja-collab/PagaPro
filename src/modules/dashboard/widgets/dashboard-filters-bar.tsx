"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { DepartmentOptionDto } from "@/modules/employees/types";
import type { DashboardFilters } from "../types/dashboard-types";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function DashboardFiltersBar(props: {
  departments: DepartmentOptionDto[];
  filters: DashboardFilters;
}) {
  const router = useRouter();
  const years = [props.filters.year - 1, props.filters.year, props.filters.year + 1];

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const year = String(fd.get("year") ?? props.filters.year);
    const month = String(fd.get("month") ?? props.filters.month);
    const dept = String(fd.get("department") ?? "").trim();
    const params = new URLSearchParams();
    params.set("year", year);
    params.set("month", month);
    if (dept) params.set("department", dept);
    router.replace(`/paneli?${params.toString()}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-lg border border-border/80 bg-muted/30 p-4 md:flex-row md:flex-wrap md:items-end"
    >
      <div className="grid min-w-[140px] flex-1 gap-2">
        <Label htmlFor="dash-year">Viti</Label>
        <select id="dash-year" name="year" className={selectClass} defaultValue={props.filters.year}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <div className="grid min-w-[160px] flex-1 gap-2">
        <Label htmlFor="dash-month">Muaji</Label>
        <select id="dash-month" name="month" className={selectClass} defaultValue={props.filters.month}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {String(m).padStart(2, "0")}
            </option>
          ))}
        </select>
      </div>
      <div className="grid min-w-[200px] flex-[2] gap-2">
        <Label htmlFor="dash-dept">Departamenti</Label>
        <select id="dash-dept" name="department" className={selectClass} defaultValue={props.filters.departmentId ?? ""}>
          <option value="">Të gjithë</option>
          {props.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" className="md:mb-0.5">
        Apliko filtrat
      </Button>
    </form>
  );
}

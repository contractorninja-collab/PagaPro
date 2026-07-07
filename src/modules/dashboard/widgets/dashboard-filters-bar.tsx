"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { payrollMonthLabel } from "@/modules/payroll/helpers/month-label";
import type { DepartmentOptionDto } from "@/modules/employees/types";
import type { DashboardFilters } from "../types/dashboard-types";

const selectClass =
  "h-8 rounded-md border border-input bg-background px-2 py-0 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function DashboardFiltersBar(props: {
  departments: DepartmentOptionDto[];
  filters: DashboardFilters;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const years = [props.filters.year - 1, props.filters.year, props.filters.year + 1];
  const periodLabel = payrollMonthLabel(props.filters.year, props.filters.month);
  const departmentLabel =
    props.filters.departmentId == null
      ? "Të gjithë"
      : (props.departments.find((d) => d.id === props.filters.departmentId)?.name ?? "—");

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
    setEditing(false);
  }

  if (!editing) {
    return (
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"
        aria-label="Filtrat aktualë të panelit"
      >
        <p className="text-muted-foreground">
          Periudha:{" "}
          <span className="font-medium text-foreground">{periodLabel}</span>
        </p>
        <span className="hidden text-border sm:inline" aria-hidden>
          ·
        </span>
        <p className="text-muted-foreground">
          Departamenti:{" "}
          <span className="font-medium text-foreground">{departmentLabel}</span>
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => setEditing(true)}
        >
          Ndrysho filtrat
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      aria-label="Ndrysho filtrat e panelit"
      className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2"
    >
      <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
        Viti
        <select
          id="dash-year"
          name="year"
          className={selectClass}
          defaultValue={props.filters.year}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
        Muaji
        <select
          id="dash-month"
          name="month"
          className={selectClass}
          defaultValue={props.filters.month}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {String(m).padStart(2, "0")}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
        Departamenti
        <select
          id="dash-dept"
          name="department"
          className={selectClass}
          defaultValue={props.filters.departmentId ?? ""}
        >
          <option value="">Të gjithë</option>
          {props.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-1.5">
        <Button type="submit" size="sm" className="h-8">
          Apliko
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8"
          onClick={() => setEditing(false)}
        >
          Anulo
        </Button>
      </div>
    </form>
  );
}

export function DashboardFiltersBarSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="h-4 w-40 rounded bg-muted" />
      <div className="h-4 w-36 rounded bg-muted" />
      <div className="h-8 w-28 rounded bg-muted" />
    </div>
  );
}

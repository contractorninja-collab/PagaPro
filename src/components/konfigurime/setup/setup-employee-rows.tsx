"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, randomClientId } from "@/lib/utils";
import { createEmployeeAction } from "@/modules/employees/actions/employee-actions";
import { createDepartmentAction } from "@/modules/departments/actions/department-actions";
import { SETUP_EMPLOYEE_ROW_CONSTANTS } from "@/modules/konfigurime/setup/setup-defaults";
import type { JobTitleDto } from "@/modules/job-titles/services/job-title-service";

/**
 * The quick employee grid — six columns, typed straight through.
 *
 * Deliberately not the full employee sheet: that form has sixty-odd fields and
 * is what makes adding the first three people feel like homework. Everything
 * `employeeUpsertSchema` requires but a first-time client should not be asked
 * about comes from SETUP_EMPLOYEE_ROW_CONSTANTS.
 *
 * Rows save one at a time and partially: whatever is valid lands, whatever
 * fails stays on screen with its reason. Nothing typed is ever thrown away.
 */

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export interface SetupEmployeeRow {
  rowKey: string;
  firstName: string;
  lastName: string;
  personalId: string;
  jobTitleId: string;
  departmentId: string;
  hireDate: string;
  baseSalaryMonthly: string;
}

export interface SetupCreatedEmployee {
  id: string;
  fullName: string;
  jobTitle: string | null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function blankRow(jobTitleId: string, hireDate: string): SetupEmployeeRow {
  return {
    rowKey: randomClientId(),
    firstName: "",
    lastName: "",
    personalId: "",
    jobTitleId,
    departmentId: "",
    hireDate,
    baseSalaryMonthly: "",
  };
}

export function SetupEmployeeRows(props: {
  jobTitles: JobTitleDto[];
  departments: { id: string; name: string }[];
  disabled?: boolean;
  onDepartmentCreated: (dept: { id: string; name: string }) => void;
  onCreated: (created: SetupCreatedEmployee[]) => void;
}) {
  const activeTitles = props.jobTitles.filter((j) => j.status === "ACTIVE");
  const defaultTitleId = activeTitles[0]?.id ?? "";

  const [rows, setRows] = useState<SetupEmployeeRow[]>(() => [
    blankRow(defaultTitleId, todayIso()),
    blankRow(defaultTitleId, todayIso()),
    blankRow(defaultTitleId, todayIso()),
  ]);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [newDept, setNewDept] = useState("");
  const [deptOpen, setDeptOpen] = useState(false);

  function patch(rowKey: string, key: keyof SetupEmployeeRow, value: string) {
    setRows((prev) => prev.map((r) => (r.rowKey === rowKey ? { ...r, [key]: value } : r)));
  }

  function addRow() {
    setRows((prev) => {
      // A new row inherits the previous row's hire date — companies migrating
      // from another provider usually share one start date.
      const last = prev[prev.length - 1];
      return [...prev, blankRow(last?.jobTitleId || defaultTitleId, last?.hireDate || todayIso())];
    });
  }

  function removeRow(rowKey: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.rowKey !== rowKey)));
  }

  /** A row the client has started filling in — blank rows are ignored, not errors. */
  function isStarted(r: SetupEmployeeRow): boolean {
    return Boolean(r.firstName.trim() || r.lastName.trim() || r.personalId.trim());
  }

  async function createDepartment() {
    const name = newDept.trim();
    if (!name) return;
    const res = await createDepartmentAction({ name });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    props.onDepartmentCreated({ id: res.id, name: res.name });
    setNewDept("");
    setDeptOpen(false);
    toast.success(`Departamenti «${res.name}» u krijua.`);
  }

  async function saveRows() {
    if (saving) return;
    const started = rows.filter(isStarted);
    if (started.length === 0) {
      toast.error("Plotësoni së paku një rresht.");
      return;
    }

    setSaving(true);
    try {
      const created: SetupCreatedEmployee[] = [];
      const failedKeys = new Set<string>();
      const nextErrors: Record<string, string> = {};

      for (const row of started) {
        // A blank salary cell used to become "0": the schema accepts zero for a
        // regular employee, so the person was created on a zero gross wage and
        // even the final check called the contract complete, because a
        // formatted "0.00 €" is not a blank placeholder. Refuse it here instead.
        const salary = row.baseSalaryMonthly.trim();
        if (!salary || Number(salary.replace(",", ".")) <= 0) {
          failedKeys.add(row.rowKey);
          nextErrors[row.rowKey] = "Shkruani pagën bruto mujore.";
          continue;
        }

        const res = await createEmployeeAction({
          ...SETUP_EMPLOYEE_ROW_CONSTANTS,
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          personalId: row.personalId.trim(),
          jobTitleId: row.jobTitleId,
          departmentId: row.departmentId || null,
          hireDate: row.hireDate,
          baseSalaryMonthly: salary,
        });

        if (res.ok && res.data) {
          created.push({
            id: res.data.id,
            fullName: `${row.firstName} ${row.lastName}`.trim(),
            jobTitle: activeTitles.find((j) => j.id === row.jobTitleId)?.title ?? null,
          });
        } else if (!res.ok) {
          failedKeys.add(row.rowKey);
          const firstFieldError = res.fieldErrors
            ? Object.values(res.fieldErrors).flat()[0]
            : undefined;
          nextErrors[row.rowKey] = firstFieldError ?? res.error;
        }
      }

      // Saved rows leave the grid; failures stay put, still editable.
      setRows((prev) => {
        const kept = prev.filter((r) => failedKeys.has(r.rowKey) || !isStarted(r));
        return kept.length > 0 ? kept : [blankRow(defaultTitleId, todayIso())];
      });
      setRowErrors(nextErrors);
      setSavedCount((n) => n + created.length);

      if (created.length > 0) {
        props.onCreated(created);
        toast.success(
          created.length === 1 ? "1 punonjës u shtua." : `${created.length} punonjës u shtuan.`,
        );
      }
      if (failedKeys.size > 0) {
        toast.warning(
          `${failedKeys.size} rresht(a) nuk u ruajtën — shikoni arsyen te secili rresht.`,
          { duration: 9000 },
        );
      }
    } finally {
      setSaving(false);
    }
  }

  const disabled = props.disabled || saving;

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-muted-foreground">
        Shkruani rresht pas rreshti. Rreshtat bosh nuk ruhen.
      </p>

      {savedCount > 0 ? (
        <p className="text-[12.5px] font-medium text-[#15803d]">
          {savedCount} punonjës të ruajtur deri tani.
        </p>
      ) : null}

      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div key={row.rowKey} className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_130px_1fr_130px_120px_36px] md:items-center">
              <Input
                placeholder="Emri"
                value={row.firstName}
                disabled={disabled}
                onChange={(e) => patch(row.rowKey, "firstName", e.target.value)}
              />
              <Input
                placeholder="Mbiemri"
                value={row.lastName}
                disabled={disabled}
                onChange={(e) => patch(row.rowKey, "lastName", e.target.value)}
              />
              <Input
                placeholder="Nr. personal"
                inputMode="numeric"
                value={row.personalId}
                disabled={disabled}
                onChange={(e) => patch(row.rowKey, "personalId", e.target.value)}
              />
              <select
                className={SELECT_CLASS}
                value={row.jobTitleId}
                disabled={disabled}
                aria-label="Pozita"
                onChange={(e) => patch(row.rowKey, "jobTitleId", e.target.value)}
              >
                <option value="">Zgjidh pozitën…</option>
                {activeTitles.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
              <Input
                type="date"
                value={row.hireDate}
                disabled={disabled}
                aria-label="Data e punësimit"
                onChange={(e) => patch(row.rowKey, "hireDate", e.target.value)}
              />
              <Input
                placeholder="Paga bruto"
                inputMode="decimal"
                value={row.baseSalaryMonthly}
                disabled={disabled}
                onChange={(e) => patch(row.rowKey, "baseSalaryMonthly", e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Hiq rreshtin ${idx + 1}`}
                disabled={disabled || rows.length <= 1}
                onClick={() => removeRow(row.rowKey)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </div>

            {props.departments.length > 0 ? (
              <div className="mt-2 md:max-w-[280px]">
                <select
                  className={cn(SELECT_CLASS, "h-9")}
                  value={row.departmentId}
                  disabled={disabled}
                  aria-label="Departamenti"
                  onChange={(e) => patch(row.rowKey, "departmentId", e.target.value)}
                >
                  <option value="">Pa departament</option>
                  {props.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {rowErrors[row.rowKey] ? (
              <p className="mt-2 text-[11.5px] font-medium text-destructive" role="alert">
                Rreshti {idx + 1}: {rowErrors[row.rowKey]}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={addRow}>
          <Plus className="mr-1 h-4 w-4" aria-hidden />
          Shto rresht
        </Button>

        {/* The exact "go back and add a department" complaint — solved in place. */}
        {deptOpen ? (
          <span className="flex items-center gap-2">
            <Input
              placeholder="Emri i departamentit"
              value={newDept}
              disabled={disabled}
              className="h-8 w-[190px]"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void createDepartment();
                }
              }}
              onChange={(e) => setNewDept(e.target.value)}
            />
            <Button type="button" size="sm" disabled={disabled || !newDept.trim()} onClick={() => void createDepartment()}>
              Ruaj
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setDeptOpen(false)}>
              Anulo
            </Button>
          </span>
        ) : (
          <Button type="button" variant="link" size="sm" disabled={disabled} onClick={() => setDeptOpen(true)}>
            + Shto departament
          </Button>
        )}

        <span className="flex-1" />

        <Button type="button" disabled={disabled} onClick={() => void saveRows()}>
          {saving ? "Duke ruajtur…" : "Ruaj punonjësit"}
        </Button>
      </div>
    </div>
  );
}

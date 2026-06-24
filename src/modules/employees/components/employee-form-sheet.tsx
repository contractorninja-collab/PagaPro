"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FormField, FormStack } from "@/components/patterns/form-stack";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  createEmployeeAction,
  updateEmployeeAction,
  type EmployeeActionResult,
} from "@/modules/employees/actions/employee-actions";
import type { EmployeeDetailDto } from "@/modules/employees/types";
import type { DepartmentOptionDto } from "@/modules/employees/types";
import {
  GENDER_LABELS,
  WORK_ARRANGEMENT_LABELS,
  isoDateInput,
} from "@/modules/employees/components/employees-labels";

const fieldGrid = "grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start";

export type EmployeeFormMode = "create" | "edit";

export interface EmployeeFormValues {
  firstName: string;
  lastName: string;
  personalId: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  addressLine: string;
  addressCity: string;
  addressCountry: string;
  departmentId: string;
  jobTitle: string;
  hireDate: string;
  status: "ACTIVE" | "INACTIVE" | "ON_LEAVE" | "SUSPENDED";
  employmentType: "EMPLOYEE" | "CONTRACTOR";
  workArrangement: "ON_SITE" | "REMOTE" | "HYBRID";
  baseSalaryMonthly: string;
  weeklyHours: string;
  bankName: string;
  bankAccountIban: string;
  applyTrust: boolean;
  applyTax: boolean;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  internalNotes: string;
  documentsMissing: boolean;
}

function defaults(): EmployeeFormValues {
  return {
    firstName: "",
    lastName: "",
    personalId: "",
    dateOfBirth: "",
    gender: "",
    phone: "",
    email: "",
    addressLine: "",
    addressCity: "",
    addressCountry: "XK",
    departmentId: "",
    jobTitle: "",
    hireDate: new Date().toISOString().slice(0, 10),
    status: "ACTIVE",
    employmentType: "EMPLOYEE",
    workArrangement: "ON_SITE",
    baseSalaryMonthly: "",
    weeklyHours: "40",
    bankName: "",
    bankAccountIban: "",
    applyTrust: true,
    applyTax: true,
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: "",
    internalNotes: "",
    documentsMissing: false,
  };
}

function fromDetail(e: EmployeeDetailDto): EmployeeFormValues {
  const ec = e.emergencyContact;
  return {
    firstName: e.firstName,
    lastName: e.lastName,
    personalId: e.personalId,
    dateOfBirth: isoDateInput(e.dateOfBirth),
    gender: e.gender ?? "",
    phone: e.phone ?? "",
    email: e.email ?? "",
    addressLine: e.addressLine ?? "",
    addressCity: e.addressCity ?? "",
    addressCountry: e.addressCountry ?? "XK",
    departmentId: e.departmentId ?? "",
    jobTitle: e.jobTitle ?? "",
    hireDate: isoDateInput(e.hireDate),
    status:
      e.status === "TERMINATED"
        ? "ACTIVE"
        : (e.status as "ACTIVE" | "INACTIVE" | "ON_LEAVE" | "SUSPENDED"),
    employmentType: e.employmentType,
    workArrangement: e.workArrangement,
    baseSalaryMonthly: e.baseSalaryMonthly,
    weeklyHours: e.weeklyHours,
    bankName: e.bankName ?? "",
    bankAccountIban: e.bankAccountIban ?? "",
    applyTrust: e.applyTrust,
    applyTax: e.applyTax,
    emergencyContactName: ec?.fullName ?? "",
    emergencyContactPhone: ec?.phone ?? "",
    emergencyContactRelationship: ec?.relationship ?? "",
    internalNotes: e.internalNotes ?? "",
    documentsMissing: e.documentsMissing,
  };
}

function flattenErrors(raw?: Record<string, string[]>): Record<string, string> {
  if (!raw) return {};
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const m = v[0];
    if (m) o[k] = m;
  }
  return o;
}

function payloadFromValues(v: EmployeeFormValues): Record<string, unknown> {
  return {
    firstName: v.firstName,
    lastName: v.lastName,
    personalId: v.personalId,
    dateOfBirth: v.dateOfBirth || null,
    gender: v.gender || null,
    phone: v.phone || null,
    email: v.email || null,
    addressLine: v.addressLine || null,
    addressCity: v.addressCity || null,
    addressCountry: v.addressCountry || null,
    departmentId: v.departmentId || null,
    jobTitle: v.jobTitle || null,
    hireDate: v.hireDate,
    status: v.status,
    employmentType: v.employmentType,
    workArrangement: v.workArrangement,
    baseSalaryMonthly: v.baseSalaryMonthly === "" ? 0 : Number(v.baseSalaryMonthly.replace(",", ".")),
    weeklyHours: v.weeklyHours === "" ? 40 : Number(v.weeklyHours.replace(",", ".")),
    bankName: v.bankName || null,
    bankAccountIban: v.bankAccountIban || null,
    applyTrust: v.applyTrust,
    applyTax: v.applyTax,
    emergencyContactName: v.emergencyContactName,
    emergencyContactPhone: v.emergencyContactPhone,
    emergencyContactRelationship: v.emergencyContactRelationship,
    internalNotes: v.internalNotes || null,
    documentsMissing: v.documentsMissing,
  };
}

export function EmployeeFormSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: EmployeeFormMode;
  employeeId?: string;
  initialDetail?: EmployeeDetailDto | null;
  departments: DepartmentOptionDto[];
  onSuccess?: () => void;
}) {
  const { open, onOpenChange, mode, employeeId, initialDetail, departments, onSuccess } = props;
  const [pending, setPending] = useState(false);
  const [values, setValues] = useState<EmployeeFormValues>(defaults);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setFieldErrors({});
    if (mode === "edit" && initialDetail) {
      setValues(fromDetail(initialDetail));
    } else {
      setValues(defaults());
    }
  }, [open, mode, initialDetail]);

  const contractorLocks = values.employmentType === "CONTRACTOR";

  useEffect(() => {
    if (!contractorLocks) return;
    setValues((prev) => ({ ...prev, applyTrust: false, applyTax: false }));
  }, [contractorLocks]);

  const clearKey = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const n = { ...prev };
      delete n[key];
      return n;
    });
  };

  const handleResult = (result: EmployeeActionResult<{ id: string } | undefined>) => {
    if (!result.ok) {
      const flat = flattenErrors(result.fieldErrors);
      setFieldErrors(flat);
      const first = Object.values(flat)[0];
      toast.error(first ?? result.error);
      return false;
    }
    toast.success(mode === "create" ? "Punonjësi u krijua." : "Ndryshimet u ruajtën.");
    onOpenChange(false);
    onSuccess?.();
    return true;
  };

  const submit = async () => {
    setPending(true);
    setFieldErrors({});
    try {
      const payload = payloadFromValues(values);
      if (mode === "create") {
        const res = await createEmployeeAction(payload);
        handleResult(res);
      } else if (employeeId) {
        const res = await updateEmployeeAction({ employeeId, payload });
        handleResult(res);
      } else {
        toast.error("Mungon ID e punonjësit — mbyllni formularin dhe hapeni përsëri nga lista ose profili.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[EmployeeFormSheet] submit failed:", err);
      toast.error(
        msg.length > 0
          ? `Ruajtja dështoi: ${msg}`
          : "Ruajtja dështoi për një gabim rrjeti ose serveri. Provoni përsëri.",
      );
    } finally {
      setPending(false);
    }
  };

  const departmentOptions = useMemo(
    () =>
      departments.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      )),
    [departments],
  );

  const errClass = (key: string) =>
    cn(fieldErrors[key] && "border-destructive ring-1 ring-destructive/35");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{mode === "create" ? "Shto punonjës" : "Ndrysho punonjës"}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-8 px-6 pb-24 pt-4">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Të dhënat personale</h3>
            <div className={fieldGrid}>
              <FormField label="Emri" required error={fieldErrors.firstName}>
                <Input
                  className={errClass("firstName")}
                  aria-invalid={Boolean(fieldErrors.firstName) || undefined}
                  value={values.firstName}
                  onChange={(e) => {
                    clearKey("firstName");
                    setValues((s) => ({ ...s, firstName: e.target.value }));
                  }}
                  disabled={pending}
                />
              </FormField>
              <FormField label="Mbiemri" required error={fieldErrors.lastName}>
                <Input
                  className={errClass("lastName")}
                  aria-invalid={Boolean(fieldErrors.lastName) || undefined}
                  value={values.lastName}
                  onChange={(e) => {
                    clearKey("lastName");
                    setValues((s) => ({ ...s, lastName: e.target.value }));
                  }}
                  disabled={pending}
                />
              </FormField>
              <FormField label="Numri personal" required error={fieldErrors.personalId}>
                <Input
                  className={errClass("personalId")}
                  aria-invalid={Boolean(fieldErrors.personalId) || undefined}
                  value={values.personalId}
                  onChange={(e) => {
                    clearKey("personalId");
                    setValues((s) => ({ ...s, personalId: e.target.value }));
                  }}
                  disabled={pending}
                />
              </FormField>
              <FormField label="Data e lindjes" error={fieldErrors.dateOfBirth}>
                <Input
                  type="date"
                  className={errClass("dateOfBirth")}
                  value={values.dateOfBirth}
                  onChange={(e) => {
                    clearKey("dateOfBirth");
                    setValues((s) => ({ ...s, dateOfBirth: e.target.value }));
                  }}
                  disabled={pending}
                />
              </FormField>
              <FormField label="Gjinia" error={fieldErrors.gender}>
                <select
                  className={cn(
                    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    errClass("gender"),
                  )}
                  value={values.gender}
                  onChange={(e) => {
                    clearKey("gender");
                    setValues((s) => ({ ...s, gender: e.target.value }));
                  }}
                  disabled={pending}
                >
                  <option value="">—</option>
                  {Object.entries(GENDER_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Telefoni" error={fieldErrors.phone}>
                <Input
                  className={errClass("phone")}
                  value={values.phone}
                  onChange={(e) => {
                    clearKey("phone");
                    setValues((s) => ({ ...s, phone: e.target.value }));
                  }}
                  disabled={pending}
                />
              </FormField>
              <FormField label="Email" error={fieldErrors.email}>
                <Input
                  type="email"
                  className={errClass("email")}
                  value={values.email}
                  onChange={(e) => {
                    clearKey("email");
                    setValues((s) => ({ ...s, email: e.target.value }));
                  }}
                  disabled={pending}
                />
              </FormField>
              <FormField label="Adresa" className="md:col-span-2" error={fieldErrors.addressLine}>
                <Input
                  className={errClass("addressLine")}
                  value={values.addressLine}
                  onChange={(e) => {
                    clearKey("addressLine");
                    setValues((s) => ({ ...s, addressLine: e.target.value }));
                  }}
                  disabled={pending}
                />
              </FormField>
              <FormField label="Qyteti" error={fieldErrors.addressCity}>
                <Input
                  className={errClass("addressCity")}
                  value={values.addressCity}
                  onChange={(e) => {
                    clearKey("addressCity");
                    setValues((s) => ({ ...s, addressCity: e.target.value }));
                  }}
                  disabled={pending}
                />
              </FormField>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Punësimi</h3>
            <div className={fieldGrid}>
              <FormField label="Pozita" error={fieldErrors.jobTitle}>
                <Input
                  className={errClass("jobTitle")}
                  value={values.jobTitle}
                  onChange={(e) => {
                    clearKey("jobTitle");
                    setValues((s) => ({ ...s, jobTitle: e.target.value }));
                  }}
                  disabled={pending}
                />
              </FormField>
              <FormField label="Departamenti" error={fieldErrors.departmentId}>
                <select
                  className={cn(
                    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    errClass("departmentId"),
                  )}
                  value={values.departmentId}
                  onChange={(e) => {
                    clearKey("departmentId");
                    setValues((s) => ({ ...s, departmentId: e.target.value }));
                  }}
                  disabled={pending}
                >
                  <option value="">Pa departamenti</option>
                  {departmentOptions}
                </select>
              </FormField>
              <FormField label="Data e punësimit" required error={fieldErrors.hireDate}>
                <Input
                  type="date"
                  className={errClass("hireDate")}
                  value={values.hireDate}
                  onChange={(e) => {
                    clearKey("hireDate");
                    setValues((s) => ({ ...s, hireDate: e.target.value }));
                  }}
                  disabled={pending}
                />
              </FormField>
              <FormField label="Statusi" error={fieldErrors.status}>
                <select
                  className={cn(
                    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                    errClass("status"),
                  )}
                  value={values.status}
                  onChange={(e) => {
                    clearKey("status");
                    setValues((s) => ({
                      ...s,
                      status: e.target.value as EmployeeFormValues["status"],
                    }));
                  }}
                  disabled={pending}
                >
                  <option value="ACTIVE">Aktiv</option>
                  <option value="INACTIVE">Jo aktiv</option>
                  <option value="ON_LEAVE">Në pushim</option>
                  <option value="SUSPENDED">Pezulluar</option>
                </select>
              </FormField>
              <FormField label="Lloji i punonjësit" error={fieldErrors.employmentType}>
                <select
                  className={cn(
                    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                    errClass("employmentType"),
                  )}
                  value={values.employmentType}
                  onChange={(e) => {
                    clearKey("employmentType");
                    setValues((s) => ({
                      ...s,
                      employmentType: e.target.value as EmployeeFormValues["employmentType"],
                    }));
                  }}
                  disabled={pending}
                >
                  <option value="EMPLOYEE">Punonjës</option>
                  <option value="CONTRACTOR">Kontraktor</option>
                </select>
              </FormField>
              <FormField label="Lloji i punës" error={fieldErrors.workArrangement}>
                <select
                  className={cn(
                    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                    errClass("workArrangement"),
                  )}
                  value={values.workArrangement}
                  onChange={(e) => {
                    clearKey("workArrangement");
                    setValues((s) => ({
                      ...s,
                      workArrangement: e.target.value as EmployeeFormValues["workArrangement"],
                    }));
                  }}
                  disabled={pending}
                >
                  {Object.entries(WORK_ARRANGEMENT_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Pagat & banka</h3>
            <div className={fieldGrid}>
              <FormField label="Paga bruto (€)" required error={fieldErrors.baseSalaryMonthly}>
                <Input
                  className={cn("tabular-nums", errClass("baseSalaryMonthly"))}
                  inputMode="decimal"
                  value={values.baseSalaryMonthly}
                  onChange={(e) => {
                    clearKey("baseSalaryMonthly");
                    setValues((s) => ({ ...s, baseSalaryMonthly: e.target.value }));
                  }}
                  disabled={pending}
                />
              </FormField>
              <FormField label="Orët javore" required error={fieldErrors.weeklyHours}>
                <Input
                  className={cn("tabular-nums", errClass("weeklyHours"))}
                  inputMode="decimal"
                  value={values.weeklyHours}
                  onChange={(e) => {
                    clearKey("weeklyHours");
                    setValues((s) => ({ ...s, weeklyHours: e.target.value }));
                  }}
                  disabled={pending}
                />
              </FormField>
              <FormField label="Banka" error={fieldErrors.bankName}>
                <Input
                  className={errClass("bankName")}
                  value={values.bankName}
                  onChange={(e) => {
                    clearKey("bankName");
                    setValues((s) => ({ ...s, bankName: e.target.value }));
                  }}
                  disabled={pending}
                />
              </FormField>
              <FormField label="IBAN" error={fieldErrors.bankAccountIban}>
                <Input
                  className={cn("font-mono text-xs", errClass("bankAccountIban"))}
                  value={values.bankAccountIban}
                  onChange={(e) => {
                    clearKey("bankAccountIban");
                    setValues((s) => ({ ...s, bankAccountIban: e.target.value }));
                  }}
                  disabled={pending}
                />
              </FormField>
              <div className="flex flex-col gap-4 rounded-md border border-border bg-muted/30 p-4 md:col-span-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label>Apliko Trustin</Label>
                    <p className="text-xs text-muted-foreground">Kontraktorët: gjithmonë jo.</p>
                  </div>
                  <Switch
                    checked={values.applyTrust}
                    disabled={pending || contractorLocks}
                    onCheckedChange={(v) => setValues((s) => ({ ...s, applyTrust: v }))}
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label>Apliko tatimin</Label>
                    <p className="text-xs text-muted-foreground">Kontraktorët: gjithmonë jo.</p>
                  </div>
                  <Switch
                    checked={values.applyTax}
                    disabled={pending || contractorLocks}
                    onCheckedChange={(v) => setValues((s) => ({ ...s, applyTax: v }))}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Kontakti emergjent</h3>
            <div className={fieldGrid}>
              <FormField label="Emri" required error={fieldErrors.emergencyContactName}>
                <Input
                  className={errClass("emergencyContactName")}
                  value={values.emergencyContactName}
                  onChange={(e) => {
                    clearKey("emergencyContactName");
                    setValues((s) => ({ ...s, emergencyContactName: e.target.value }));
                  }}
                  disabled={pending}
                />
              </FormField>
              <FormField label="Telefoni" required error={fieldErrors.emergencyContactPhone}>
                <Input
                  className={errClass("emergencyContactPhone")}
                  value={values.emergencyContactPhone}
                  onChange={(e) => {
                    clearKey("emergencyContactPhone");
                    setValues((s) => ({ ...s, emergencyContactPhone: e.target.value }));
                  }}
                  disabled={pending}
                />
              </FormField>
              <FormField
                label="Raporti familjar"
                required
                error={fieldErrors.emergencyContactRelationship}
                className="md:col-span-2"
              >
                <Input
                  className={errClass("emergencyContactRelationship")}
                  value={values.emergencyContactRelationship}
                  onChange={(e) => {
                    clearKey("emergencyContactRelationship");
                    setValues((s) => ({ ...s, emergencyContactRelationship: e.target.value }));
                  }}
                  disabled={pending}
                />
              </FormField>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Shtesë</h3>
            <FormStack className="max-w-none gap-4">
              <FormField label="Shënime të brendshme" error={fieldErrors.internalNotes}>
                <textarea
                  className={cn(
                    "min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                    errClass("internalNotes"),
                  )}
                  value={values.internalNotes}
                  onChange={(e) => {
                    clearKey("internalNotes");
                    setValues((s) => ({ ...s, internalNotes: e.target.value }));
                  }}
                  disabled={pending}
                />
              </FormField>
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-4 py-3">
                <div className="space-y-1">
                  <Label>Dokumente mungojnë</Label>
                  <p className="text-xs text-muted-foreground">Për gjurmueshmëri HR — jo payroll.</p>
                </div>
                <Switch
                  checked={values.documentsMissing}
                  disabled={pending}
                  onCheckedChange={(v) => setValues((s) => ({ ...s, documentsMissing: v }))}
                />
              </div>
            </FormStack>
          </section>

          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-background pt-4">
            <Button type="button" variant="secondary" disabled={pending} onClick={() => onOpenChange(false)}>
              Anulo
            </Button>
            <Button type="button" disabled={pending} onClick={() => void submit()}>
              {pending ? "Duke ruajtur…" : mode === "create" ? "Krijo punonjës" : "Ruaj ndryshimet"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

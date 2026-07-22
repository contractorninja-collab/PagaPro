"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FormField, FormStack } from "@/components/patterns/form-stack";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { createDepartmentAction } from "@/modules/departments/actions/department-actions";
import type { DepartmentOptionDto, EmployeeDetailDto, JobTitleOptionDto } from "@/modules/employees/types";
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
  jobTitleId: string;
  jobTitle: string;
  probationMonths: string;
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
  isForeignNational: boolean;
  residencePermitExpiryDate: string;
  workplace: string;
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
    jobTitleId: "",
    jobTitle: "",
    probationMonths: "",
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
    isForeignNational: false,
    residencePermitExpiryDate: "",
    workplace: "",
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
    jobTitleId: e.jobTitleId ?? "",
    jobTitle: e.jobTitle ?? "",
    probationMonths: e.probationMonths == null ? "" : String(e.probationMonths),
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
    isForeignNational: e.isForeignNational,
    residencePermitExpiryDate: isoDateInput(e.residencePermitExpiryDate),
    workplace: e.workplace ?? "",
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
    jobTitleId: v.jobTitleId,
    jobTitle: v.jobTitle,
    probationMonths: v.probationMonths === "" ? null : Number(v.probationMonths),
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
    isForeignNational: v.isForeignNational,
    residencePermitExpiryDate: v.residencePermitExpiryDate || null,
    workplace: v.workplace,
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
  jobTitles: JobTitleOptionDto[];
  onSuccess?: () => void;
}) {
  const { open, onOpenChange, mode, employeeId, initialDetail, departments, jobTitles, onSuccess } = props;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [values, setValues] = useState<EmployeeFormValues>(defaults);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentOptionDto[]>(departments);
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [deptCreatePending, setDeptCreatePending] = useState(false);

  useEffect(() => {
    setDepartmentOptions(departments);
  }, [departments]);

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

  const departmentSelectOptions = useMemo(
    () =>
      departmentOptions.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      )),
    [departmentOptions],
  );

  const selectedJobTitle = useMemo(
    () => jobTitles.find((jobTitle) => jobTitle.id === values.jobTitleId) ?? null,
    [jobTitles, values.jobTitleId],
  );

  const jobTitleSelectOptions = useMemo(() => {
    const options = [...jobTitles];
    if (
      mode === "edit" &&
      initialDetail?.jobTitleId &&
      !options.some((jobTitle) => jobTitle.id === initialDetail.jobTitleId)
    ) {
      options.push({
        id: initialDetail.jobTitleId,
        title: initialDetail.jobTitle ?? "Pozitë e arkivuar",
        department: initialDetail.departmentName,
        level: null,
        description: initialDetail.jobDescription ?? "",
        responsibilities: initialDetail.jobResponsibilities,
        requirements: initialDetail.jobRequirements,
        status: initialDetail.jobTitleStatus ?? "ARCHIVED",
      });
    }
    return options.map((jobTitle) => (
      <option key={jobTitle.id} value={jobTitle.id} disabled={jobTitle.status !== "ACTIVE"}>
        {jobTitle.title}
        {jobTitle.department ? ` - ${jobTitle.department}` : ""}
        {jobTitle.level ? ` (${jobTitle.level})` : ""}
        {jobTitle.status !== "ACTIVE" ? " - arkivuar" : ""}
      </option>
    ));
  }, [initialDetail, jobTitles, mode]);

  const handleQuickCreateDepartment = async () => {
    const name = newDepartmentName.trim();
    if (!name) {
      toast.error("Shkruani emrin e departamentit.");
      return;
    }
    setDeptCreatePending(true);
    try {
      const res = await createDepartmentAction({ name });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDepartmentOptions((prev) => {
        const next = [...prev, { id: res.id, name: res.name }].sort((a, b) =>
          a.name.localeCompare(b.name, "sq"),
        );
        return next;
      });
      setValues((s) => ({ ...s, departmentId: res.id }));
      clearKey("departmentId");
      setNewDepartmentName("");
      setDeptDialogOpen(false);
      toast.success(`Departamenti «${res.name}» u krijua dhe u zgjodh.`);
      router.refresh();
    } finally {
      setDeptCreatePending(false);
    }
  };

  const errClass = (key: string) =>
    cn(fieldErrors[key] && "border-destructive ring-1 ring-destructive/35");

  return (
    <>
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
              <FormField label="Pozita" required error={fieldErrors.jobTitleId}>
                <select
                  className={cn(
                    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    errClass("jobTitleId"),
                  )}
                  value={values.jobTitleId}
                  onChange={(e) => {
                    clearKey("jobTitleId");
                    const jobTitle = jobTitles.find((item) => item.id === e.target.value);
                    setValues((s) => ({
                      ...s,
                      jobTitleId: e.target.value,
                      jobTitle: jobTitle?.title ?? s.jobTitle,
                    }));
                  }}
                  disabled={pending || jobTitles.length === 0}
                >
                  <option value="">Zgjidh pozitën</option>
                  {jobTitleSelectOptions}
                </select>
                {jobTitles.length === 0 ? (
                  <p className="mt-2 text-xs text-destructive">
                    Së pari krijoni pozita te Konfigurimet &gt; Pozitat.
                  </p>
                ) : selectedJobTitle ? (
                  <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                    {selectedJobTitle.description}
                  </p>
                ) : null}
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
                  {departmentSelectOptions}
                </select>
                <div className="mt-2 flex flex-col gap-1">
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto justify-start px-0 text-xs"
                    disabled={pending || deptCreatePending}
                    onClick={() => setDeptDialogOpen(true)}
                  >
                    + Shto departament
                  </Button>
                  {departmentOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nuk ka departamente — krijoni një këtu ose te{" "}
                      <Link href="/konfigurime?tab=departamentet" className="text-primary underline-offset-4 hover:underline">
                        Konfigurimet
                      </Link>
                      .
                    </p>
                  ) : null}
                </div>
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
              <FormField label="Muaj pune praktike" error={fieldErrors.probationMonths}>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  className={cn("tabular-nums", errClass("probationMonths"))}
                  value={values.probationMonths}
                  onChange={(e) => {
                    clearKey("probationMonths");
                    setValues((s) => ({ ...s, probationMonths: e.target.value }));
                  }}
                  disabled={pending}
                  placeholder="p.sh. 3"
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
              <FormField label="Vendi i punës" error={fieldErrors.workplace}>
                <Input
                  className={errClass("workplace")}
                  value={values.workplace}
                  placeholder="Bosh = selia e kompanisë"
                  onChange={(e) => {
                    clearKey("workplace");
                    setValues((s) => ({ ...s, workplace: e.target.value }));
                  }}
                  disabled={pending}
                />
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
              <FormField label="Numri i llogarisë" error={fieldErrors.bankAccountIban}>
                <Input
                  className={cn("font-mono text-xs", errClass("bankAccountIban"))}
                  value={values.bankAccountIban}
                  placeholder="p.sh. 1234567890123456"
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
                    <Label>Shtetas i huaj</Label>
                    <p className="text-xs text-muted-foreground">
                      Me leje qëndrimi të përkohshëm — i përjashtuar nga Trusti; tatimi aplikohet
                      (Ligji 04/L-101).
                    </p>
                  </div>
                  <Switch
                    checked={values.isForeignNational}
                    disabled={pending}
                    onCheckedChange={(v) =>
                      // One-shot: enabling the flag switches Trust off, but HR may
                      // re-enable it afterwards (voluntary contributions are legal).
                      setValues((s) => ({
                        ...s,
                        isForeignNational: v,
                        applyTrust: v ? false : s.applyTrust,
                      }))
                    }
                  />
                </div>
                {values.isForeignNational ? (
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="residence-permit-expiry">Skadimi i lejes së qëndrimit</Label>
                      <p className="text-xs text-muted-foreground">
                        Paneli ju njofton para skadimit.
                      </p>
                    </div>
                    <Input
                      id="residence-permit-expiry"
                      type="date"
                      className="w-44"
                      value={values.residencePermitExpiryDate}
                      onChange={(e) =>
                        setValues((s) => ({ ...s, residencePermitExpiryDate: e.target.value }))
                      }
                      disabled={pending}
                    />
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label>Apliko Trustin</Label>
                    <p className="text-xs text-muted-foreground">
                      Kontraktorët: gjithmonë jo. Shtetasit e huaj: jo, përveç kontributit vullnetar.
                    </p>
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
              <FormField label="Emri" error={fieldErrors.emergencyContactName}>
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
              <FormField label="Telefoni" error={fieldErrors.emergencyContactPhone}>
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
              <div id="documents-missing-flag" className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-4 py-3">
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

    <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Shto departament</DialogTitle>
          <DialogDescription>
            Departamenti do të jetë i disponueshëm për të gjithë punonjësit e kompanisë.
          </DialogDescription>
        </DialogHeader>
        <FormField label="Emri i departamentit">
          <Input
            value={newDepartmentName}
            onChange={(e) => setNewDepartmentName(e.target.value)}
            placeholder="p.sh. Financa"
            disabled={deptCreatePending}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleQuickCreateDepartment();
              }
            }}
          />
        </FormField>
        <DialogFooter>
          <Button type="button" variant="secondary" disabled={deptCreatePending} onClick={() => setDeptDialogOpen(false)}>
            Anulo
          </Button>
          <Button type="button" disabled={deptCreatePending} onClick={() => void handleQuickCreateDepartment()}>
            {deptCreatePending ? "Duke ruajtur…" : "Krijo departament"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

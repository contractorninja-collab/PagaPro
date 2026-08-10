"use client";

import { ImagePlus, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AppSubBar } from "@/components/layout/app-sub-bar";
import { FormField, FormStack } from "@/components/patterns/form-stack";
import { HolidaySettingsPanel } from "@/components/konfigurime/holiday-settings-panel";
import { LeaveMonthlyAccrualPanel } from "@/components/konfigurime/leave-monthly-accrual-panel";
import { KonfigurimePageSkeleton } from "@/components/konfigurime/konfigurime-skeleton";
import { DepartmentsSettingsPanel } from "@/modules/departments/components/departments-settings-panel";
import { JobTitlesSettingsPanel } from "@/modules/job-titles/components/job-titles-settings-panel";
import type { KonfigurimeTabId } from "@/components/konfigurime/konfigurime-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, randomClientId } from "@/lib/utils";
import { useKonfigurimeSave } from "@/modules/konfigurime/hooks/use-konfigurime-save";
import { setLeaveTenureBonusAction } from "@/modules/konfigurime/actions/leave-policy-actions";
import type { KonfigurimePageDto, KonfigurimeRepresentativeDto } from "@/modules/konfigurime/services/konfigurime-service";

const fieldGrid = "grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start";

type RepDraft = KonfigurimeRepresentativeDto & { rowKey: string };

function assignRepresentativeRowKeys(list: KonfigurimeRepresentativeDto[]): RepDraft[] {
  return list.map((r) => ({ ...r, rowKey: r.id ?? randomClientId() }));
}

function flattenKonfigurimeFieldErrors(raw?: Record<string, string[]>): Record<string, string> {
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const [k, messages] of Object.entries(raw)) {
    const msg = messages[0];
    if (msg) out[k] = msg;
  }
  return out;
}

function tabForKonfigurimePath(path: string): KonfigurimeTabId {
  if (path === "representatives" || path.startsWith("representatives.")) return "autorizuari";
  if (path === "company" || path.startsWith("company.")) return "kompania";
  if (path.startsWith("configuration.")) {
    const tail = path.slice("configuration.".length);
    if (
      tail.startsWith("minimumSalary") ||
      tail.startsWith("trustContribution") ||
      tail.startsWith("standardWeekly")
    ) {
      return "pagat";
    }
    if (
      tail.startsWith("contractReference") ||
      tail.startsWith("payrollPdf") ||
      tail.startsWith("generalDocument")
    ) {
      return "dokumentet";
    }
    if (
      tail.startsWith("annualLeave") ||
      tail.startsWith("personalLeave") ||
      tail.startsWith("medicalLeave")
    ) {
      return "pushimet";
    }
    if (tail.startsWith("notify")) return "njoftimet";
  }
  return "kompania";
}

function parseOptionalNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function NotificationToggle({
  id,
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  title: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 space-y-1">
        <Label htmlFor={id} className="text-sm font-medium leading-snug text-foreground">
          {title}
        </Label>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className="shrink-0 sm:mt-0"
      />
    </div>
  );
}

export function KonfigurimeConfigurator({
  initial,
  className,
  initialTab = "kompania",
}: {
  initial: KonfigurimePageDto;
  className?: string;
  initialTab?: KonfigurimeTabId;
}) {
  const router = useRouter();
  const { pending, submit } = useKonfigurimeSave();
  const [mounted, setMounted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<KonfigurimeTabId>(initialTab);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldErrorsByPrefix = useCallback((prefix: string) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const k of Object.keys(next)) {
        if (k === prefix || k.startsWith(`${prefix}.`)) {
          delete next[k];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const clearFieldErrorKey = useCallback((key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const [company, setCompany] = useState(initial.company);
  const [cfg, setCfg] = useState(initial.configuration);
  const [reps, setReps] = useState<RepDraft[]>(() => assignRepresentativeRowKeys(initial.representatives));
  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null);
  const [companyLogoPreview, setCompanyLogoPreview] = useState<string | null>(null);
  const [removeCompanyLogo, setRemoveCompanyLogo] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setCompany(initial.company);
    setCfg(initial.configuration);
    setReps(assignRepresentativeRowKeys(initial.representatives));
    setCompanyLogoFile(null);
    setCompanyLogoPreview(null);
    setRemoveCompanyLogo(false);
    setFieldErrors({});
    setFormError(null);
  }, [initial]);

  useEffect(() => {
    if (!companyLogoFile) return;
    const url = URL.createObjectURL(companyLogoFile);
    setCompanyLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [companyLogoFile]);

  const fixPayloadRepresentativeKeys = () =>
    reps.map((r) => ({
      employeeId: r.employeeId ?? "",
      signatureStorageKey: r.signatureStorageKey ?? null,
      stampStorageKey: r.stampStorageKey ?? null,
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const payload = {
      companyLogoStorageKey: removeCompanyLogo ? null : initial.companyLogoStorageKey,
      company: {
        legalName: company.legalName,
        fiscalNumber: company.fiscalNumber,
        addressLine: company.addressLine,
        email: company.email,
        phone: company.phone,
        website: company.website,
      },
      representatives: fixPayloadRepresentativeKeys(),
      configuration: {
        minimumSalaryCurrent: parseOptionalNumber(cfg.minimumSalaryCurrent),
        minimumSalaryFromJuly1: parseOptionalNumber(cfg.minimumSalaryFromJuly1),
        trustContributionPercent: parseOptionalNumber(cfg.trustContributionPercent),
        standardWeeklyHours: parseOptionalNumber(cfg.standardWeeklyHours),
        contractReferencePrefix: cfg.contractReferencePrefix,
        payrollPdfPrefix: cfg.payrollPdfPrefix,
        generalDocumentPrefix: cfg.generalDocumentPrefix,
        annualLeaveDaysDefault: parseOptionalNumber(cfg.annualLeaveDaysDefault),
        personalLeaveDaysDefault: parseOptionalNumber(cfg.personalLeaveDaysDefault),
        medicalLeaveDaysDefault: parseOptionalNumber(cfg.medicalLeaveDaysDefault),
        workingDaysPerWeek: parseOptionalNumber(cfg.workingDaysPerWeek),
        annualLeaveAccrualMode: cfg.annualLeaveAccrualMode,
        annualLeaveRoundingMode: cfg.annualLeaveRoundingMode,
        allowNegativeAnnualLeaveBalance: cfg.allowNegativeAnnualLeaveBalance,
        medicalLeavePolicyNote: cfg.medicalLeavePolicyNote,
        notifyContractExpiring: cfg.notifyContractExpiring,
        notifyPayrollReminders: cfg.notifyPayrollReminders,
        notifyLeaveApprovals: cfg.notifyLeaveApprovals,
        notifyEmployeeWarnings: cfg.notifyEmployeeWarnings,
      },
    };

    const fd = new FormData();
    fd.append("payload", JSON.stringify(payload));
    if (companyLogoFile) fd.append("company_logo", companyLogoFile);
    fd.append("remove_company_logo", String(removeCompanyLogo));

    try {
      const result = await submit(fd);
      if (!result.ok) {
        setFormError(result.error);
        const flat = flattenKonfigurimeFieldErrors(result.fieldErrors);
        setFieldErrors(flat);
        const firstPath = Object.keys(flat)[0];
        if (firstPath) setActiveTab(tabForKonfigurimePath(firstPath));
        toast.error((firstPath && flat[firstPath]) || result.error);
        return;
      }
      toast.success("Konfigurimet u ruajtën me sukses.");
      setCompanyLogoFile(null);
      setCompanyLogoPreview(null);
      router.refresh();
    } catch {
      toast.error("Gabim papritur gjatë ruajtjes.");
      setFormError("Gabim papritur gjatë ruajtjes.");
    }
  };

  const patchRep = (rowKey: string, patch: Partial<KonfigurimeRepresentativeDto>) => {
    setReps((prev) => prev.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)));
  };

  const addRep = () => {
    clearFieldErrorKey("representatives");
    setReps((prev) => [
      ...prev,
      {
        rowKey: randomClientId(),
        employeeId: null,
        fullName: "",
        position: null,
        signatureStorageKey: null,
        stampStorageKey: null,
      },
    ]);
  };

  const removeRep = (idx: number) => {
    const victim = reps[idx];
    if (!victim || reps.length <= 1) return;
    clearFieldErrorsByPrefix("representatives");
    setReps((prev) => prev.filter((r) => r.rowKey !== victim.rowKey));
  };

  if (!mounted) {
    return <KonfigurimePageSkeleton />;
  }

  return (
    <>
      <AppSubBar
        eyebrow="Parametrat e kompanisë"
        title="Konfigurimet"
        description="Parametra të kompanisë, përfaqësuesi ligjor, pagat, festat publike, dokumentet, pushimet dhe njoftimet — të izoluara për kompaninë aktive."
        actions={
          <div className="flex flex-col items-end gap-2">
            <Button type="submit" form="konfigurime-form" className="hidden md:inline-flex" disabled={pending}>
              {pending ? "Duke ruajtur…" : "Ruaj ndryshimet"}
            </Button>
            {formError ? (
              <p className="max-w-xs text-right text-xs font-medium text-destructive" role="alert">
                {formError}
              </p>
            ) : null}
          </div>
        }
      />
      <form id="konfigurime-form" className={cn("space-y-8 pb-28 md:pb-8", className)} onSubmit={(e) => void handleSubmit(e)}>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as KonfigurimeTabId)} className="w-full">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 sm:h-10 sm:flex-nowrap">
            <TabsTrigger value="kompania">Kompania</TabsTrigger>
            <TabsTrigger value="autorizuari">Personi i autorizuar</TabsTrigger>
            <TabsTrigger value="departamentet">Departamentet</TabsTrigger>
            <TabsTrigger value="pozitat">Pozitat</TabsTrigger>
            <TabsTrigger value="pagat">Pagat</TabsTrigger>
            <TabsTrigger value="festat">Festat</TabsTrigger>
            <TabsTrigger value="dokumentet">Dokumentet</TabsTrigger>
            <TabsTrigger value="pushimet">Pushimet</TabsTrigger>
            <TabsTrigger value="njoftimet">Njoftimet</TabsTrigger>
          </TabsList>

          <TabsContent value="kompania">
            <Card>
              <CardHeader>
                <CardTitle>Të dhënat e kompanisë</CardTitle>
                <CardDescription>
                  Informacioni bazë që përdoret në kontrata, raporte dhe komunikime zyrtare.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className={fieldGrid}>
                  <FormField label="Emri i Kompanisë" required hint="Si në regjistrimin e biznesit." error={fieldErrors["company.legalName"]}>
                    <Input
                      id="company-name"
                      className={cn(fieldErrors["company.legalName"] && "border-destructive ring-1 ring-destructive/35")}
                      aria-invalid={Boolean(fieldErrors["company.legalName"]) || undefined}
                      value={company.legalName}
                      onChange={(e) => {
                        clearFieldErrorKey("company.legalName");
                        setCompany((c) => ({ ...c, legalName: e.target.value }));
                      }}
                      placeholder="Shoqëria Shembull Sh.p.k."
                      autoComplete="organization"
                      disabled={pending}
                    />
                  </FormField>
                  <FormField label="NUI" hint="Numri unik identifikues (fiskal)." error={fieldErrors["company.fiscalNumber"]}>
                    <Input
                      id="company-nui"
                      className={cn(fieldErrors["company.fiscalNumber"] && "border-destructive ring-1 ring-destructive/35")}
                      aria-invalid={Boolean(fieldErrors["company.fiscalNumber"]) || undefined}
                      value={company.fiscalNumber ?? ""}
                      onChange={(e) => {
                        clearFieldErrorKey("company.fiscalNumber");
                        setCompany((c) => ({ ...c, fiscalNumber: e.target.value || null }));
                      }}
                      placeholder="812345678"
                      disabled={pending}
                    />
                  </FormField>
                  <FormField label="Adresa" className="md:col-span-2" error={fieldErrors["company.addressLine"]}>
                    <Input
                      id="company-address"
                      className={cn(fieldErrors["company.addressLine"] && "border-destructive ring-1 ring-destructive/35")}
                      aria-invalid={Boolean(fieldErrors["company.addressLine"]) || undefined}
                      value={company.addressLine ?? ""}
                      onChange={(e) => {
                        clearFieldErrorKey("company.addressLine");
                        setCompany((c) => ({ ...c, addressLine: e.target.value || null }));
                      }}
                      placeholder="Rruga, numri, qyteti"
                      autoComplete="street-address"
                      disabled={pending}
                    />
                  </FormField>
                  <FormField label="Email" error={fieldErrors["company.email"]}>
                    <Input
                      id="company-email"
                      type="email"
                      className={cn(fieldErrors["company.email"] && "border-destructive ring-1 ring-destructive/35")}
                      aria-invalid={Boolean(fieldErrors["company.email"]) || undefined}
                      value={company.email ?? ""}
                      onChange={(e) => {
                        clearFieldErrorKey("company.email");
                        setCompany((c) => ({ ...c, email: e.target.value || null }));
                      }}
                      placeholder="info@kompania.com"
                      autoComplete="email"
                      disabled={pending}
                    />
                  </FormField>
                  <FormField label="Telefoni" error={fieldErrors["company.phone"]}>
                    <Input
                      id="company-phone"
                      type="tel"
                      className={cn(fieldErrors["company.phone"] && "border-destructive ring-1 ring-destructive/35")}
                      aria-invalid={Boolean(fieldErrors["company.phone"]) || undefined}
                      value={company.phone ?? ""}
                      onChange={(e) => {
                        clearFieldErrorKey("company.phone");
                        setCompany((c) => ({ ...c, phone: e.target.value || null }));
                      }}
                      placeholder="+383 44 000 000"
                      autoComplete="tel"
                      disabled={pending}
                    />
                  </FormField>
                  <FormField label="Website" className="md:col-span-2" error={fieldErrors["company.website"]}>
                    <Input
                      id="company-web"
                      type="text"
                      className={cn(fieldErrors["company.website"] && "border-destructive ring-1 ring-destructive/35")}
                      aria-invalid={Boolean(fieldErrors["company.website"]) || undefined}
                      value={company.website ?? ""}
                      onChange={(e) => {
                        clearFieldErrorKey("company.website");
                        setCompany((c) => ({ ...c, website: e.target.value || null }));
                      }}
                      placeholder="https://www.kompania.com"
                      autoComplete="url"
                      disabled={pending}
                    />
                  </FormField>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="autorizuari">
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Përfaqësuesit e autorizuar</CardTitle>
                  <CardDescription>Personat që nënshkruajnë dokumentet zyrtare dhe kontratat.</CardDescription>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={addRep} disabled={pending} className="shrink-0">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Shto përfaqësues
                </Button>
              </CardHeader>
              <CardContent className="space-y-10">
                {fieldErrors.representatives ? (
                  <p className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive" role="alert">
                    {fieldErrors.representatives}
                  </p>
                ) : null}
                {reps.map((rep, idx) => (
                  <div
                    key={rep.rowKey}
                    className="rounded-lg border border-border bg-muted/30 p-4 md:p-6"
                  >
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">Përfaqësuesi {idx + 1}</p>
                      {reps.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={pending}
                          onClick={() => removeRep(idx)}
                        >
                          Hiq
                        </Button>
                      ) : null}
                    </div>
                    {(() => {
                      const selectedEmployee =
                        initial.employees.find((emp) => emp.id === rep.employeeId) ?? null;
                      const linkedButInactive = Boolean(rep.employeeId) && !selectedEmployee;
                      const positionValue = selectedEmployee?.jobTitle ?? rep.position ?? "";
                      return (
                        <div className={fieldGrid}>
                          <FormField
                            label="Punonjësi"
                            required
                            hint="Përfaqësuesi zgjidhet nga punonjësit e regjistruar."
                            error={fieldErrors[`representatives.${idx}.employeeId`]}
                          >
                            <select
                              id={`rep-employee-${rep.rowKey}`}
                              className={cn(
                                "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                fieldErrors[`representatives.${idx}.employeeId`] && "border-destructive ring-1 ring-destructive/35",
                              )}
                              aria-invalid={Boolean(fieldErrors[`representatives.${idx}.employeeId`]) || undefined}
                              value={rep.employeeId ?? ""}
                              onChange={(e) => {
                                clearFieldErrorKey(`representatives.${idx}.employeeId`);
                                const emp = initial.employees.find((x) => x.id === e.target.value) ?? null;
                                patchRep(rep.rowKey, {
                                  employeeId: emp?.id ?? null,
                                  fullName: emp?.fullName ?? "",
                                  position: emp?.jobTitle ?? null,
                                });
                              }}
                              disabled={pending}
                            >
                              <option value="">Zgjidhni punonjësin</option>
                              {linkedButInactive ? (
                                <option value={rep.employeeId ?? ""}>
                                  {rep.fullName || "Punonjës joaktiv"} (joaktiv)
                                </option>
                              ) : null}
                              {initial.employees.map((emp) => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.fullName}
                                </option>
                              ))}
                            </select>
                            {initial.employees.length === 0 ? (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Nuk ka punonjës aktivë ende — shtojeni direkt me hapësirën më poshtë.
                              </p>
                            ) : null}
                            <Link
                              href="/punonjesit?shto=1"
                              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-4 hover:underline"
                            >
                              + Shto Punonjës
                            </Link>
                          </FormField>
                          <FormField label="Pozita" hint="Plotësohet automatikisht nga pozita e punonjësit.">
                            <Input
                              id={`rep-role-${rep.rowKey}`}
                              value={positionValue}
                              placeholder="—"
                              readOnly
                              disabled
                            />
                            {rep.employeeId && !positionValue ? (
                              <p className="mt-2 text-xs text-destructive">
                                Ky punonjës nuk ka pozitë. Vendosni pozitën te profili i punonjësit.
                              </p>
                            ) : null}
                            <Link
                              href="/konfigurime?tab=pozitat"
                              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-4 hover:underline"
                            >
                              + Shto Pozitë
                            </Link>
                          </FormField>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pagat">
            <Card>
              <CardHeader>
                <CardTitle>Paracaktimet e pagave</CardTitle>
                <CardDescription>
                  Vlerat ruhen në databazë dhe sinkronizohen me grupin aktiv të parametrave të pagës kur ekziston.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className={fieldGrid}>
                  <FormField label="Paga minimale aktuale" hint="Euro." error={fieldErrors["configuration.minimumSalaryCurrent"]}>
                    <div className="relative">
                      <Input
                        id="pay-min-current"
                        className={cn(
                          "pr-10 tabular-nums",
                          fieldErrors["configuration.minimumSalaryCurrent"] && "border-destructive ring-1 ring-destructive/35",
                        )}
                        aria-invalid={Boolean(fieldErrors["configuration.minimumSalaryCurrent"]) || undefined}
                        value={cfg.minimumSalaryCurrent ?? ""}
                        onChange={(e) => {
                          clearFieldErrorKey("configuration.minimumSalaryCurrent");
                          setCfg((c) => ({ ...c, minimumSalaryCurrent: e.target.value || null }));
                        }}
                        inputMode="decimal"
                        disabled={pending}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        €
                      </span>
                    </div>
                  </FormField>
                  {/* "Paga minimale nga 1 Korrik" u hoq nga UI (2026-08): €500 është
                      aktive që nga 1 korriku dhe jetohet te "Paga minimale aktuale".
                      Vlera e ruajtur në databazë vazhdon të dërgohet e paprekur. */}
                  <FormField
                    label="Përqindja e Trustit"
                    hint="E njëjta për punonjës dhe punëdhënës (% në bruto; p.sh. 5 për 5% secili)."
                    error={fieldErrors["configuration.trustContributionPercent"]}
                  >
                    <div className="relative">
                      <Input
                        id="trust-rate"
                        className={cn(
                          "pr-8 tabular-nums",
                          fieldErrors["configuration.trustContributionPercent"] && "border-destructive ring-1 ring-destructive/35",
                        )}
                        aria-invalid={Boolean(fieldErrors["configuration.trustContributionPercent"]) || undefined}
                        value={cfg.trustContributionPercent ?? ""}
                        onChange={(e) => {
                          clearFieldErrorKey("configuration.trustContributionPercent");
                          setCfg((c) => ({ ...c, trustContributionPercent: e.target.value || null }));
                        }}
                        inputMode="decimal"
                        disabled={pending}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        %
                      </span>
                    </div>
                  </FormField>
                  <FormField label="Orët standarde javore" error={fieldErrors["configuration.standardWeeklyHours"]}>
                    <Input
                      id="weekly-hours"
                      className={cn(
                        "tabular-nums",
                        fieldErrors["configuration.standardWeeklyHours"] && "border-destructive ring-1 ring-destructive/35",
                      )}
                      aria-invalid={Boolean(fieldErrors["configuration.standardWeeklyHours"]) || undefined}
                      value={cfg.standardWeeklyHours ?? ""}
                      onChange={(e) => {
                        clearFieldErrorKey("configuration.standardWeeklyHours");
                        setCfg((c) => ({ ...c, standardWeeklyHours: e.target.value || null }));
                      }}
                      inputMode="decimal"
                      disabled={pending}
                    />
                  </FormField>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="departamentet">
            <DepartmentsSettingsPanel initialDepartments={initial.departments} />
          </TabsContent>

          <TabsContent value="pozitat">
            <JobTitlesSettingsPanel initialJobTitles={initial.jobTitles} />
          </TabsContent>

          <TabsContent value="festat">
            <HolidaySettingsPanel
              defaultYear={initial.holidaySettings.defaultYear}
              initialHolidays={initial.holidaySettings.holidays}
            />
          </TabsContent>

          <TabsContent value="dokumentet">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Logoja e kompanisë</CardTitle>
                  <CardDescription>
                    Përdoret në dokumentet dhe raportet e reja. PNG, JPEG ose WebP, deri në 3 MB.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <div className="flex h-28 w-full max-w-56 items-center justify-center overflow-hidden rounded-md border border-border bg-white p-4">
                      {companyLogoPreview || (initial.companyLogoStorageKey && !removeCompanyLogo) ? (
                        <Image
                          src={companyLogoPreview ?? `/api/konfigurime/asset?key=${encodeURIComponent(initial.companyLogoStorageKey ?? "")}`}
                          alt="Logoja e kompanisë"
                          width={224}
                          height={112}
                          unoptimized
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">Nuk ka logo</span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outlinePrimary" asChild disabled={pending}>
                          <label htmlFor="company-logo" className="cursor-pointer">
                            <ImagePlus className="mr-2 h-4 w-4" />
                            {initial.companyLogoStorageKey && !removeCompanyLogo ? "Zëvendëso" : "Ngarko logon"}
                          </label>
                        </Button>
                        <Input
                          id="company-logo"
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="sr-only"
                          disabled={pending}
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            if (!file) return;
                            if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
                              toast.error("Lejohen vetëm PNG, JPEG ose WebP.");
                              event.target.value = "";
                              return;
                            }
                            if (file.size > 3 * 1024 * 1024) {
                              toast.error("Logoja mund të jetë maksimumi 3 MB.");
                              event.target.value = "";
                              return;
                            }
                            setCompanyLogoFile(file);
                            setRemoveCompanyLogo(false);
                          }}
                        />
                        {(initial.companyLogoStorageKey || companyLogoFile) && !removeCompanyLogo ? (
                          <Button
                            type="button"
                            variant="outlinePrimary"
                            disabled={pending}
                            onClick={() => {
                              setCompanyLogoFile(null);
                              setCompanyLogoPreview(null);
                              setRemoveCompanyLogo(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Hiq logon
                          </Button>
                        ) : null}
                      </div>
                      <p className="max-w-md text-xs leading-5 text-muted-foreground">
                        Dimensionet e rekomanduara: 600 × 310 px. Në dokumente logoja shfaqet deri në
                        35 × 18 mm, duke ruajtur proporcionet.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* Karta "Dokumentet — prefikset" u hoq nga UI (2026-08) me kërkesë:
                  vetëm logoja e kompanisë mbetet këtu. Vlerat e ruajtura të prefiksave
                  vazhdojnë të dërgohen të paprekura që motori i dokumenteve të mos prishet. */}
            </div>
          </TabsContent>

          <TabsContent value="pushimet">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Pushimet — kuota referuese</CardTitle>
                  <CardDescription>
                    Kuotat e paracaktuara për politikën e kompanisë. Pushimi mjekësor i rregullt është 20 ditë pune në vit
                    (parazgjedhje ligjore); lëndimi në punë regjistrohet si nën-lloj i veçantë.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className={fieldGrid}>
                    <FormField label="Ditët vjetore" hint="Numër ditësh në vit." error={fieldErrors["configuration.annualLeaveDaysDefault"]}>
                      <Input
                        id="leave-annual"
                        className={cn(
                          "tabular-nums",
                          fieldErrors["configuration.annualLeaveDaysDefault"] && "border-destructive ring-1 ring-destructive/35",
                        )}
                        aria-invalid={Boolean(fieldErrors["configuration.annualLeaveDaysDefault"]) || undefined}
                        value={cfg.annualLeaveDaysDefault ?? ""}
                        onChange={(e) => {
                          clearFieldErrorKey("configuration.annualLeaveDaysDefault");
                          setCfg((c) => ({ ...c, annualLeaveDaysDefault: e.target.value || null }));
                        }}
                        inputMode="decimal"
                        disabled={pending}
                      />
                    </FormField>
                    <FormField label="Leje personale" error={fieldErrors["configuration.personalLeaveDaysDefault"]}>
                      <Input
                        id="leave-personal"
                        className={cn(
                          "tabular-nums",
                          fieldErrors["configuration.personalLeaveDaysDefault"] && "border-destructive ring-1 ring-destructive/35",
                        )}
                        aria-invalid={Boolean(fieldErrors["configuration.personalLeaveDaysDefault"]) || undefined}
                        value={cfg.personalLeaveDaysDefault ?? ""}
                        onChange={(e) => {
                          clearFieldErrorKey("configuration.personalLeaveDaysDefault");
                          setCfg((c) => ({ ...c, personalLeaveDaysDefault: e.target.value || null }));
                        }}
                        inputMode="decimal"
                        disabled={pending}
                      />
                    </FormField>
                    <FormField
                      label="Ditë pune / javë"
                      hint="Baza e pushimit vjetor = ditë pune × 4 (parazgjedhje 5 → 20 ditë)."
                      error={fieldErrors["configuration.workingDaysPerWeek"]}
                    >
                      <Input
                        id="leave-workweek"
                        className={cn(
                          "tabular-nums",
                          fieldErrors["configuration.workingDaysPerWeek"] && "border-destructive ring-1 ring-destructive/35",
                        )}
                        aria-invalid={Boolean(fieldErrors["configuration.workingDaysPerWeek"]) || undefined}
                        value={cfg.workingDaysPerWeek ?? ""}
                        onChange={(e) => {
                          clearFieldErrorKey("configuration.workingDaysPerWeek");
                          setCfg((c) => ({ ...c, workingDaysPerWeek: e.target.value || null }));
                        }}
                        placeholder="5"
                        inputMode="decimal"
                        disabled={pending}
                      />
                    </FormField>
                    <FormField
                      label="Pushim mjekësor (ditë pune/vit)"
                      hint="Parazgjedhja ligjore: 20 ditë pune në vit kalendarik. Lëndimi në punë / sëmundja profesionale nuk përdor këtë kuotë."
                      error={fieldErrors["configuration.medicalLeaveDaysDefault"]}
                    >
                      <Input
                        id="leave-medical-days"
                        className={cn(
                          "tabular-nums",
                          fieldErrors["configuration.medicalLeaveDaysDefault"] && "border-destructive ring-1 ring-destructive/35",
                        )}
                        aria-invalid={Boolean(fieldErrors["configuration.medicalLeaveDaysDefault"]) || undefined}
                        value={cfg.medicalLeaveDaysDefault ?? ""}
                        onChange={(e) => {
                          clearFieldErrorKey("configuration.medicalLeaveDaysDefault");
                          setCfg((c) => ({ ...c, medicalLeaveDaysDefault: e.target.value || null }));
                        }}
                        placeholder="20"
                        inputMode="decimal"
                        disabled={pending}
                      />
                    </FormField>
                    <FormField
                      label="Shënime HR — pushim mjekësor"
                      className="md:col-span-2"
                      hint="Politika shtesë e kompanisë, përfshirë trajtimin e lëndimit në punë (jashtë kuotës 20-ditore)."
                      error={fieldErrors["configuration.medicalLeavePolicyNote"]}
                    >
                      <Input
                        id="leave-medical"
                        className={cn(fieldErrors["configuration.medicalLeavePolicyNote"] && "border-destructive ring-1 ring-destructive/35")}
                        aria-invalid={Boolean(fieldErrors["configuration.medicalLeavePolicyNote"]) || undefined}
                        value={cfg.medicalLeavePolicyNote ?? ""}
                        onChange={(e) => {
                          clearFieldErrorKey("configuration.medicalLeavePolicyNote");
                          setCfg((c) => ({ ...c, medicalLeavePolicyNote: e.target.value || null }));
                        }}
                        placeholder="P.sh. procedura për lëndim në punë, raport mjekësor…"
                        disabled={pending}
                      />
                    </FormField>
                  </div>
                </CardContent>
              </Card>
              <TenureBonusCard
                initialEnabled={initial.leavePolicy.enableTenureBonus}
                everyYears={initial.leavePolicy.tenureBonusEveryYears}
                daysPerBlock={initial.leavePolicy.tenureBonusDaysPerBlock}
              />
              <LeaveMonthlyAccrualPanel />
            </div>
          </TabsContent>

          <TabsContent value="njoftimet">
            <Card>
              <CardHeader>
                <CardTitle>Njoftimet</CardTitle>
                <CardDescription>
                  Çelësat e kompanisë për radhët e njoftimeve — përdoren nga procesori i njoftimeve.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex max-w-2xl flex-col gap-3">
                  <NotificationToggle
                    id="notify-contract-expiry"
                    title="Kontrata afër skadimit"
                    description="Sinjal kur kontratat qëndrojnë pa rinovim."
                    checked={cfg.notifyContractExpiring}
                    disabled={pending}
                    onCheckedChange={(v) => setCfg((c) => ({ ...c, notifyContractExpiring: v }))}
                  />
                  <NotificationToggle
                    id="notify-payroll"
                    title="Payroll reminders"
                    description="Para afateve të përpunimit të pagës."
                    checked={cfg.notifyPayrollReminders}
                    disabled={pending}
                    onCheckedChange={(v) => setCfg((c) => ({ ...c, notifyPayrollReminders: v }))}
                  />
                  <NotificationToggle
                    id="notify-leave"
                    title="Leave approvals"
                    description="Kërkesat në pritje të vendimit."
                    checked={cfg.notifyLeaveApprovals}
                    disabled={pending}
                    onCheckedChange={(v) => setCfg((c) => ({ ...c, notifyLeaveApprovals: v }))}
                  />
                  <NotificationToggle
                    id="notify-warnings"
                    title="Employee warnings"
                    description="Për incidentet ose dokumentacionin e paplotë."
                    checked={cfg.notifyEmployeeWarnings}
                    disabled={pending}
                    onCheckedChange={(v) => setCfg((c) => ({ ...c, notifyEmployeeWarnings: v }))}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </form>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <Button type="submit" form="konfigurime-form" className="w-full" size="lg" disabled={pending}>
          {pending ? "Duke ruajtur…" : "Ruaj ndryshimet"}
        </Button>
      </div>
    </>
  );
}

/**
 * Neni 37.2 i Ligjit të Punës: +1 ditë pushimi vjetor për çdo 5 vjet të plota
 * përvojë pune. Motori e llogarit vetë nga data e punësimit — ky çelës vetëm
 * e ndez/fik për kompaninë dhe rillogarit balancat menjëherë.
 */
function TenureBonusCard(props: {
  initialEnabled: boolean;
  everyYears: number;
  daysPerBlock: string;
}) {
  const [enabled, setEnabled] = useState(props.initialEnabled);
  const [busy, setBusy] = useState(false);

  async function toggle(next: boolean) {
    setBusy(true);
    setEnabled(next);
    try {
      const res = await setLeaveTenureBonusAction({ enabled: next });
      if (!res.ok) {
        setEnabled(!next);
        toast.error(res.error);
        return;
      }
      toast.success(
        next
          ? "Ditët shtesë sipas përvojës u aktivizuan — balancat u rillogaritën."
          : "Ditët shtesë sipas përvojës u çaktivizuan — balancat u rillogaritën.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
        <div className="space-y-1.5">
          <CardTitle>Ditët shtesë sipas përvojës (Neni 37)</CardTitle>
          <CardDescription>
            Ligji i Punës Nr. 03/L-212, Neni 37.2: punëmarrësi fiton{" "}
            <strong className="text-foreground">
              +{props.daysPerBlock} ditë pushimi vjetor për çdo {props.everyYears} vjet
            </strong>{" "}
            të plota përvojë pune. Kur është aktiv, sistemi e llogarit automatikisht nga data e
            punësimit dhe e përfshin në kuotën e akumuluar të secilit punonjës.
          </CardDescription>
        </div>
        <Switch
          checked={enabled}
          disabled={busy}
          onCheckedChange={(v) => void toggle(v)}
          aria-label="Aktivizo ditët shtesë sipas përvojës"
        />
      </CardHeader>
    </Card>
  );
}

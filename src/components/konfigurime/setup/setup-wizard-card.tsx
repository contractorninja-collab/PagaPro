"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ChevronDown, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCan } from "@/components/layout/capability-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StepCircle } from "@/components/patterns/step-circle";
import { cn } from "@/lib/utils";
import { saveJobTitleAction } from "@/modules/job-titles/actions/job-title-actions";
import {
  runSetupContractCheckAction,
  type SetupContractCheckResult,
} from "@/modules/konfigurime/actions/setup-check-actions";
import {
  SETUP_CONFIGURATION_DEFAULTS,
  defaultJobDescriptionForTitle,
} from "@/modules/konfigurime/setup/setup-defaults";
import {
  deriveSetupSteps,
  firstOpenSetupStepIndex,
  setupFactsFromDto,
  setupProgress,
  type SetupStepId,
} from "@/modules/konfigurime/setup/setup-steps";
import { SetupEmployeeRows } from "@/components/konfigurime/setup/setup-employee-rows";
import type { JobTitleDto } from "@/modules/job-titles/services/job-title-service";
import type {
  KonfigurimeEmployeeOptionDto,
  KonfigurimePageDto,
} from "@/modules/konfigurime/services/konfigurime-service";
import type { SaveKonfigurimeResult } from "@/modules/konfigurime/actions/save-konfigurime";
import type { KonfigurimeSubmitOverrides } from "@/components/konfigurime/konfigurime-configurator";

/**
 * Konfigurimi fillestar — the guided first run.
 *
 * A new company cannot save Konfigurimet until a representative exists, a
 * representative must be an employee with a job title, and an employee needs a
 * job title to exist first. This card walks that chain in the only order that
 * works, creating each thing in place.
 *
 * Two rules that are easy to break and expensive to debug:
 *
 * 1. **No `<form>` element in here, and every button is `type="button"`.** The
 *    card is a sibling above `<form id="konfigurime-form">`. A nested form — or
 *    a Dialog, since React's synthetic submit bubbles through the React tree
 *    even when Radix portals the DOM elsewhere — would silently fire the whole
 *    Konfigurimet save.
 * 2. **No `router.refresh()` between steps.** The configurator resets its form
 *    state whenever `initial` changes, so a mid-flow refresh wipes what the
 *    client is typing. Steps advance local mirrors instead and refresh once, at
 *    the end.
 */

const LOGO_SKIP_KEY = (companyId: string) => `pagapro:setup-logo-skipped:${companyId}`;

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export interface SetupWizardCardProps {
  initial: KonfigurimePageDto;
  company: KonfigurimePageDto["company"];
  cfg: KonfigurimePageDto["configuration"];
  pending: boolean;
  onPatchCompany: React.Dispatch<React.SetStateAction<KonfigurimePageDto["company"]>>;
  onPatchConfiguration: React.Dispatch<React.SetStateAction<KonfigurimePageDto["configuration"]>>;
  submitKonfigurime: (o?: KonfigurimeSubmitOverrides) => Promise<SaveKonfigurimeResult>;
  onGoToTab: (tab: "dokumentet" | "pozitat") => void;
  /** Keeps the Autorizuari dropdown in step with people the wizard just created. */
  onEmployeesCreated: (created: KonfigurimeEmployeeOptionDto[]) => void;
  /**
   * Hands the saved signer back to the configurator's own `reps` state.
   *
   * Without it the main "Ruaj ndryshimet" button keeps submitting the blank row
   * the loader synthesised — Zod rejects the save and jumps to a tab whose
   * select is empty — or, for a company that already had a signer, quietly
   * writes the old one back over the one just chosen.
   */
  onRepresentativeSaved: (employeeId: string) => void;
  onFinished: () => void;
}

export function SetupWizardCard(props: SetupWizardCardProps) {
  const companyId = props.initial.companyId;

  // Optimistic mirrors of server truth, advanced as steps succeed.
  const [jobTitles, setJobTitles] = useState<JobTitleDto[]>(() => props.initial.jobTitles);
  const [employees, setEmployees] = useState<KonfigurimeEmployeeOptionDto[]>(
    () => props.initial.employees,
  );
  const [departments, setDepartments] = useState(() =>
    props.initial.departments.map((d) => ({ id: d.id, name: d.name })),
  );
  const [repSaved, setRepSaved] = useState<boolean>(() =>
    props.initial.representatives.some((r) => Boolean(r.employeeId)),
  );
  /**
   * The representative the wizard saved.
   *
   * Step 3 submits it as an explicit override because React batching makes
   * set-then-submit unsafe — but that means the configurator's own `reps` state
   * never learned about it. Every later wizard save has to carry the override
   * too, or it submits an empty representative and the payload is rejected.
   */
  const [savedRepEmployeeId, setSavedRepEmployeeId] = useState<string | null>(
    () => props.initial.representatives.find((r) => r.employeeId)?.employeeId ?? null,
  );
  /**
   * A step is done when it is **saved**, never when it is merely typed.
   *
   * These mirror the server and advance only after a successful save. Deriving
   * from the live form state instead produced a false green: the card reported
   * "i plotësuar" while every field was still null in the database.
   */
  const [savedCompany, setSavedCompany] = useState<{
    fiscalNumber: string | null;
    addressLine: string | null;
  }>(() => ({
    fiscalNumber: props.initial.company.fiscalNumber,
    addressLine: props.initial.company.addressLine,
  }));
  const [savedParams, setSavedParams] = useState<{
    minimumSalaryCurrent: string | null;
    standardWeeklyHours: string | null;
    workingDaysPerWeek: string | null;
    annualLeaveDaysDefault: string | null;
  }>(() => ({
    minimumSalaryCurrent: props.initial.configuration.minimumSalaryCurrent,
    standardWeeklyHours: props.initial.configuration.standardWeeklyHours,
    workingDaysPerWeek: props.initial.configuration.workingDaysPerWeek,
    annualLeaveDaysDefault: props.initial.configuration.annualLeaveDaysDefault,
  }));
  const [savedLogo, setSavedLogo] = useState<boolean>(() =>
    Boolean(props.initial.companyLogoStorageKey),
  );
  const [logoSkipped, setLogoSkipped] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [openStep, setOpenStep] = useState<SetupStepId | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * Declared with the rest of the state, above the collapsed-summary early
   * return. The wizard walks a new company through two different permissions:
   * its job titles and employees are employees.write, while the company
   * profile, parameters and logo are company.settings. A member holding one and
   * not the other still gets the steps they can actually complete.
   */
  const canWriteSettings = useCan("company.settings");
  const canWriteEmployees = useCan("employees.write");

  // Step-1 draft
  const [newTitle, setNewTitle] = useState("");
  // Step-3 draft
  // Seeded from the saved representative, so reopening this step shows the
  // person already on file instead of an empty select the client has to re-pick.
  const [repEmployeeId, setRepEmployeeId] = useState(
    () => props.initial.representatives.find((r) => r.employeeId)?.employeeId ?? "",
  );
  // Step-5 draft
  const [logoFile, setLogoFile] = useState<File | null>(null);
  // Step-6 result
  const [check, setCheck] = useState<SetupContractCheckResult | null>(null);

  useEffect(() => {
    try {
      setLogoSkipped(window.localStorage.getItem(LOGO_SKIP_KEY(companyId)) === "1");
    } catch {
      /* private mode — the step simply stays open */
    }
  }, [companyId]);

  /**
   * Save the suggested defaults, not just show them.
   *
   * `value={cfg.x ?? DEFAULT}` renders a number the client reads as accepted
   * while state stays null, so accepting the suggestion wrote nulls and the
   * step could never complete. Seeding state from an effect here does not fix
   * it either — child effects run before the parent's `[initial]` effect, which
   * resets `cfg` right back. So the effective values are computed at save time
   * and passed as an explicit override.
   */
  const effectiveParameters = {
    minimumSalaryCurrent: props.cfg.minimumSalaryCurrent,
    standardWeeklyHours:
      props.cfg.standardWeeklyHours ?? SETUP_CONFIGURATION_DEFAULTS.standardWeeklyHours,
    workingDaysPerWeek:
      props.cfg.workingDaysPerWeek ?? SETUP_CONFIGURATION_DEFAULTS.workingDaysPerWeek,
    annualLeaveDaysDefault:
      props.cfg.annualLeaveDaysDefault ?? SETUP_CONFIGURATION_DEFAULTS.annualLeaveDaysDefault,
  };

  const steps = useMemo(
    () =>
      deriveSetupSteps(
        setupFactsFromDto(
          {
            companyLogoStorageKey: savedLogo ? "set" : null,
            company: savedCompany,
            representatives: repSaved ? [{ employeeId: "saved" }] : [{ employeeId: null }],
            configuration: savedParams,
            jobTitles,
            employees,
          },
          { logoSkipped },
        ),
      ),
    [savedLogo, savedCompany, savedParams, repSaved, jobTitles, employees, logoSkipped],
  );

  const progress = setupProgress(steps);
  const activeId = openStep ?? steps[firstOpenSetupStepIndex(steps)]?.id ?? "pozitat";

  // Completed setups retire to a single quiet line — never a nag, never a flag.
  if (progress.complete && !expanded) {
    return (
      <div className="mb-6 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-[#15803d]" aria-hidden />
        <span>Konfigurimi fillestar është i plotësuar.</span>
        <Button type="button" variant="link" size="sm" onClick={() => setExpanded(true)}>
          Shiko përmbledhjen
        </Button>
      </div>
    );
  }

  async function addJobTitle() {
    const title = newTitle.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      const res = await saveJobTitleAction({
        title,
        // The client writes real duties later; an empty description is not an
        // option (schema) and would render as a blank clause in a contract.
        description: defaultJobDescriptionForTitle(title),
        department: null,
        level: null,
        responsibilities: null,
        requirements: null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // The action returns an id only — the row is rebuilt from what was typed.
      setJobTitles((prev) => [
        ...prev,
        {
          id: res.id,
          title,
          description: defaultJobDescriptionForTitle(title),
          department: null,
          level: null,
          responsibilities: null,
          requirements: null,
          status: "ACTIVE",
          employeeCount: 0,
        } as JobTitleDto,
      ]);
      setNewTitle("");
      toast.success(`Pozita «${title}» u krijua.`);
    } finally {
      setBusy(false);
    }
  }

  async function saveRepresentativeStep() {
    if (busy || !repEmployeeId) return;
    setBusy(true);
    try {
      const res = await props.submitKonfigurime({
        representativeEmployeeIds: [repEmployeeId],
        // Explicit: a removal staged on the Dokumentet tab must not ride along
        // on a step that says nothing about the logo and delete the blob.
        removeLogo: false,
        skipRouterRefresh: true,
        silentSuccess: true,
      });
      if (!res.ok) return; // toast + field errors already surfaced upstream
      setRepSaved(true);
      setSavedRepEmployeeId(repEmployeeId);
      props.onRepresentativeSaved(repEmployeeId);
      // Only now is it true on the server.
      setSavedCompany({
        fiscalNumber: props.company.fiscalNumber,
        addressLine: props.company.addressLine,
      });
      toast.success("Kompania dhe përfaqësuesi u ruajtën.");
      setOpenStep("parametrat");
    } finally {
      setBusy(false);
    }
  }

  async function saveParametersStep() {
    if (busy) return;
    // The server takes these through Number(); anything it cannot read becomes
    // null, and a nullable column accepts null, so "500€" would save silently
    // and still tick the step green off the raw string. Catch it here.
    for (const [value, label] of [
      [effectiveParameters.minimumSalaryCurrent, "Paga minimale"],
      [effectiveParameters.standardWeeklyHours, "Orët javore"],
      [effectiveParameters.workingDaysPerWeek, "Ditët e punës në javë"],
      [effectiveParameters.annualLeaveDaysDefault, "Pushimi vjetor"],
    ] as const) {
      const n = Number(String(value ?? "").trim().replace(",", "."));
      if (!String(value ?? "").trim() || !Number.isFinite(n) || n <= 0) {
        toast.error(`${label}: shkruani një numër të vlefshëm.`);
        return;
      }
    }
    setBusy(true);
    try {
      const res = await props.submitKonfigurime({
        ...(savedRepEmployeeId ? { representativeEmployeeIds: [savedRepEmployeeId] } : {}),
        configuration: effectiveParameters,
        removeLogo: false,
        skipRouterRefresh: true,
        silentSuccess: true,
      });
      if (!res.ok) return;
      setSavedParams(effectiveParameters);
      toast.success("Parametrat u ruajtën.");
      setOpenStep("logoja");
    } finally {
      setBusy(false);
    }
  }

  async function saveLogoStep() {
    if (busy || !logoFile) return;
    setBusy(true);
    try {
      // Carries the parameters too: this save rebuilds the whole payload from
      // `cfg`, which is still null for the defaulted fields until a refresh —
      // without the override the logo step would undo step 4.
      const res = await props.submitKonfigurime({
        ...(savedRepEmployeeId ? { representativeEmployeeIds: [savedRepEmployeeId] } : {}),
        configuration: effectiveParameters,
        logoFile,
        removeLogo: false,
        skipRouterRefresh: true,
        silentSuccess: true,
      });
      if (!res.ok) return;
      setSavedLogo(true);
      setLogoFile(null);
      toast.success("Logoja u ruajt.");
      setOpenStep("testi");
    } finally {
      setBusy(false);
    }
  }

  function skipLogo() {
    setLogoSkipped(true);
    try {
      window.localStorage.setItem(LOGO_SKIP_KEY(companyId), "1");
    } catch {
      /* ignore */
    }
    setOpenStep("testi");
  }

  async function runCheck() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await runSetupContractCheckAction({});
      if (!res.ok) {
        toast.error(res.error);
        setCheck(null);
        return;
      }
      setCheck(res.data);
    } finally {
      setBusy(false);
    }
  }

  const disabled = props.pending || busy;
  const settingsLocked = disabled || !canWriteSettings;
  const employeesLocked = disabled || !canWriteEmployees;
  const titlesNeedingDescription = jobTitles.filter(
    (j) => j.description === defaultJobDescriptionForTitle(j.title),
  ).length;

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#eef2f7] bg-[#f8fafc] px-5 py-4">
        <Rocket className="h-5 w-5 text-brand-blue" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-bold tracking-[-0.01em] text-[#0f172a]">
            Konfigurimi fillestar
          </h2>
          <p className="mt-0.5 text-[12.5px] text-[#64748b]">
            {progress.complete
              ? "Të gjitha hapat e domosdoshëm janë plotësuar."
              : `${progress.doneCount} nga ${progress.requiredCount} hapa — pa dalë nga kjo faqe.`}
          </p>
        </div>
        {progress.complete ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded(false)}>
            Mbylle
          </Button>
        ) : null}
      </div>

      {/* Already prepared, so the client does not go hunting for it. */}
      <p className="border-b border-[#eef2f7] px-5 py-2.5 text-[12px] text-[#64748b]">
        Tashmë të përgatitura nga ne: festat zyrtare, parametrat bazë të pagës, politika e
        pushimeve dhe shabllonet e dokumenteve.
      </p>

      <div className="divide-y divide-[#f1f5f9]">
        {steps.map((step, idx) => {
          const isOpen = step.id === activeId && !step.blocked;
          const state = step.done
            ? "done"
            : step.blocked
              ? "blocked"
              : isOpen
                ? "active"
                : "idle";

          return (
            <div key={step.id} className={cn(step.blocked && "opacity-60")}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-[#f8fafc] disabled:cursor-not-allowed"
                disabled={step.blocked}
                onClick={() => setOpenStep(isOpen ? null : step.id)}
              >
                <StepCircle state={state} index={idx} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-[#0f172a]">
                    {step.label}
                    {step.optional ? (
                      <span className="ml-2 text-[11px] font-medium text-[#94a3b8]">
                        opsionale
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-[12px] text-[#64748b]">
                    {step.blocked ? step.blockedReason : step.hint}
                  </span>
                </span>
                {!step.blocked ? (
                  <ChevronDown
                    className={cn("h-4 w-4 shrink-0 text-[#94a3b8]", isOpen && "rotate-180")}
                    aria-hidden
                  />
                ) : null}
              </button>

              {isOpen ? (
                <div className="border-t border-[#f1f5f9] bg-[#fcfdff] px-5 py-4">
                  {step.id === "pozitat" ? (
                    <div className="space-y-3">
                      <p className="text-[12.5px] text-muted-foreground">
                        Shkruani vetëm titullin. Përshkrimin e detyrave e plotësoni më vonë te
                        Konfigurimet › Pozitat — deri atëherë përdorim një përshkrim të
                        përgjithshëm.
                      </p>
                      <div className="flex flex-wrap items-end gap-2">
                        <span className="min-w-[220px] flex-1">
                          <Label htmlFor="setup-title">Titulli i pozitës</Label>
                          <Input
                            id="setup-title"
                            value={newTitle}
                            disabled={employeesLocked}
                            placeholder="p.sh. Shitës"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void addJobTitle();
                              }
                            }}
                            onChange={(e) => setNewTitle(e.target.value)}
                          />
                        </span>
                        <Button
                          type="button"
                          disabled={employeesLocked || !newTitle.trim()}
                          onClick={() => void addJobTitle()}
                        >
                          Shto pozitën
                        </Button>
                      </div>
                      {jobTitles.length > 0 ? (
                        <p className="text-[12.5px] text-[#15803d]">
                          {jobTitles.length} pozita: {jobTitles.map((j) => j.title).join(", ")}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {step.id === "punonjesit" ? (
                    <SetupEmployeeRows
                      jobTitles={jobTitles}
                      departments={departments}
                      disabled={disabled}
                      onDepartmentCreated={(d) => setDepartments((prev) => [...prev, d])}
                      onRowsFailed={() => setOpenStep("punonjesit")}
                      onCreated={(created) => {
                        const options = created.map((c) => ({
                          id: c.id,
                          fullName: c.fullName,
                          jobTitle: c.jobTitle,
                        }));
                        setEmployees((prev) => [...prev, ...options]);
                        // The Autorizuari tab reads the configurator's own list,
                        // which no refresh has updated — tell it directly.
                        props.onEmployeesCreated(options);
                      }}
                    />
                  ) : null}

                  {step.id === "perfaqesuesi" ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <span>
                          <Label htmlFor="setup-nui">NUI</Label>
                          <Input
                            id="setup-nui"
                            value={props.company.fiscalNumber ?? ""}
                            disabled={settingsLocked}
                            onChange={(e) =>
                              props.onPatchCompany((s) => ({ ...s, fiscalNumber: e.target.value }))
                            }
                          />
                          <span className="mt-1 block text-[11.5px] text-muted-foreground">
                            Printohet në çdo kontratë — pa të, dokumentet janë ligjërisht të
                            paplota.
                          </span>
                        </span>
                        <span>
                          <Label htmlFor="setup-address">Adresa</Label>
                          <Input
                            id="setup-address"
                            value={props.company.addressLine ?? ""}
                            disabled={settingsLocked}
                            onChange={(e) =>
                              props.onPatchCompany((s) => ({ ...s, addressLine: e.target.value }))
                            }
                          />
                        </span>
                      </div>
                      <span className="block md:max-w-[420px]">
                        <Label htmlFor="setup-rep">Nënshkruesi i dokumenteve</Label>
                        <select
                          id="setup-rep"
                          className={SELECT_CLASS}
                          value={repEmployeeId}
                          disabled={settingsLocked}
                          onChange={(e) => setRepEmployeeId(e.target.value)}
                        >
                          <option value="">Zgjidh punonjësin…</option>
                          {employees.map((e) => (
                            <option key={e.id} value={e.id} disabled={!e.jobTitle}>
                              {e.fullName}
                              {e.jobTitle ? "" : " — pa pozitë"}
                            </option>
                          ))}
                        </select>
                      </span>
                      <Button
                        type="button"
                        disabled={settingsLocked || !repEmployeeId}
                        onClick={() => void saveRepresentativeStep()}
                      >
                        {busy ? "Duke ruajtur…" : "Ruaj dhe vazhdo"}
                      </Button>
                    </div>
                  ) : null}

                  {step.id === "parametrat" ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <span>
                          <Label htmlFor="setup-min">Paga minimale (€)</Label>
                          <Input
                            id="setup-min"
                            inputMode="decimal"
                            value={props.cfg.minimumSalaryCurrent ?? ""}
                            disabled={settingsLocked}
                            onChange={(e) =>
                              props.onPatchConfiguration((s) => ({
                                ...s,
                                minimumSalaryCurrent: e.target.value,
                              }))
                            }
                          />
                        </span>
                        <span>
                          <Label htmlFor="setup-weekly">Orët standarde javore</Label>
                          <Input
                            id="setup-weekly"
                            inputMode="decimal"
                            value={
                              props.cfg.standardWeeklyHours ??
                              SETUP_CONFIGURATION_DEFAULTS.standardWeeklyHours
                            }
                            disabled={settingsLocked}
                            onChange={(e) =>
                              props.onPatchConfiguration((s) => ({
                                ...s,
                                standardWeeklyHours: e.target.value,
                              }))
                            }
                          />
                        </span>
                        <span>
                          <Label htmlFor="setup-days">Ditë pune / javë</Label>
                          <Input
                            id="setup-days"
                            inputMode="decimal"
                            value={
                              props.cfg.workingDaysPerWeek ??
                              SETUP_CONFIGURATION_DEFAULTS.workingDaysPerWeek
                            }
                            disabled={settingsLocked}
                            onChange={(e) =>
                              props.onPatchConfiguration((s) => ({
                                ...s,
                                workingDaysPerWeek: e.target.value,
                              }))
                            }
                          />
                        </span>
                        <span>
                          <Label htmlFor="setup-leave">Ditët e pushimit vjetor</Label>
                          <Input
                            id="setup-leave"
                            inputMode="decimal"
                            value={
                              props.cfg.annualLeaveDaysDefault ??
                              SETUP_CONFIGURATION_DEFAULTS.annualLeaveDaysDefault
                            }
                            disabled={settingsLocked}
                            onChange={(e) =>
                              props.onPatchConfiguration((s) => ({
                                ...s,
                                annualLeaveDaysDefault: e.target.value,
                              }))
                            }
                          />
                        </span>
                      </div>
                      <Button type="button" disabled={settingsLocked} onClick={() => void saveParametersStep()}>
                        {busy ? "Duke ruajtur…" : "Ruaj dhe vazhdo"}
                      </Button>
                    </div>
                  ) : null}

                  {step.id === "logoja" ? (
                    <div className="space-y-3">
                      <p className="text-[12.5px] text-muted-foreground">
                        PNG, JPEG ose WebP, deri në 3 MB. Nëse nuk keni logo tani, vazhdoni —
                        mund ta shtoni kurdo te Konfigurimet › Dokumentet.
                      </p>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={settingsLocked}
                        className="text-[13px]"
                        onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          disabled={settingsLocked || !logoFile}
                          onClick={() => void saveLogoStep()}
                        >
                          {busy ? "Duke ruajtur…" : "Ruaj logon"}
                        </Button>
                        <Button type="button" variant="secondary" disabled={disabled} onClick={skipLogo}>
                          Vazhdo pa logo
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {step.id === "testi" ? (
                    <div className="space-y-3">
                      <p className="text-[12.5px] text-muted-foreground">
                        Kontrollojmë një kontratë të vërtetë për një punonjës të vërtetë. Asnjë
                        dokument nuk ruhet — vetëm kontrollohet.
                      </p>
                      <Button type="button" disabled={disabled} onClick={() => void runCheck()}>
                        {busy ? "Duke kontrolluar…" : "Kontrollo kontratën"}
                      </Button>

                      {check && check.missing.length === 0 ? (
                        <div className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2.5">
                          <p className="flex items-center gap-2 text-[13px] font-semibold text-[#15803d]">
                            <CheckCircle2 className="h-4 w-4" aria-hidden />
                            Të gjitha fushat u plotësuan
                          </p>
                          <p className="mt-1 text-[12.5px] text-[#166534]">
                            Kontrata për {check.employeeName} ({check.templateName}) nuk ka asnjë
                            fushë bosh.
                          </p>
                        </div>
                      ) : null}

                      {check && check.missing.length > 0 ? (
                        <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2.5">
                          <p className="flex items-center gap-2 text-[13px] font-semibold text-[#b45309]">
                            <AlertTriangle className="h-4 w-4" aria-hidden />
                            {check.missing.length} fusha mbeten bosh
                          </p>
                          <ul className="mt-1.5 space-y-1">
                            {check.missing.map((m) => (
                              <li key={m.key} className="text-[12.5px] text-[#92400e]">
                                {m.label} —{" "}
                                <button
                                  type="button"
                                  className="font-semibold underline underline-offset-2"
                                  onClick={() => setOpenStep(m.step)}
                                >
                                  plotësoje
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {progress.complete ? (
                        <Button type="button" variant="secondary" onClick={props.onFinished}>
                          Përfundo konfigurimin
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {titlesNeedingDescription > 0 ? (
        <p className="border-t border-[#eef2f7] px-5 py-2.5 text-[12px] text-[#64748b]">
          {titlesNeedingDescription} pozita përdorin ende një përshkrim të përgjithshëm.{" "}
          <button
            type="button"
            className="font-semibold text-brand-blue underline underline-offset-2"
            onClick={() => props.onGoToTab("pozitat")}
          >
            Plotësoni përshkrimin e detyrave
          </button>{" "}
          — ky tekst hyn fjalë për fjalë në kontratë (Neni 11).
        </p>
      ) : null}
    </div>
  );
}

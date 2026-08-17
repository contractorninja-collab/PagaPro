"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { AppSubBar } from "@/components/layout/app-sub-bar";
import { useCan } from "@/components/layout/capability-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getEmployeeDetailAction } from "@/modules/employees/actions/employee-actions";
import type {
  DepartmentOptionDto,
  EmployeeCountsDto,
  EmployeeDetailDto,
  EmployeeListRowDto,
  JobTitleOptionDto,
} from "@/modules/employees/types";
import { EmployeeFormSheet } from "@/modules/employees/components/employee-form-sheet";
import { EmployeeImportDialog } from "@/modules/employees/components/employee-import-dialog";
import { EmployeesTable } from "@/modules/employees/components/employees-table";
import {
  SalaryVisibilityProvider,
  SalaryVisibilityToggle,
} from "@/modules/employees/components/salary-visibility";

export interface EmployeeStatCard {
  key: string;
  label: string;
  value: number;
  href: string;
  active: boolean;
  /** What clicking does from here — the unfiltered card is not "a filter to remove". */
  hint: string;
  tone?: "warning";
}

/**
 * A count and a filter in one control. The numbers are company-wide totals, not
 * a summary of whatever the current query returned — a strip that changed
 * meaning every time you filtered needed a disclaimer under it to be readable,
 * which is a sign the strip was wrong.
 */
function StatCard({ card }: { card: EmployeeStatCard }) {
  const warning = card.tone === "warning";
  return (
    <Link
      href={card.href}
      aria-current={card.active ? "true" : undefined}
      className={cn(
        "rounded-xl border bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-colors",
        warning && "shadow-[inset_3px_0_0_#d97706,0_1px_3px_rgba(15,23,42,0.05)]",
        card.active
          ? warning
            ? "border-[#fbbf24] bg-[#fffbeb]"
            : "border-brand-blue bg-[#f5f8ff]"
          : warning
            ? "border-[#e2e8f0] hover:bg-[#fffbeb]"
            : "border-[#e2e8f0] hover:bg-[#f8fafc]",
      )}
    >
      <p
        className={cn(
          "text-[11px] font-bold uppercase tracking-[0.05em]",
          warning ? "text-[#b45309]" : "text-[#94a3b8]",
        )}
      >
        {card.label}
      </p>
      <p className="mt-1.5 text-[24px] font-extrabold leading-none tracking-[-0.02em] tabular-nums text-[#0f172a]">
        {card.value}
      </p>
      <p className="mt-1.5 text-[11px] font-medium text-[#94a3b8]">{card.hint}</p>
    </Link>
  );
}

export function EmployeesPageClient(props: {
  employees: EmployeeListRowDto[];
  counts: EmployeeCountsDto;
  cards: EmployeeStatCard[];
  departments: DepartmentOptionDto[];
  jobTitles: JobTitleOptionDto[];
  filters?: ReactNode;
  /** Leavers kept out of the default view — stated, never silently dropped. */
  hiddenTerminated?: number;
  showAllHref?: string;

  timeClockEnabled?: boolean;
}) {
  const {
    employees,
    cards,
    departments,
    jobTitles,
    filters,
    hiddenTerminated = 0,
    showAllHref = "/punonjesit?status=ALL",
  } = props;
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editId, setEditId] = useState<string | undefined>();
  const [detail, setDetail] = useState<EmployeeDetailDto | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const editFetchGeneration = useRef(0);

  const openCreate = () => {
    editFetchGeneration.current += 1;
    setLoadingDetail(false);
    setMode("create");
    setEditId(undefined);
    setDetail(null);
    setSheetOpen(true);
  };

  // `?shto=1` opens the new-employee wizard on arrival — deep-linked from the
  // Konfigurimet onboarding dead-ends ("+ Shto Punonjës" under Përfaqësuesit).
  /**
   * One question, one answer. `canImportEmployees` was threaded from the page as
   * a prop and was literally `can(subject, "employees.write")` — the same
   * capability every other control on this screen needs. The three import API
   * routes still call that predicate server-side; only the duplicate journey to
   * the UI is gone.
   */
  const canWriteEmployees = useCan("employees.write");

  const searchParams = useSearchParams();
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current) return;
    // Gated as well as the button: `?shto=1` opens the sheet without a click, so
    // a link would otherwise hand a read-only member a form they cannot save.
    if (!canWriteEmployees) return;
    if (searchParams.get("shto") === "1") {
      autoOpened.current = true;
      openCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, canWriteEmployees]);

  const openEdit = async (row: EmployeeListRowDto) => {
    if (row.status === "TERMINATED") {
      toast.message("Punonjësit e larguar përditësohen vetëm përmes moduleve të dedikuara.");
      return;
    }
    const generation = ++editFetchGeneration.current;
    setLoadingDetail(true);
    setMode("edit");
    setEditId(row.id);
    try {
      const d = await getEmployeeDetailAction(row.id);
      if (generation !== editFetchGeneration.current) {
        return;
      }
      if (!d) {
        toast.error("Punonjësi nuk u gjet.");
        setSheetOpen(false);
        setEditId(undefined);
        setDetail(null);
        return;
      }
      setDetail(d);
      setSheetOpen(true);
    } catch (err) {
      if (generation !== editFetchGeneration.current) {
        return;
      }
      console.error("[EmployeesPageClient] openEdit failed:", err);
      toast.error("Nuk mund të ngarkohen të dhënat e punonjësit. Provoni përsëri.");
      setSheetOpen(false);
      setEditId(undefined);
      setDetail(null);
    } finally {
      if (generation === editFetchGeneration.current) {
        setLoadingDetail(false);
      }
    }
  };

  return (
    <SalaryVisibilityProvider>
      <AppSubBar
        eyebrow="Menaxhimi i fuqisë punëtore"
        title="Punonjësit"
        description={
          departments.length === 0 ? (
            <>
              Regjistri i punonjësve dhe kontraktorëve — i izoluar për kompaninë aktive.{" "}
              <Link href="/konfigurime?tab=departamentet" className="text-primary underline-offset-4 hover:underline">
                Krijoni departamentet
              </Link>{" "}
              për t&apos;i caktuar punonjësve.
            </>
          ) : (
            "Regjistri i punonjësve dhe kontraktorëve — i izoluar për kompaninë aktive."
          )
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {loadingDetail ? <Skeleton className="h-9 w-36" /> : null}
            <SalaryVisibilityToggle />
            {canWriteEmployees ? (
              <>
                <Button type="button" variant="outlinePrimary" onClick={() => setImportOpen(true)} disabled={loadingDetail}>
                  <Upload className="h-4 w-4" aria-hidden />
                  Importo CSV
                </Button>
                <Button type="button" onClick={openCreate} disabled={loadingDetail}>
                  Shto punonjës
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {cards.map((card) => (
            <StatCard key={card.key} card={card} />
          ))}
        </div>

        {filters}

        {hiddenTerminated > 0 ? (
          <p className="text-[11.5px] text-[#94a3b8]">
            {hiddenTerminated === 1
              ? "1 punonjës i larguar nuk shfaqet në këtë listë."
              : `${hiddenTerminated} punonjës të larguar nuk shfaqen në këtë listë.`}{" "}
            <Link href={showAllHref} className="font-medium text-brand-blue hover:underline">
              Shfaqi edhe ata
            </Link>
          </p>
        ) : null}

        <EmployeesTable rows={employees} onEdit={(row) => void openEdit(row)} />
      </div>

      <EmployeeFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={mode}
        employeeId={editId}
        initialDetail={detail}
        departments={departments}
        jobTitles={jobTitles}
        timeClockEnabled={props.timeClockEnabled}
        onSuccess={() => router.refresh()}
      />
      <EmployeeImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => router.refresh()}
      />
    </SalaryVisibilityProvider>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppSubBar } from "@/components/layout/app-sub-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getEmployeeDetailAction } from "@/modules/employees/actions/employee-actions";
import type {
  DepartmentOptionDto,
  EmployeeDetailDto,
  EmployeeListRowDto,
  JobTitleOptionDto,
} from "@/modules/employees/types";
import { EmployeeFormSheet } from "@/modules/employees/components/employee-form-sheet";
import { EmployeesTable } from "@/modules/employees/components/employees-table";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white px-4 py-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">{label}</p>
      <p className="mt-1.5 text-[24px] font-extrabold leading-none tracking-[-0.02em] tabular-nums text-[#0f172a]">
        {value}
      </p>
    </div>
  );
}

export function EmployeesPageClient(props: {
  employees: EmployeeListRowDto[];
  departments: DepartmentOptionDto[];
  jobTitles: JobTitleOptionDto[];
  documentsMissingFilter?: boolean;
  /** URL që ndez/fik filtrin documentsMissing duke ruajtur filtrat e tjerë aktivë. */
  documentsMissingToggleHref?: string;
  /** True kur ka filtra aktivë — statistikat reflektojnë nën-bashkësinë e filtruar. */
  filtersActive?: boolean;
  filters?: ReactNode;
}) {
  const {
    employees,
    departments,
    jobTitles,
    documentsMissingFilter = false,
    documentsMissingToggleHref = "/punonjesit?documentsMissing=1",
    filtersActive = false,
    filters,
  } = props;
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editId, setEditId] = useState<string | undefined>();
  const [detail, setDetail] = useState<EmployeeDetailDto | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const editFetchGeneration = useRef(0);

  const stats = useMemo(() => {
    let active = 0;
    let onLeave = 0;
    let contractors = 0;
    for (const e of employees) {
      if (e.status === "ACTIVE") active += 1;
      if (e.status === "ON_LEAVE") onLeave += 1;
      if (e.employmentType === "CONTRACTOR") contractors += 1;
    }
    return { total: employees.length, active, onLeave, contractors };
  }, [employees]);

  const openCreate = () => {
    editFetchGeneration.current += 1;
    setLoadingDetail(false);
    setMode("create");
    setEditId(undefined);
    setDetail(null);
    setSheetOpen(true);
  };

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
    <>
      <AppSubBar
        eyebrow="Menaxhimi i fuqisë punëtore"
        title="Punonjësit"
        description={
          documentsMissingFilter ? (
            "Punonjës me dokumentacion të paplotë — i izoluar për kompaninë aktive."
          ) : departments.length === 0 ? (
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
            <Button type="button" onClick={openCreate} disabled={loadingDetail}>
              Shto punonjës
            </Button>
          </div>
        }
      />

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatCard label="Gjithsej" value={stats.total} />
          <StatCard label="Aktivë" value={stats.active} />
          <StatCard label="Në pushim" value={stats.onLeave} />
          <StatCard label="Kontraktorë" value={stats.contractors} />
          <Link
            href={documentsMissingToggleHref}
            className={cn(
              "rounded-xl border bg-white px-4 py-3.5 shadow-[inset_3px_0_0_#d97706,0_1px_3px_rgba(15,23,42,0.05)] transition-colors",
              documentsMissingFilter
                ? "border-[#fbbf24] bg-[#fffbeb]"
                : "border-[#e2e8f0] hover:bg-[#fffbeb]",
            )}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#b45309]">Dok. mungojnë</p>
            <p className="mt-1.5 text-[24px] font-extrabold leading-none tracking-[-0.02em] tabular-nums text-[#0f172a]">
              {documentsMissingFilter ? stats.total : "—"}
            </p>
            <p className="mt-1.5 text-[11px] font-medium text-[#94a3b8]">
              {documentsMissingFilter ? "Filtri aktiv — kliko për ta hequr" : "Kliko për të filtruar"}
            </p>
          </Link>
        </div>

        {filtersActive ? (
          <p className="text-[11.5px] text-[#94a3b8]">
            Statistikat reflektojnë filtrat aktivë — pastro filtrat për numrat e plotë të kompanisë.
          </p>
        ) : null}

        {filters}
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
        onSuccess={() => router.refresh()}
      />
    </>
  );
}

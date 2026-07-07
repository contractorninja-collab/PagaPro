"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getEmployeeDetailAction } from "@/modules/employees/actions/employee-actions";
import type {
  DepartmentOptionDto,
  EmployeeDetailDto,
  EmployeeListRowDto,
  JobTitleOptionDto,
} from "@/modules/employees/types";
import { EmployeeFormSheet } from "@/modules/employees/components/employee-form-sheet";
import { EmployeesTable } from "@/modules/employees/components/employees-table";

export function EmployeesPageClient(props: {
  employees: EmployeeListRowDto[];
  departments: DepartmentOptionDto[];
  jobTitles: JobTitleOptionDto[];
  documentsMissingFilter?: boolean;
}) {
  const { employees, departments, jobTitles, documentsMissingFilter = false } = props;
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editId, setEditId] = useState<string | undefined>();
  const [detail, setDetail] = useState<EmployeeDetailDto | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const editFetchGeneration = useRef(0);

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
      <PageHeader
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

      <div className="mt-8">
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

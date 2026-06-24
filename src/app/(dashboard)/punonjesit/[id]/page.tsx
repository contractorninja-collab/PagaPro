import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  EmployeeProfileShell,
  type EmployeeProfileDocumentsBundle,
} from "@/modules/employees/components/employee-profile-shell";
import { getEmployeeById, listDepartmentsForCompany } from "@/modules/employees/services/employee-service";
import {
  listArtifactsForEmployee,
  listContractsForEmployee,
  listPayrollGeneratedDocsForEmployee,
} from "@/modules/documents/services/document-queries";
import { resolveActiveCompanyId } from "@/server/company-scope";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params;
    const companyId = await resolveActiveCompanyId();
    if (!companyId) return { title: "Punonjësi" };
    const e = await getEmployeeById(companyId, id);
    if (!e) return { title: "Punonjësi" };
    return { title: `${e.firstName} ${e.lastName}` };
  } catch {
    return { title: "Punonjësi" };
  }
}

export default async function EmployeeProfilePage({ params }: Props) {
  const { id } = await params;
  const companyId = await resolveActiveCompanyId();

  if (!companyId) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <p className="text-sm text-muted-foreground">Nuk ka kompani aktive për këtë sesion.</p>
      </div>
    );
  }

  let employee;
  let departments;
  let genDocs;
  let contracts;
  let payrollDocs;
  try {
    [employee, departments, genDocs, contracts, payrollDocs] = await Promise.all([
      getEmployeeById(companyId, id),
      listDepartmentsForCompany(companyId),
      listArtifactsForEmployee(companyId, id),
      listContractsForEmployee(companyId, id),
      listPayrollGeneratedDocsForEmployee(companyId, id),
    ]);
  } catch (err) {
    console.error("[pagapro] EmployeeProfilePage: load failed", err);
    return (
      <div className="mx-auto max-w-xl py-12">
        <p className="text-sm font-medium text-destructive">
          Nuk mund të ngarkohet profili. Verifikoni databazën dhe migrimet{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npx prisma migrate deploy</code>.
        </p>
      </div>
    );
  }

  if (!employee) notFound();

  const documentCenter: EmployeeProfileDocumentsBundle = {
    generatedDocuments: genDocs.map((a) => ({
      id: a.id,
      title: a.title,
      documentCategory: a.documentCategory,
      kind: a.kind,
      createdAtIso: a.createdAt.toISOString(),
      createdAtLabel: a.createdAt.toLocaleString("sq-AL", { dateStyle: "short", timeStyle: "short" }),
      isArchived: a.isArchived,
      templateName: a.templateVersion.template.name,
      templateVersionNumber: a.templateVersion.versionNumber,
      hasPdf: Boolean(a.generatedPdfStorageKey),
    })),
    payrollPdfs: payrollDocs.map((p) => ({
      id: p.id,
      filename: p.filename,
      generatedAtIso: p.generatedAt.toISOString(),
      periodLabel: `${p.payroll.year}-${String(p.payroll.month).padStart(2, "0")}`,
    })),
    contracts: contracts.map((c) => ({
      id: c.id,
      status: c.status,
      referenceCode: c.referenceCode,
      effectiveDateIso: c.effectiveDate.toISOString(),
    })),
  };

  return (
    <EmployeeProfileShell employee={employee} departments={departments} documentCenter={documentCenter} />
  );
}

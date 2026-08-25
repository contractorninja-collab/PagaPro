import { prisma } from "@/lib/prisma";
import type { CompanyContext } from "@/server/company-context";
import { canDownloadSalaryBearingDocument } from "@/server/salary-redaction";

/**
 * May this viewer download this rendered document?
 *
 * A generated contract, annex or termination letter CONTAINS the salary —
 * the file's bytes bypass every DTO redactor, so the check must sit on the
 * download. Per-employee: a STANDARD viewer handles regular staff's
 * documents and is refused the confidential ones; NONE gets none of the
 * salary-bearing kinds; vërejtje and other amount-free categories stay open
 * to every member.
 */
export async function viewerMayDownloadArtifact(
  context: CompanyContext,
  artifact: { documentCategory: string; employeeId: string | null },
): Promise<boolean> {
  const viewer = { salaryAccess: context.salaryAccess };
  const employee = artifact.employeeId
    ? await prisma.employee.findFirst({
        where: { id: artifact.employeeId, companyId: context.companyId },
        select: { salaryConfidential: true },
      })
    : null;
  return canDownloadSalaryBearingDocument(viewer, artifact.documentCategory, employee);
}

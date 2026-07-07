import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { JobTitleUpsertInput } from "@/modules/job-titles/validation/job-title-schemas";

export interface JobTitleDto {
  id: string;
  title: string;
  department: string | null;
  level: string | null;
  description: string;
  responsibilities: string | null;
  requirements: string | null;
  status: "ACTIVE" | "ARCHIVED";
  employeeCount: number;
}

export interface JobTitleOptionDto {
  id: string;
  title: string;
  department: string | null;
  level: string | null;
  description: string;
  responsibilities: string | null;
  requirements: string | null;
  status: "ACTIVE" | "ARCHIVED";
}

export type JobTitleMutationResult =
  | { ok: true; id: string }
  | { ok: false; code: "DUPLICATE_TITLE" | "NOT_FOUND" | "DB_ERROR"; message?: string };

function duplicateTitle(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

function normalizeNullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function listJobTitlesForCompany(companyId: string): Promise<JobTitleDto[]> {
  const rows = await prisma.jobTitle.findMany({
    where: { companyId },
    orderBy: [{ status: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      department: true,
      level: true,
      description: true,
      responsibilities: true,
      requirements: true,
      status: true,
      _count: { select: { employees: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    department: row.department,
    level: row.level,
    description: row.description,
    responsibilities: row.responsibilities,
    requirements: row.requirements,
    status: row.status,
    employeeCount: row._count.employees,
  }));
}

export async function listActiveJobTitleOptions(companyId: string): Promise<JobTitleOptionDto[]> {
  const rows = await prisma.jobTitle.findMany({
    where: { companyId, status: "ACTIVE" },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      department: true,
      level: true,
      description: true,
      responsibilities: true,
      requirements: true,
      status: true,
    },
  });

  return rows;
}

export async function upsertJobTitle(
  companyId: string,
  input: JobTitleUpsertInput,
  actorUserId: string | null,
): Promise<JobTitleMutationResult> {
  const data = {
    title: input.title.trim(),
    department: normalizeNullable(input.department),
    level: normalizeNullable(input.level),
    description: input.description.trim(),
    responsibilities: normalizeNullable(input.responsibilities),
    requirements: normalizeNullable(input.requirements),
    updatedByUserId: actorUserId ?? null,
  };

  try {
    if (input.id) {
      const row = await prisma.jobTitle.updateMany({
        where: { id: input.id, companyId },
        data,
      });
      if (row.count === 0) return { ok: false, code: "NOT_FOUND" };
      return { ok: true, id: input.id };
    }

    const row = await prisma.jobTitle.create({
      data: {
        companyId,
        ...data,
        createdByUserId: actorUserId ?? null,
      },
      select: { id: true },
    });
    return { ok: true, id: row.id };
  } catch (err) {
    if (duplicateTitle(err)) return { ok: false, code: "DUPLICATE_TITLE" };
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, code: "DB_ERROR", message };
  }
}

export async function setJobTitleArchived(
  companyId: string,
  id: string,
  archived: boolean,
  actorUserId: string | null,
): Promise<JobTitleMutationResult> {
  try {
    const row = await prisma.jobTitle.updateMany({
      where: { id, companyId },
      data: {
        status: archived ? "ARCHIVED" : "ACTIVE",
        updatedByUserId: actorUserId ?? null,
      },
    });
    if (row.count === 0) return { ok: false, code: "NOT_FOUND" };
    return { ok: true, id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, code: "DB_ERROR", message };
  }
}

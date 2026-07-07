import { z } from "zod";

export const departmentNameSchema = z
  .string()
  .trim()
  .min(1, "Emri i departamentit është i detyrueshëm.")
  .max(120, "Emri i departamentit nuk mund të kalojë 120 karaktere.");

export const createDepartmentSchema = z.object({
  name: departmentNameSchema,
});

export const renameDepartmentSchema = z.object({
  id: z.string().min(1),
  name: departmentNameSchema,
});

export const deleteDepartmentSchema = z.object({
  id: z.string().min(1),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type RenameDepartmentInput = z.infer<typeof renameDepartmentSchema>;

import { z } from "zod";

const emptyToNull = (v: unknown): unknown => {
  if (v === "" || v === undefined) return null;
  return v;
};

export const jobTitleUpsertSchema = z.object({
  id: z.string().cuid().optional(),
  title: z.string().trim().min(1, "Titulli i pozitës është i detyrueshëm").max(120),
  department: z.preprocess(emptyToNull, z.string().trim().max(120).nullable().optional()),
  level: z.preprocess(emptyToNull, z.string().trim().max(60).nullable().optional()),
  description: z.string().trim().min(1, "Përshkrimi i punës është i detyrueshëm").max(10000),
  responsibilities: z.preprocess(emptyToNull, z.string().trim().max(10000).nullable().optional()),
  requirements: z.preprocess(emptyToNull, z.string().trim().max(10000).nullable().optional()),
});

export const jobTitleIdSchema = z.object({
  id: z.string().cuid(),
});

export type JobTitleUpsertInput = z.infer<typeof jobTitleUpsertSchema>;

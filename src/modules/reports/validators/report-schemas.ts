import { z } from "zod";

/** Shared optional filters used across multiple report types */
export const payrollPeriodFilterSchema = z.object({
  payrollId: z.string().min(1),
});

export type PayrollPeriodFilters = z.infer<typeof payrollPeriodFilterSchema>;

export const employeeListFilterSchema = z.object({
  departmentId: z.string().optional(),
  employeeId: z.string().optional(),
  employmentStatus: z.enum(["ACTIVE", "INACTIVE", "ON_LEAVE", "SUSPENDED", "TERMINATED"]).optional(),
  employmentType: z.enum(["EMPLOYEE", "CONTRACTOR"]).optional(),
});

export type EmployeeListFilters = z.infer<typeof employeeListFilterSchema>;

export const dateRangeFilterSchema = z
  .object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  })
  .refine(
    (v) => {
      if (v.startDate && v.endDate) return new Date(v.startDate) <= new Date(v.endDate);
      return true;
    },
    { message: "Periudha e datës është e pavlefshme." },
  );

export type DateRangeFilters = z.infer<typeof dateRangeFilterSchema>;

export const leaveYearFilterSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  employeeId: z.string().optional(),
  departmentId: z.string().optional(),
});

export type LeaveYearFilters = z.infer<typeof leaveYearFilterSchema>;

export const contractExpiryFilterSchema = z.object({
  daysAhead: z.coerce.number().int().min(1).max(730).default(60),
  departmentId: z.string().optional(),
});

export type ContractExpiryFilters = z.infer<typeof contractExpiryFilterSchema>;

export const documentListFilterSchema = z.object({
  employeeId: z.string().optional(),
  documentCategory: z.enum(["CONTRACT", "LEAVE", "TERMINATION", "WARNING", "PAYROLL", "OTHER"]).optional(),
  includeArchived: z.boolean().optional(),
});

export type DocumentListFilters = z.infer<typeof documentListFilterSchema>;

export const terminationMonthFilterSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

export type TerminationMonthFilters = z.infer<typeof terminationMonthFilterSchema>;

export const emptyFilterSchema = z.object({});

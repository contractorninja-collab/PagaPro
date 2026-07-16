import type { EmploymentStatus } from "@prisma/client";

export type EmployeeImportRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  personalId: string;
  dateOfBirthIso: string | null;
  hireDateIso: string;
  baseSalaryMonthly: string;
  bankName: string | null;
  iban: string | null;
  intendedStatus: Extract<EmploymentStatus, "ACTIVE" | "INACTIVE">;
  errors: string[];
};

export type EmployeeImportPreview = {
  rows: EmployeeImportRow[];
  totals: {
    total: number;
    valid: number;
    invalid: number;
  };
};

export type EmployeeImportCommitResult = {
  imported: number;
  skipped: number;
  rows: Array<{
    rowNumber: number;
    personalId: string;
    employeeId: string | null;
    imported: boolean;
    errors: string[];
  }>;
};

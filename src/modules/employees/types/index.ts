import type {
  CompensationBasis,
  EmployeeHistoryEventKind,
  EmploymentStatus,
  EmploymentType,
  Gender,
  WorkArrangement,
} from "@prisma/client";

export type {
  EmployeeHistoryEventKind,
  EmploymentStatus,
  EmploymentType,
  Gender,
  WorkArrangement,
};

/** Row for list / table */
export interface EmployeeListRowDto {
  id: string;
  firstName: string;
  lastName: string;
  personalId: string;
  email: string | null;
  jobTitle: string | null;
  jobTitleId: string | null;
  jobDescription: string | null;
  departmentId: string | null;
  departmentName: string | null;
  status: EmploymentStatus;
  employmentType: EmploymentType;
  baseSalaryMonthly: string;
  hireDate: string;
}

export interface EmployeeEmergencyContactDto {
  fullName: string;
  phone: string;
  relationship: string;
}

/** Full detail for profile / edit form */
export interface EmployeeDetailDto {
  id: string;
  firstName: string;
  lastName: string;
  personalId: string;
  dateOfBirth: string | null;
  gender: Gender | null;
  phone: string | null;
  email: string | null;
  addressLine: string | null;
  addressCity: string | null;
  addressCountry: string | null;
  departmentId: string | null;
  departmentName: string | null;
  jobTitle: string | null;
  jobTitleId: string | null;
  jobDescription: string | null;
  jobResponsibilities: string | null;
  jobRequirements: string | null;
  jobTitleStatus: "ACTIVE" | "ARCHIVED" | null;
  probationMonths: number | null;
  hireDate: string;
  status: EmploymentStatus;
  employmentType: EmploymentType;
  workArrangement: WorkArrangement;
  baseSalaryMonthly: string;
  weeklyHours: string;
  bankName: string | null;
  bankAccountIban: string | null;
  applyTrust: boolean;
  applyTax: boolean;
  isForeignNational: boolean;
  residencePermitExpiryDate: string | null;
  workplace: string | null;
  qualification: string | null;
  badgeCode: string | null;
  emergencyContact: EmployeeEmergencyContactDto | null;
  internalNotes: string | null;
  documentsMissing: boolean;
  terminationDate: string | null;
  terminationReason: string | null;
  salaryHistory: SalaryChangeDto[];
}

export interface SalaryChangeDto {
  id: string;
  effectiveFromIso: string;
  previousBaseSalary: string | null;
  newBaseSalary: string;
  compensationBasis: CompensationBasis;
  targetNetMonthly: string | null;
  reason: string | null;
  createdAtIso: string;
}

export interface DepartmentOptionDto {
  id: string;
  name: string;
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

/**
 * Company-wide totals, deliberately independent of the active filters — the
 * stat strip states what the company is, not what the current query returned.
 * Everything except `terminated` counts the live roster only.
 */
export interface EmployeeCountsDto {
  total: number;
  active: number;
  onLeave: number;
  contractors: number;
  documentsMissing: number;
  terminated: number;
}

export interface EmployeesPageDataDto {
  employees: EmployeeListRowDto[];
  departments: DepartmentOptionDto[];
  jobTitles: JobTitleOptionDto[];
  counts: EmployeeCountsDto;
}

export interface EmployeeFiltersDto {
  search?: string;
  /** `""` hides leavers (the default roster view); `"ALL"` includes them. */
  status?: EmploymentStatus | "" | "ALL";
  employmentType?: EmploymentType | "";
  departmentId?: string | "";
  documentsMissing?: boolean;
}

import type {
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
  emergencyContact: EmployeeEmergencyContactDto | null;
  internalNotes: string | null;
  documentsMissing: boolean;
  terminationDate: string | null;
  terminationReason: string | null;
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

export interface EmployeesPageDataDto {
  employees: EmployeeListRowDto[];
  departments: DepartmentOptionDto[];
  jobTitles: JobTitleOptionDto[];
}

export interface EmployeeFiltersDto {
  search?: string;
  status?: EmploymentStatus | "";
  employmentType?: EmploymentType | "";
  departmentId?: string | "";
  documentsMissing?: boolean;
}

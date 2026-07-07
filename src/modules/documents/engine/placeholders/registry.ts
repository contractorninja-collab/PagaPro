import type { DocumentCategory } from "../types";

export type PlaceholderSource =
  | "employee"
  | "company"
  | "company_setting"
  | "authorized_rep"
  | "document_metadata"
  | "contract_runtime";

export interface PlaceholderDefinition {
  key: string;
  requiredByDefault: boolean;
  sources: PlaceholderSource[];
  /** When set, this definition only applies if its category is requested in `composePlaceholderRegistry`. */
  applicableCategories?: DocumentCategory[];
  labelSq: string;
}

const CORE_DEFINITIONS: PlaceholderDefinition[] = [
  {
    key: "employee_name",
    requiredByDefault: true,
    sources: ["employee"],
    labelSq: "Emri i punonjësit",
  },
  {
    key: "employee_personal_number",
    requiredByDefault: true,
    sources: ["employee"],
    labelSq: "Numri personal",
  },
  {
    key: "employee_last_name",
    requiredByDefault: false,
    sources: ["employee"],
    labelSq: "Mbiemri",
  },
  {
    key: "employee_position",
    requiredByDefault: false,
    sources: ["employee"],
    labelSq: "Pozita",
  },
  {
    key: "employee_job_description",
    requiredByDefault: false,
    sources: ["employee"],
    labelSq: "Përshkrimi i punës",
  },
  {
    key: "employee_job_responsibilities",
    requiredByDefault: false,
    sources: ["employee"],
    labelSq: "Përgjegjësitë e punës",
  },
  {
    key: "employee_job_requirements",
    requiredByDefault: false,
    sources: ["employee"],
    labelSq: "Kërkesat e punës",
  },
  {
    key: "employee_department",
    requiredByDefault: false,
    sources: ["employee"],
    labelSq: "Departamenti",
  },
  {
    key: "employee_address",
    requiredByDefault: false,
    sources: ["employee"],
    labelSq: "Adresa e punonjësit",
  },
  {
    key: "salary_gross",
    requiredByDefault: true,
    sources: ["employee"],
    labelSq: "Paga bruto",
  },
  {
    key: "daily_hours",
    requiredByDefault: false,
    sources: ["employee"],
    labelSq: "Orët ditore",
  },
  {
    key: "weekly_hours",
    requiredByDefault: false,
    sources: ["employee"],
    labelSq: "Orët javore",
  },
  {
    key: "monthly_hours",
    requiredByDefault: false,
    sources: ["employee"],
    labelSq: "Orët mujore",
  },
  {
    key: "company_name",
    requiredByDefault: true,
    sources: ["company"],
    labelSq: "Emri i kompanisë",
  },
  {
    key: "company_nui",
    requiredByDefault: false,
    sources: ["company"],
    labelSq: "NUI (numri fiskal)",
  },
  {
    key: "company_nrb",
    requiredByDefault: false,
    sources: ["company"],
    labelSq: "NRB",
  },
  {
    key: "company_address",
    requiredByDefault: false,
    sources: ["company_setting"],
    labelSq: "Adresa e kompanisë",
  },
  {
    key: "authorized_person",
    requiredByDefault: false,
    sources: ["authorized_rep", "company_setting"],
    labelSq: "Personi i autorizuar",
  },
  {
    key: "authorized_person_name",
    requiredByDefault: false,
    sources: ["authorized_rep", "company_setting"],
    labelSq: "Emri i personit të autorizuar",
  },
  {
    key: "authorized_position",
    requiredByDefault: false,
    sources: ["authorized_rep", "company_setting"],
    labelSq: "Pozita e personit të autorizuar",
  },
  {
    key: "authorized_person_position",
    requiredByDefault: false,
    sources: ["authorized_rep", "company_setting"],
    labelSq: "Pozita e personit të autorizuar",
  },
  {
    key: "document_date",
    requiredByDefault: false,
    sources: ["document_metadata"],
    labelSq: "Data e dokumentit",
  },
  {
    key: "document_place",
    requiredByDefault: false,
    sources: ["document_metadata", "company"],
    labelSq: "Vendi i nënshkrimit",
  },
  {
    key: "company_registered_address",
    requiredByDefault: false,
    sources: ["company_setting"],
    applicableCategories: ["CONTRACT"],
    labelSq: "Adresa e regjistruar",
  },
];

const CATEGORY_EXTENSIONS: Record<DocumentCategory, PlaceholderDefinition[]> = {
  CONTRACT: [
    {
      key: "contract_start_date",
      requiredByDefault: true,
      sources: ["contract_runtime", "document_metadata"],
      applicableCategories: ["CONTRACT"],
      labelSq: "Data e fillimit të kontratës",
    },
    {
      key: "contract_end_date",
      requiredByDefault: false,
      sources: ["contract_runtime", "document_metadata"],
      applicableCategories: ["CONTRACT"],
      labelSq: "Data e mbarimit të kontratës",
    },
    {
      key: "employment_start_date",
      requiredByDefault: false,
      sources: ["contract_runtime"],
      applicableCategories: ["CONTRACT"],
      labelSq: "Data e fillimit të punës",
    },
    {
      key: "probation_end_date",
      requiredByDefault: false,
      sources: ["contract_runtime"],
      applicableCategories: ["CONTRACT"],
      labelSq: "Data e mbarimit të punës provuese",
    },
    {
      key: "travel_compensation",
      requiredByDefault: false,
      sources: ["contract_runtime"],
      applicableCategories: ["CONTRACT"],
      labelSq: "Kompensimi i udhëtimit zyrtar",
    },
    {
      key: "probation_months",
      requiredByDefault: false,
      sources: ["employee"],
      applicableCategories: ["CONTRACT"],
      labelSq: "Muajt e punÃ«s praktike",
    },
    {
      key: "probation_period",
      requiredByDefault: false,
      sources: ["employee"],
      applicableCategories: ["CONTRACT"],
      labelSq: "Periudha e punÃ«s praktike",
    },
  ],
  LEAVE: [
    {
      key: "leave_start_date",
      requiredByDefault: true,
      sources: ["document_metadata"],
      applicableCategories: ["LEAVE"],
      labelSq: "Fillimi i pushimit",
    },
    {
      key: "leave_end_date",
      requiredByDefault: true,
      sources: ["document_metadata"],
      applicableCategories: ["LEAVE"],
      labelSq: "Mbarimi i pushimit",
    },
    {
      key: "leave_type",
      requiredByDefault: false,
      sources: ["document_metadata"],
      applicableCategories: ["LEAVE"],
      labelSq: "Lloji i pushimit",
    },
    {
      key: "leave_status",
      requiredByDefault: false,
      sources: ["document_metadata"],
      applicableCategories: ["LEAVE"],
      labelSq: "Statusi i kërkesës",
    },
    {
      key: "leave_note",
      requiredByDefault: false,
      sources: ["document_metadata"],
      applicableCategories: ["LEAVE"],
      labelSq: "Shënim",
    },
  ],
  TERMINATION: [
    {
      key: "termination_date",
      requiredByDefault: true,
      sources: ["document_metadata"],
      applicableCategories: ["TERMINATION"],
      labelSq: "Data e largimit",
    },
    {
      key: "last_working_day",
      requiredByDefault: true,
      sources: ["document_metadata"],
      applicableCategories: ["TERMINATION"],
      labelSq: "Dita e fundit e punës",
    },
    {
      key: "termination_details",
      requiredByDefault: false,
      sources: ["document_metadata"],
      applicableCategories: ["TERMINATION"],
      labelSq: "Detajet e largimit",
    },
    {
      key: "termination_type",
      requiredByDefault: false,
      sources: ["document_metadata"],
      applicableCategories: ["TERMINATION"],
      labelSq: "Lloji i ndërprerjes",
    },
    {
      key: "termination_notice_days",
      requiredByDefault: false,
      sources: ["document_metadata"],
      applicableCategories: ["TERMINATION"],
      labelSq: "Ditët e njoftimit",
    },
    {
      key: "termination_severance",
      requiredByDefault: false,
      sources: ["document_metadata"],
      applicableCategories: ["TERMINATION"],
      labelSq: "Kompensimi",
    },
    {
      key: "termination_reason",
      requiredByDefault: false,
      sources: ["document_metadata"],
      applicableCategories: ["TERMINATION"],
      labelSq: "Arsyeja",
    },
    {
      key: "termination_status",
      requiredByDefault: false,
      sources: ["document_metadata"],
      applicableCategories: ["TERMINATION"],
      labelSq: "Statusi",
    },
    {
      key: "termination_last_working_day",
      requiredByDefault: false,
      sources: ["document_metadata"],
      applicableCategories: ["TERMINATION"],
      labelSq: "Dita e fundit e punës (legacy)",
    },
  ],
  WARNING: [
    {
      key: "warning_issued_at",
      requiredByDefault: true,
      sources: ["document_metadata"],
      applicableCategories: ["WARNING"],
      labelSq: "Data e lëshimit",
    },
    {
      key: "warning_summary",
      requiredByDefault: true,
      sources: ["document_metadata"],
      applicableCategories: ["WARNING"],
      labelSq: "Përmbledhje",
    },
    {
      key: "warning_severity",
      requiredByDefault: false,
      sources: ["document_metadata"],
      applicableCategories: ["WARNING"],
      labelSq: "Rëndësia",
    },
    {
      key: "warning_status",
      requiredByDefault: false,
      sources: ["document_metadata"],
      applicableCategories: ["WARNING"],
      labelSq: "Statusi",
    },
  ],
  PAYROLL: [
    {
      key: "payroll_month_name",
      requiredByDefault: false,
      sources: ["document_metadata"],
      applicableCategories: ["PAYROLL"],
      labelSq: "Muaji i pagës",
    },
    {
      key: "payroll_year",
      requiredByDefault: false,
      sources: ["document_metadata"],
      applicableCategories: ["PAYROLL"],
      labelSq: "Viti",
    },
    {
      key: "payroll_period_label",
      requiredByDefault: false,
      sources: ["document_metadata"],
      applicableCategories: ["PAYROLL"],
      labelSq: "Periudha",
    },
    {
      key: "document_date",
      requiredByDefault: true,
      sources: ["document_metadata"],
      applicableCategories: ["PAYROLL"],
      labelSq: "Data e dokumentit",
    },
  ],
  OTHER: [
    {
      key: "document_date",
      requiredByDefault: false,
      sources: ["document_metadata"],
      applicableCategories: ["OTHER"],
      labelSq: "Data e dokumentit",
    },
    {
      key: "document_title",
      requiredByDefault: false,
      sources: ["document_metadata"],
      applicableCategories: ["OTHER"],
      labelSq: "Titulli",
    },
  ],
};

function definitionsForCategories(categories: DocumentCategory[]): PlaceholderDefinition[] {
  const uniq = [...new Set(categories)];
  const list: PlaceholderDefinition[] = [...CORE_DEFINITIONS];
  for (const c of uniq) {
    list.push(...CATEGORY_EXTENSIONS[c]);
  }
  return list;
}

/**
 * Merge core placeholders plus every extension bucket for the listed categories.
 * Later duplicates overwrite earlier entries (last wins).
 */
export function composePlaceholderRegistry(
  categories: DocumentCategory[],
): Record<string, PlaceholderDefinition> {
  const out: Record<string, PlaceholderDefinition> = {};
  for (const def of definitionsForCategories(categories)) {
    if (
      def.applicableCategories &&
      def.applicableCategories.length > 0 &&
      !def.applicableCategories.some((c) => categories.includes(c))
    ) {
      continue;
    }
    out[def.key] = def;
  }
  return out;
}

export function getRegistryForCategory(category: DocumentCategory): Record<string, PlaceholderDefinition> {
  return composePlaceholderRegistry([category]);
}

/** Full CONTRACT-shaped registry (core + employment agreement dates) — closest to legacy behavior */
export const CANONICAL_PLACEHOLDER_REGISTRY = composePlaceholderRegistry(["CONTRACT"]);

export function isCanonicalPlaceholderKey(
  key: string,
  registry: Record<string, PlaceholderDefinition> = CANONICAL_PLACEHOLDER_REGISTRY,
): boolean {
  return Object.prototype.hasOwnProperty.call(registry, key);
}

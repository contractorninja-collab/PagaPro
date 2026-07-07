import type { EmploymentStatus, EmploymentType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { EMPLOYMENT_STATUS_LABELS, EMPLOYMENT_TYPE_LABELS } from "@/modules/employees/components/employees-labels";

/** Badge për status HR — Kontraktor aktiv shfaqet veçmas sipas kërkesës së produktit */
export function EmployeeStatusBadge({
  status,
  employmentType,
}: {
  status: EmploymentStatus;
  employmentType: EmploymentType;
}) {
  if (status === "TERMINATED") {
    return <Badge variant="destructive">{EMPLOYMENT_STATUS_LABELS.TERMINATED}</Badge>;
  }
  if (status === "INACTIVE") {
    return <Badge variant="muted">{EMPLOYMENT_STATUS_LABELS.INACTIVE}</Badge>;
  }
  if (status === "ON_LEAVE") {
    return <Badge variant="info">{EMPLOYMENT_STATUS_LABELS.ON_LEAVE}</Badge>;
  }
  if (status === "SUSPENDED") {
    return <Badge variant="warning">{EMPLOYMENT_STATUS_LABELS.SUSPENDED}</Badge>;
  }
  if (employmentType === "CONTRACTOR") {
    return <Badge variant="muted">{EMPLOYMENT_TYPE_LABELS.CONTRACTOR}</Badge>;
  }
  return <Badge variant="success">{EMPLOYMENT_STATUS_LABELS.ACTIVE}</Badge>;
}

export function EmployeeTypeBadge({ employmentType }: { employmentType: EmploymentType }) {
  return <Badge variant="muted">{EMPLOYMENT_TYPE_LABELS[employmentType]}</Badge>;
}

/** Dokumentacion i paplotë / mungon */
export function MissingDocsBadge(props: { label?: string }) {
  return <Badge variant="warning">{props.label ?? "Dokumentacion i paplotë"}</Badge>;
}

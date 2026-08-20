import type { EmploymentStatus, EmploymentType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { StatusPill, type StatusTone } from "@/components/patterns/status-pill";
import { EMPLOYMENT_STATUS_LABELS, EMPLOYMENT_TYPE_LABELS } from "@/modules/employees/components/employees-labels";

const STATUS_TONES: Record<EmploymentStatus, StatusTone> = {
  ACTIVE: "success",
  ON_LEAVE: "info",
  SUSPENDED: "warning",
  TERMINATED: "destructive",
  INACTIVE: "neutral",
};

/**
 * Status HR si StatusPill — e njëjta familje vizuale (ngjyra + pika) si
 * statuset e pagave, pushimeve dhe dokumenteve. Kontraktori aktiv shfaqet
 * veçmas sipas kërkesës së produktit.
 */
export function EmployeeStatusBadge({
  status,
  employmentType,
}: {
  status: EmploymentStatus;
  employmentType: EmploymentType;
}) {
  if (status === "ACTIVE" && employmentType === "CONTRACTOR") {
    return <StatusPill tone="neutral">{EMPLOYMENT_TYPE_LABELS.CONTRACTOR}</StatusPill>;
  }
  return <StatusPill tone={STATUS_TONES[status]}>{EMPLOYMENT_STATUS_LABELS[status]}</StatusPill>;
}

/** Etiketë lloji (jo status) — mbetet Badge pa pikë. */
export function EmployeeTypeBadge({ employmentType }: { employmentType: EmploymentType }) {
  return <Badge variant="muted">{EMPLOYMENT_TYPE_LABELS[employmentType]}</Badge>;
}

import type { DocumentCategory } from "@prisma/client";

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  CONTRACT: "Kontratë",
  LEAVE: "Pushim",
  TERMINATION: "Ndërprerje",
  WARNING: "Vërejtje",
  PAYROLL: "Pagë",
  OTHER: "Tjetër",
};

export function formatArtifactKind(kind: string): string {
  if (kind === "PREVIEW") return "Parapamje";
  if (kind === "ARCHIVED_FINAL") return "Final";
  return kind;
}

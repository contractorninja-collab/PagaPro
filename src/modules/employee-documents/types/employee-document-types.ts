import type { EmployeeDocumentCategory } from "@prisma/client";

/** Serialized dossier row for the profile shell (client component). */
export interface EmployeeUploadedDocSummary {
  id: string;
  category: EmployeeDocumentCategory;
  title: string;
  note: string | null;
  displayFilename: string;
  contentType: string;
  sizeBytes: number;
  issuedAtIso: string | null;
  expiresAtIso: string | null;
  isArchived: boolean;
  createdAtIso: string;
  createdAtLabel: string;
  uploadedByName: string | null;
  inlinePreviewable: boolean;
}

export interface EmployeeDossierBundle {
  employeeId: string;
  /** Whether the viewer may see MJEKESORE/DISIPLINORE — decided server-side; the rows are already filtered. */
  viewerSeesSensitive: boolean;
  documents: EmployeeUploadedDocSummary[];
}

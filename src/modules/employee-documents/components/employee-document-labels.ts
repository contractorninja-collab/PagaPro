import type { EmployeeDocumentCategory } from "@prisma/client";

export const EMPLOYEE_DOCUMENT_CATEGORY_LABELS: Record<EmployeeDocumentCategory, string> = {
  IDENTIFIKIM: "Identifikim",
  KONTRATA_TE_NENSHKRUARA: "Kontrata të nënshkruara",
  KUALIFIKIME: "Kualifikime",
  MJEKESORE: "Mjekësore",
  DISIPLINORE: "Disiplinore",
  DEKLARATA_PELQIME: "Deklarata & pëlqime",
  TJERA: "Të tjera",
};

export const EMPLOYEE_DOCUMENT_CATEGORY_HINTS: Record<EmployeeDocumentCategory, string> = {
  IDENTIFIKIM: "Letërnjoftim, pasaportë, leje qëndrimi, leje pune",
  KONTRATA_TE_NENSHKRUARA: "Skanime të kontratave dhe anekseve të nënshkruara",
  KUALIFIKIME: "Diploma, certifikata, licenca",
  MJEKESORE: "Kontrolle sistematike, raporte mjekësore — vetëm për rolet me leje",
  DISIPLINORE: "Vërejtje të nënshkruara, procesverbale — vetëm për rolet me leje",
  DEKLARATA_PELQIME: "Pëlqime për të dhënat personale, deklarata të brendshme",
  TJERA: "Çdo dokument tjetër i dosjes",
};

/** Stable folder order for the dossier — identity papers first. */
export const EMPLOYEE_DOCUMENT_CATEGORY_ORDER: readonly EmployeeDocumentCategory[] = [
  "IDENTIFIKIM",
  "KONTRATA_TE_NENSHKRUARA",
  "KUALIFIKIME",
  "DEKLARATA_PELQIME",
  "MJEKESORE",
  "DISIPLINORE",
  "TJERA",
];

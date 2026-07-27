/**
 * The 25 columns of Libri i Pagave, in the official order.
 *
 * One list, two renderings: the CSV/XLSX exports print `headerSq` — the exact
 * strings the ATK book uses — while the PDF prints `headerPrint`, abbreviated so
 * 25 columns stay legible on A3. Keeping both on one row makes it impossible for
 * the printed book and the exported file to drift apart.
 */
export type LibriPagaveBand =
  | "IDENTIFIKIMI"
  | "ORET_E_RREGULLTA"
  | "ORET_ME_RRITJE"
  | "CMIMET_ME_RRITJE"
  | "BRUTO"
  | "TRUSTI"
  | "TATIMI"
  | "NETO";

export interface LibriPagaveColumn {
  /** Matches a key on `LibriPagaveRow` (plus `nr`, which mirrors `idp`). */
  key: string;
  /** Official Albanian header — CSV and XLSX. */
  headerSq: string;
  /** Abbreviated header — the printed A3 book. */
  headerPrint: string;
  /** 1-based column number as the ATK book numbers them. */
  index: number;
  band: LibriPagaveBand;
  align: "left" | "right";
}

export const LIBRI_PAGAVE_COLUMNS: readonly LibriPagaveColumn[] = [
  { key: "idp", headerSq: "IDP (1)", headerPrint: "IDP (1)", index: 1, band: "IDENTIFIKIMI", align: "left" },
  { key: "nr", headerSq: "Nr. (2)", headerPrint: "Nr. (2)", index: 2, band: "IDENTIFIKIMI", align: "left" },
  { key: "fullName", headerSq: "Emri dhe mbiemri (3)", headerPrint: "Emri dhe mbiemri (3)", index: 3, band: "IDENTIFIKIMI", align: "left" },
  { key: "sektori", headerSq: "Sektori (4)", headerPrint: "Sektori (4)", index: 4, band: "IDENTIFIKIMI", align: "left" },
  { key: "primacy", headerSq: "Për pun. të dytë shkr. 2 (5)", headerPrint: "Pun. 2 (5)", index: 5, band: "IDENTIFIKIMI", align: "left" },
  { key: "hourlyRate", headerSq: "Çmimi për Orë të rregullta (6)", headerPrint: "Çmimi/orë (6)", index: 6, band: "ORET_E_RREGULLTA", align: "right" },
  { key: "regularHours", headerSq: "Totali i Orëve të rregullta të realizuara (7)", headerPrint: "Orë të realiz. (7)", index: 7, band: "ORET_E_RREGULLTA", align: "right" },
  { key: "regularGross", headerSq: "Paga Bruto për orë të rregullta 6 x 7 (8)", headerPrint: "Bruto 6×7 (8)", index: 8, band: "ORET_E_RREGULLTA", align: "right" },
  { key: "overtimeNightHours", headerSq: "J - Jashtë orarit dhe Natën (9)", headerPrint: "J · jasht./natë (9)", index: 9, band: "ORET_ME_RRITJE", align: "right" },
  { key: "onCallHours", headerSq: "K - Kujdestari (10)", headerPrint: "K · kujdest. (10)", index: 10, band: "ORET_ME_RRITJE", align: "right" },
  { key: "holidayWeekendHours", headerSq: "F - Festave/Fundjav. (11)", headerPrint: "F · fest./fundj. (11)", index: 11, band: "ORET_ME_RRITJE", align: "right" },
  { key: "overtimeNightRate", headerSq: "Çmimi për Orë me rritje 30% J (12)", headerPrint: "+30% J (12)", index: 12, band: "CMIMET_ME_RRITJE", align: "right" },
  { key: "onCallRate", headerSq: "Çmimi për Orë me rritje 20% K (13)", headerPrint: "+20% K (13)", index: 13, band: "CMIMET_ME_RRITJE", align: "right" },
  { key: "holidayWeekendRate", headerSq: "Çmimi për Orë me rritje 50% F (14)", headerPrint: "+50% F (14)", index: 14, band: "CMIMET_ME_RRITJE", align: "right" },
  { key: "premiumPay", headerSq: "Paga Bruto Shtesë 9 x 12 + 10 x 13 + 11 x 14 (15)", headerPrint: "Bruto shtesë (15)", index: 15, band: "BRUTO", align: "right" },
  { key: "totalGross", headerSq: "TOTALI Paga Bruto 8 + 15 (16)", headerPrint: "TOTALI 8+15 (16)", index: 16, band: "BRUTO", align: "right" },
  { key: "employeeTrustPercent", headerSq: "Punëtori % (17)", headerPrint: "Pun. % (17)", index: 17, band: "TRUSTI", align: "right" },
  { key: "employerTrustPercent", headerSq: "Punëdhënësi % (18)", headerPrint: "P.dh. % (18)", index: 18, band: "TRUSTI", align: "right" },
  { key: "employeeTrustAmount", headerSq: "Punëtori 16 x 17 Euro (€) (19)", headerPrint: "Pun. € (19)", index: 19, band: "TRUSTI", align: "right" },
  { key: "employerTrustAmount", headerSq: "Punëdhënësi 16 x 18 Euro (€) (20)", headerPrint: "P.dh. € (20)", index: 20, band: "TRUSTI", align: "right" },
  { key: "taxableIncome", headerSq: "Paga që tatohet 16 - 19 Euro (€) (21)", headerPrint: "Bazë 16−19 (21)", index: 21, band: "TATIMI", align: "right" },
  { key: "taxAmount", headerSq: "TATIMI Euro (€) (22)", headerPrint: "TATIMI (22)", index: 22, band: "TATIMI", align: "right" },
  { key: "netIncome", headerSq: "PAGA NETO 21 - 22 Euro (€) (23)", headerPrint: "Neto 21−22 (23)", index: 23, band: "NETO", align: "right" },
  { key: "advance", headerSq: "Avans Euro (€) (24)", headerPrint: "Avans (24)", index: 24, band: "NETO", align: "right" },
  { key: "netToPay", headerSq: "Paga Neto për pagesë 23 - 24 Euro (€) (25)", headerPrint: "PËR PAGESË (25)", index: 25, band: "NETO", align: "right" },
] as const;

/** Band header spans, in column order — the grouped strip above the numbered header. */
export const LIBRI_PAGAVE_BANDS: ReadonlyArray<{ band: LibriPagaveBand; label: string; from: number; to: number }> = [
  { band: "IDENTIFIKIMI", label: "IDENTIFIKIMI", from: 1, to: 5 },
  { band: "ORET_E_RREGULLTA", label: "ORËT E RREGULLTA", from: 6, to: 8 },
  { band: "ORET_ME_RRITJE", label: "ORËT ME RRITJE", from: 9, to: 11 },
  { band: "CMIMET_ME_RRITJE", label: "ÇMIMET ME RRITJE", from: 12, to: 14 },
  { band: "BRUTO", label: "BRUTO", from: 15, to: 16 },
  { band: "TRUSTI", label: "TRUSTI", from: 17, to: 20 },
  { band: "TATIMI", label: "TATIMI", from: 21, to: 22 },
  { band: "NETO", label: "NETO", from: 23, to: 25 },
];

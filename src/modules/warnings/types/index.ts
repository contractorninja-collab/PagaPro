/** Masat disiplinore që PagaPRO lëshon si dokument (Ligji Nr. 03/L-212, neni 85.1). */
export const WARNING_MEASURES = ["VERBALE", "ME_SHKRIM"] as const;

export type WarningMeasure = (typeof WARNING_MEASURES)[number];

export const WARNING_MEASURE_OPTIONS: ReadonlyArray<{ value: WarningMeasure; label: string }> = [
  { value: "VERBALE", label: "Vërejtje me gojë (neni 85.1.1)" },
  { value: "ME_SHKRIM", label: "Vërejtje me shkrim (neni 85.1.2)" },
];

export interface WarningRow {
  id: string;
  issuedAt: string;
  summary: string;
  measure: WarningMeasure | null;
  improvementDeadline: string | null;
  status: string;
}

export type KonfigurimeTabId =
  | "kompania"
  | "autorizuari"
  | "departamentet"
  | "pozitat"
  | "pagat"
  | "festat"
  | "dokumentet"
  | "pushimet"
  | "njoftimet";

const KONFIGURIME_TAB_IDS = new Set<KonfigurimeTabId>([
  "kompania",
  "autorizuari",
  "departamentet",
  "pozitat",
  "pagat",
  "festat",
  "dokumentet",
  "pushimet",
  "njoftimet",
]);

export function parseKonfigurimeTabId(raw: string | undefined): KonfigurimeTabId {
  if (raw && KONFIGURIME_TAB_IDS.has(raw as KonfigurimeTabId)) {
    return raw as KonfigurimeTabId;
  }
  return "kompania";
}

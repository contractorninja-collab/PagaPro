export type KonfigurimeTabId =
  | "kompania"
  | "autorizuari"
  | "departamentet"
  | "pozitat"
  | "pagat"
  | "festat"
  | "dokumentet"
  | "pushimet"
  | "njoftimet"
  | "perdoruesit";

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
  "perdoruesit",
]);

export function parseKonfigurimeTabId(raw: string | undefined): KonfigurimeTabId {
  if (raw && KONFIGURIME_TAB_IDS.has(raw as KonfigurimeTabId)) {
    return raw as KonfigurimeTabId;
  }
  return "kompania";
}

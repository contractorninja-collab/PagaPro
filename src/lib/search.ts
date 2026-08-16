/**
 * Albanian-safe text matching for client-side filtering.
 *
 * Every search box in this app used `.toLowerCase().includes()`, which is wrong
 * for the language the app is written in: `ë` and `ç` are ordinary letters in
 * Albanian names, and nobody types them into a search box. "Recica" did not
 * match "REÇICA", "Krasniqi" did not match the cedilla spelling, and the person
 * you were looking for simply was not there.
 *
 * Both sides are folded, which is the part that is easy to get half-right:
 * folding only the haystack means typing the accented form fails instead.
 *
 * Lifted from `fold()` in modules/employees/constants/kosovo-banks.ts, minus its
 * NOISE_TOKENS list — that one drops words like "banka" and "shpk", which is
 * correct for matching bank names and quite wrong for matching people.
 */

/** U+0300–U+036F, the combining diacritical marks NFD splits `ë` and `ç` into. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/** Lowercase, unaccent, reduce punctuation to single spaces, trim. */
export function foldSq(raw: string | null | undefined): string {
  return String(raw ?? "")
    .toLocaleLowerCase("sq-AL")
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * True when every whitespace-separated term in `query` appears in any of the
 * given fields. Terms are ANDed, so "arta shitje" finds Arta in Sales without
 * caring which field holds which word, and word order does not matter.
 *
 * An empty query matches everything — callers filter unconditionally and let
 * this decide, rather than each guessing the empty case.
 *
 * Substring, not token-prefix: "eqir" finds "Beqiri". Punctuation folds to a
 * space, so "O'Brien" becomes "o brien" and searching "obrien" will NOT match.
 * That is a deliberate limit, not an oversight.
 */
export function matchesQuery(
  query: string | null | undefined,
  ...fields: (string | null | undefined)[]
): boolean {
  const needle = foldSq(query);
  if (needle === "") return true;
  const haystack = fields
    .map(foldSq)
    .filter((f) => f !== "")
    .join(" ");
  if (haystack === "") return false;
  return needle.split(" ").every((term) => haystack.includes(term));
}

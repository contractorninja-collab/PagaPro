/**
 * Cookie names shared between the server page and the client controls.
 *
 * Deliberately a plain module: a constant exported from a `"use client"` file
 * arrives in a server component as a client-reference proxy, not the string, so
 * `cookies().get(THAT)` silently reads nothing. Keeping the name here means both
 * sides genuinely agree on it.
 */

/** "1" = the Paneli payroll hero is folded down to a strip. Presentation only. */
export const PAYROLL_HERO_COOKIE = "pp_paneli_cycle_collapsed";

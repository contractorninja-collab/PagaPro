/**
 * Reconciling fresh server data with what the client is in the middle of typing.
 *
 * The Konfigurimet page re-receives its whole DTO whenever anything revalidates
 * /konfigurime — and adding a job title or a department does exactly that, from
 * tabs of that same page. Copying the DTO straight into state therefore wipes
 * edits made on another tab, silently and with nothing to undo.
 *
 * The rule here is about the *server*, not the client: a value the server has
 * actually changed since the last sync is new information and wins; a value it
 * repeats is not, so whatever the client has typed over it stays.
 *
 * Testing the client side instead ("keep anything that differs from the server")
 * looks equivalent and is not: the save path rewrites what it stores —
 * `legalName` is trimmed, a bare domain gains `https://`, and Prisma returns
 * decimals at column scale, so `5` comes back as `5.0000`. Typed text therefore
 * never matches the server again, the field latches as edited for the life of
 * the page, and the form quietly stops showing what is stored — including a
 * colleague's later edit, which the next save would then write back over.
 */

/**
 * Takes every value the server has changed since `lastServer`; leaves the rest
 * as the client has them. Returns `current` unchanged when nothing moves, so
 * React can skip the re-render.
 */
export function applyServerChanges<T extends object>(
  current: T,
  lastServer: T,
  nextServer: T,
): T {
  let changed = false;
  const out = { ...current };
  for (const key of Object.keys(nextServer) as (keyof T)[]) {
    if (nextServer[key] === lastServer[key]) continue; // server repeated itself
    if (nextServer[key] === current[key]) continue; // already showing it
    out[key] = nextServer[key];
    changed = true;
  }
  return changed ? out : current;
}

/**
 * Representatives are a list rather than a flat record, so "untouched" means
 * the same people in the same order — that is the only shape the form can
 * produce without the client having changed something.
 */
export function representativesMatch(
  drafts: ReadonlyArray<{ employeeId: string | null }>,
  server: ReadonlyArray<{ employeeId: string | null }>,
): boolean {
  return (
    drafts.length === server.length &&
    drafts.every((d, i) => d.employeeId === server[i]?.employeeId)
  );
}

/**
 * The server list is authoritative, but the setup wizard creates people it has
 * not seen yet — dropping those would empty the signer dropdown mid-flow.
 */
export function mergeEmployeeOptions<T extends { id: string }>(
  current: ReadonlyArray<T>,
  nextServer: ReadonlyArray<T>,
): T[] {
  const unknownToServer = current.filter((e) => !nextServer.some((s) => s.id === e.id));
  return unknownToServer.length > 0 ? [...nextServer, ...unknownToServer] : [...nextServer];
}

import type { SemanticTone } from "@/modules/leaves/components/leave-ui";
import type { PushimetBalanceRowDto } from "@/modules/leaves/types/pushimet";
import { daysUntilIso, fmtDays, toNum } from "@/modules/leaves/helpers/leave-balance-view";

/**
 * Which employees a human actually needs to look at.
 *
 * The panel used to render one card per employee, and thirteen of eighteen were
 * identical. This decides which few are worth showing by default; the rest fold
 * away behind a count and stay reachable by search.
 *
 * ## Why not "low balance"
 *
 * The shipped heuristic was `available < 2 || available / total < 0.15`. Under
 * monthly accrual a twenty-day employee holds 1.70 days on 1 February, so that
 * rule painted the *entire* company amber for the first eight weeks of every
 * year, and it flagged new hires — the people most obviously fine.
 *
 * `remainingDays` rises monotonically all year (1.7 in February, 12.27 in
 * August, 20 in December), so any absolute threshold on it is a calendar test
 * wearing a balance costume. It is used here for exactly one thing: noticing it
 * went below zero, which is an event rather than a date.
 *
 * Capacity questions threshold on `projectedYearEndDays` instead, which is flat
 * across the year and moves only when somebody books or takes leave.
 *
 * Everything is a pure function of the row plus an injected `todayIso` — no
 * clock reads, so the rules are testable and the panel cannot hydrate to a
 * different answer than it server-rendered.
 */

/** Half of the 2dp the column stores, so a -0.001 rounding artefact is not "debt". */
const EPSILON = 0.005;

/** The engine's own carry-expiry window (annual-leave-entitlement-engine.ts:223). */
export const CARRY_EXPIRY_SOON_DAYS = 45;

/**
 * Inside two weeks there is no longer room to request, approve and schedule the
 * days before they are destroyed. Arbitrary; belongs in LeavePolicyParameterSet
 * beside the other warn* switches once it is worth a migration.
 */
export const CARRY_EXPIRY_CRITICAL_DAYS = 14;

/**
 * Unplanned days only become a problem once the year is too short to spend them.
 * Q4 leaves roughly thirteen working weeks — enough to schedule a block with
 * notice. Arbitrary in the same way as the constant above.
 */
export const SURPLUS_WARN_FROM_MONTH = 10;

/** Engine warning codes (validation-result.ts) this module reasons about by name. */
const FIRST_YEAR = "KOSOVO_FIRST_YEAR_ENTITLEMENT_WARN";
const MEDICAL_OVERLAP = "KOSOVO_ANNUAL_MEDICAL_OVERLAP";
const CARRY_EXPIRE = "KOSOVO_CARRY_EXPIRE_WARN";
const INSUFFICIENT_BALANCE = "KOSOVO_INSUFFICIENT_BALANCE_WARN";
const SPLIT_LEAVE = "KOSOVO_SPLIT_LEAVE_WARN";

/**
 * Codes that need no separate mention: either they are already expressed as a
 * numeric condition below (and derived live rather than from a possibly stale
 * persisted warning), or they report a favourable adjustment with nothing to
 * decide. MEDICAL_OVERLAP is the latter — Art 34 sick leave taken during annual
 * leave was not deducted, which is good news already in the numbers.
 */
const HANDLED_CODES = new Set([FIRST_YEAR, MEDICAL_OVERLAP, CARRY_EXPIRE, INSUFFICIENT_BALANCE, SPLIT_LEAVE]);

export type AttentionReasonKey =
  | "BALANCE_NEGATIVE"
  | "CARRY_EXPIRES_CRITICAL"
  | "PENDING_OVER_YEAR_END"
  | "CARRY_EXPIRES_SOON"
  | "CARRY_EXPIRED_STALE"
  | "YEAR_END_SURPLUS"
  | "PENDING_OVER_ACCRUED"
  | "ENGINE_WARNING";

export interface AttentionReason {
  key: AttentionReasonKey;
  /** Rank, ascending = worse. The row's severity is its lowest reason rank. */
  rank: number;
  /** Albanian, ready to render verbatim into a pill. */
  label: string;
  tone: SemanticTone;
  /** Days until the thing happens, for ordering. Null when not deadline-driven. */
  deadlineDays: number | null;
  /** How big the problem is, for ordering within a rank. */
  magnitude: number;
}

export interface AttentionVerdict {
  needsAttention: boolean;
  /** Worst first. Empty when the row is calm. */
  reasons: AttentionReason[];
  severity: number;
}

export interface AttentionContext {
  /** Server-supplied "today". Never read the clock in here. */
  todayIso: string;
  /** Time-gated rules apply only while looking at the live year. */
  currentYear: number;
  /** LeavePolicyParameterSet.splitLeaveMinWorkingDays (Art 37.6, default 10). */
  splitLeaveMinWorkingDays: number;
  /** LeavePolicyParameterSet.warnCarryOverExpiry. */
  warnCarryOverExpiry: boolean;
  /** LeavePolicyParameterSet.warnInsufficientBalance. */
  warnInsufficientBalance: boolean;
}

const CALM: AttentionVerdict = { needsAttention: false, reasons: [], severity: Number.MAX_SAFE_INTEGER };

export function evaluateBalanceAttention(
  row: PushimetBalanceRowDto,
  ctx: AttentionContext,
): AttentionVerdict {
  const reasons: AttentionReason[] = [];

  const remaining = toNum(row.remainingDays);
  const pending = toNum(row.pendingDays);
  const carry = toNum(row.carryOverDays);
  const projected = row.projectedYearEndDays != null ? toNum(row.projectedYearEndDays) : null;
  const codes = new Set(row.warningCodes ?? []);

  const liveYear = row.year === ctx.currentYear;
  const expiresIn = daysUntilIso(row.carryExpiresIso, ctx.todayIso);
  const month = Number(ctx.todayIso.slice(5, 7));

  /**
   * A first-year employee's small numbers are already explained, and the
   * explanation does not change: the engine measures tenure to 31 December, not
   * to today, so this warning is constant from the hire date until the year
   * rolls. Nothing a person can do resolves it — the Art 35 gate is statutory —
   * and its real effect already surfaces when a request is approved. So it
   * suppresses the two rules that would otherwise fire on the same facts.
   */
  const firstYear = codes.has(FIRST_YEAR);

  // 1 — Approved leave exceeded what was carried plus accrued. Only reachable
  // through a deliberate override, so its presence always means a decision.
  if (remaining < -EPSILON) {
    reasons.push({
      key: "BALANCE_NEGATIVE",
      rank: 1,
      label: `Bilanc negativ · ${fmtDays(Math.abs(remaining))} ditë borxh`,
      tone: "destructive",
      deadlineDays: null,
      magnitude: Math.abs(remaining),
    });
  }

  if (carry > 0 && expiresIn != null && liveYear && ctx.warnCarryOverExpiry) {
    if (expiresIn >= 0 && expiresIn <= CARRY_EXPIRY_CRITICAL_DAYS) {
      // 2 — Art 37.6: these days are destroyed on 30 June, not carried further.
      reasons.push({
        key: "CARRY_EXPIRES_CRITICAL",
        rank: 2,
        label: `Bartja skadon për ${expiresIn} ditë · ${fmtDays(carry)} ditë`,
        tone: "destructive",
        deadlineDays: expiresIn,
        magnitude: carry,
      });
    } else if (expiresIn > CARRY_EXPIRY_CRITICAL_DAYS && expiresIn <= CARRY_EXPIRY_SOON_DAYS) {
      // 4 — the engine's own 45-day window.
      reasons.push({
        key: "CARRY_EXPIRES_SOON",
        rank: 4,
        label: `Bartja skadon më 30 qershor · ${fmtDays(carry)} ditë`,
        tone: "warning",
        deadlineDays: expiresIn,
        magnitude: carry,
      });
    } else if (expiresIn < 0) {
      // 5 — the deadline passed but the row still counts the days, so the
      // balance beside the name is overstated. Balances only resync on approve,
      // revoke, or an explicit "Rifresko balancat".
      reasons.push({
        key: "CARRY_EXPIRED_STALE",
        rank: 5,
        label: `Bartja ka skaduar · rifreskoni balancat`,
        tone: "warning",
        deadlineDays: expiresIn,
        magnitude: carry,
      });
    }
  }

  // 3 — More is booked than the whole year will ever provide. Not a timing
  // problem: somebody has to shorten or refuse a request.
  if (projected != null && pending > projected + EPSILON) {
    reasons.push({
      key: "PENDING_OVER_YEAR_END",
      rank: 3,
      label: `Kërkesat tejkalojnë kuotën vjetore · ${fmtDays(pending)} vs ${fmtDays(projected)}`,
      tone: "destructive",
      deadlineDays: null,
      magnitude: pending - projected,
    });
  }

  // 6 — Unplanned days at the close of the year. They are not lost on
  // 31 December; they roll into next year's carry and die on 30 June, so this
  // is a scheduling problem with a six-month fuse. Below the Art 37.6 block
  // length there is nothing to schedule as one clean absence.
  if (
    projected != null &&
    liveYear &&
    !firstYear &&
    month >= SURPLUS_WARN_FROM_MONTH &&
    projected - pending >= ctx.splitLeaveMinWorkingDays
  ) {
    const surplus = projected - pending;
    reasons.push({
      key: "YEAR_END_SURPLUS",
      rank: 6,
      label: `${fmtDays(surplus)} ditë të paplanifikuara · barten dhe skadojnë më 30 qershor`,
      tone: "warning",
      deadlineDays: null,
      magnitude: surplus,
    });
  }

  // 7 — Booked beyond what is accrued so far, but within the year's total.
  // Approvable only as debt. Structurally impossible unless the company allows
  // negative balances, which is why it is worth seeing where it does appear.
  if (
    ctx.warnInsufficientBalance &&
    !firstYear &&
    pending > remaining + EPSILON &&
    (projected == null || pending <= projected + EPSILON)
  ) {
    reasons.push({
      key: "PENDING_OVER_ACCRUED",
      rank: 7,
      label: `Pritja tejkalon të akumuluarat · ${fmtDays(pending)} vs ${fmtDays(remaining)}`,
      tone: "warning",
      deadlineDays: null,
      magnitude: pending - remaining,
    });
  }

  // 8 — A warning the engine raised that no rule above models. Without this a
  // new code added to the engine would silently vanish from the panel.
  for (const code of codes) {
    if (HANDLED_CODES.has(code)) continue;
    reasons.push({
      key: "ENGINE_WARNING",
      rank: 8,
      label: "Paralajmërim nga rregullat e pushimit",
      tone: "neutral",
      deadlineDays: null,
      magnitude: 0,
    });
    break;
  }

  reasons.sort((a, b) => a.rank - b.rank);
  const worst = reasons[0];
  if (!worst) return CALM;
  return { needsAttention: true, reasons, severity: worst.rank };
}

/** The reason that decides a row's rank, colour and position. */
export function topReason(verdict: AttentionVerdict): AttentionReason | null {
  return verdict.reasons[0] ?? null;
}

export interface AttentionEntry {
  row: PushimetBalanceRowDto;
  verdict: AttentionVerdict;
}

/**
 * Total order, worst first. The name tiebreak is load-bearing rather than
 * decorative: without it the thirteen rows that share a state have no defined
 * order and reshuffle between renders.
 */
export function compareAttention(a: AttentionEntry, b: AttentionEntry): number {
  if (a.verdict.severity !== b.verdict.severity) return a.verdict.severity - b.verdict.severity;

  const ra = topReason(a.verdict);
  const rb = topReason(b.verdict);
  if (ra && rb) {
    // Nearest deadline first; rows without one sort after rows with one.
    const da = ra.deadlineDays;
    const db = rb.deadlineDays;
    if (da != null && db != null && da !== db) return da - db;
    if (da != null && db == null) return -1;
    if (da == null && db != null) return 1;
    if (ra.magnitude !== rb.magnitude) return rb.magnitude - ra.magnitude;
  }

  return a.row.employeeName.localeCompare(b.row.employeeName, "sq-AL");
}

export interface AttentionCohort {
  key: AttentionReasonKey;
  label: string;
  tone: SemanticTone;
  count: number;
}

/** A condition shared this widely is one campaign, not N individual decisions. */
const COHORT_SHARE = 0.25;
const COHORT_MIN_ROWS = 8;

/**
 * Collapses any condition that most of the company shares into a single strip.
 *
 * Without this the design fails exactly when it matters. On 1 October every
 * untouched employee trips YEAR_END_SURPLUS at once — thirteen of eighteen in
 * the current data — and the panel is a wall of identical rows again. When that
 * many people share one state the action is one scheduling campaign, so one
 * line is the honest rendering and thirteen rows imply thirteen judgement calls
 * that do not exist.
 *
 * BALANCE_NEGATIVE never collapses: if half a company is in day-debt, that many
 * rows is the appropriate amount of alarm.
 */
export function collapseCohorts(entries: AttentionEntry[]): {
  cohorts: AttentionCohort[];
  rows: AttentionEntry[];
} {
  const flagged = entries.filter((e) => e.verdict.needsAttention);
  if (flagged.length < COHORT_MIN_ROWS) return { cohorts: [], rows: flagged };

  const byTopReason = new Map<AttentionReasonKey, AttentionEntry[]>();
  for (const entry of flagged) {
    const top = topReason(entry.verdict);
    if (!top) continue;
    const bucket = byTopReason.get(top.key);
    if (bucket) bucket.push(entry);
    else byTopReason.set(top.key, [entry]);
  }

  const threshold = Math.max(COHORT_MIN_ROWS, Math.ceil(flagged.length * COHORT_SHARE));
  const collapsed = new Set<AttentionReasonKey>();
  const cohorts: AttentionCohort[] = [];

  for (const [key, bucket] of byTopReason) {
    if (key === "BALANCE_NEGATIVE" || bucket.length < threshold) continue;
    const sample = bucket[0] ? topReason(bucket[0].verdict) : null;
    collapsed.add(key);
    cohorts.push({
      key,
      label: cohortLabel(key, bucket.length),
      tone: sample?.tone ?? "warning",
      count: bucket.length,
    });
  }

  return {
    cohorts: cohorts.sort((a, b) => b.count - a.count),
    rows: flagged.filter((e) => {
      const top = topReason(e.verdict);
      return !top || !collapsed.has(top.key);
    }),
  };
}

/** "punonjës" is invariant here — 1 punonjës, 13 punonjës — so no plural branch. */
function cohortLabel(key: AttentionReasonKey, count: number): string {
  const people = "punonjës";
  switch (key) {
    case "YEAR_END_SURPLUS":
      return `${count} ${people} kanë ditë të paplanifikuara — barten dhe skadojnë më 30 qershor.`;
    case "CARRY_EXPIRES_SOON":
    case "CARRY_EXPIRES_CRITICAL":
      return `${count} ${people} kanë ditë të bartura që skadojnë më 30 qershor.`;
    case "CARRY_EXPIRED_STALE":
      return `${count} ${people} kanë bartje të skaduar — rifreskoni balancat.`;
    case "PENDING_OVER_ACCRUED":
      return `${count} ${people} kanë kërkesa mbi ditët e akumuluara deri sot.`;
    case "PENDING_OVER_YEAR_END":
      return `${count} ${people} kanë kërkesa mbi kuotën vjetore.`;
    default:
      return `${count} ${people} kërkojnë vëmendje.`;
  }
}

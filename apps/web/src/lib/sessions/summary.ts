import { parseAmount, type StatsMtt, type StatsSession } from 'poker-core';
import { ERROR_TAGS } from '@/lib/review/review';
import { isOneOf, readMtt, type MttInfo } from './form';

export const GRADES = ['A', 'B', 'C', 'D'] as const;
export const SELF_STATES = ['clear', 'tired', 'tilt'] as const;
export const BUST_STAGES = ['early', 'mid', 'bubble', 'itm', 'final_table'] as const;

export type Grade = (typeof GRADES)[number];
export type SelfState = (typeof SELF_STATES)[number];
export type BustStage = (typeof BUST_STAGES)[number];

/** Limits that keep a hand-edited or AI-filled summary small. */
export const SUMMARY_LIMITS = { good: 3, leaks: 3, rules: 4 } as const;
const LINE_MAX = 300;
const NOTES_MAX = 1000;

/** `sessions.summary` (spec 3.8). `leak_tags` is a flat list: the `leak_stats` view reads it so. */
export type SessionSummary = {
  grade: Grade | null;
  good: string[];
  leak_tags: string[];
  rules: string[];
  notes: string;
};

export const emptySummary = (): SessionSummary => ({
  grade: null,
  good: [],
  leak_tags: [],
  rules: [],
  notes: '',
});

const strings = (x: unknown, max: number): string[] =>
  Array.isArray(x)
    ? x
        .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
        .map((s) => s.trim().slice(0, LINE_MAX))
        .slice(0, max)
    : [];

/** Defensive read of `sessions.summary` jsonb. */
export function readSummary(json: unknown): SessionSummary {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return emptySummary();
  const o = json as Record<string, unknown>;
  return {
    grade: isOneOf(GRADES, o.grade) ? o.grade : null,
    good: strings(o.good, SUMMARY_LIMITS.good),
    leak_tags: strings(o.leak_tags, ERROR_TAGS.length).filter(isLeakTag),
    rules: strings(o.rules, SUMMARY_LIMITS.rules),
    notes: typeof o.notes === 'string' ? o.notes.slice(0, NOTES_MAX) : '',
  };
}

/** A tag that may be named as a leak: any fixed code except `none`. */
export const isLeakTag = (x: string): boolean => x !== 'none' && isOneOf(ERROR_TAGS, x);

/** MTT result fields kept in `sessions.mtt` next to the entry info (DEC-039). */
export type MttResult = {
  reentries: number;
  place: number | null;
  entries: number | null;
  prize: number | null;
  bounty: number | null;
  bust_stage: BustStage | null;
};

export function readMttResult(json: unknown): MttResult {
  const o =
    json && typeof json === 'object' && !Array.isArray(json)
      ? (json as Record<string, unknown>)
      : {};
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  const reentries = num(o.reentries);
  return {
    reentries: reentries != null && Number.isInteger(reentries) && reentries >= 0 ? reentries : 0,
    place: num(o.place),
    entries: num(o.entries),
    prize: num(o.prize),
    bounty: num(o.bounty),
    bust_stage: isOneOf(BUST_STAGES, o.bust_stage) ? o.bust_stage : null,
  };
}

/** The `sessions` columns {@link toStatsSession} needs. */
export const STATS_COLUMNS =
  'id, kind, mode, venue, stake_label, currency, chip_value, chip_currency, bb, date, start_at, end_at, buyin, cashout, stop_loss, self_state, mtt';

export type StatsRow = {
  id: string;
  kind: string;
  mode: string;
  venue: string | null;
  stake_label: string | null;
  currency: string;
  chip_value?: number | null;
  chip_currency?: string | null;
  bb: number | null;
  date: string;
  start_at: string | null;
  end_at: string | null;
  buyin: number | null;
  cashout: number | null;
  stop_loss: number | null;
  self_state: string | null;
  mtt: unknown;
};

export function toStatsSession(r: StatsRow): StatsSession {
  const result = readMttResult(r.mtt);
  const mtt: StatsMtt | null =
    r.kind === 'mtt'
      ? {
          reentries: result.reentries,
          prize: result.prize,
          bounty: result.bounty,
          place: result.place,
          entries: result.entries,
          bustStage: result.bust_stage,
        }
      : null;
  return {
    id: r.id,
    kind: r.kind === 'mtt' ? 'mtt' : 'cash',
    mode: r.mode === 'live' ? 'live' : 'online',
    venue: r.venue,
    stakeLabel: r.stake_label,
    currency: r.currency,
    bb: r.bb ?? 0,
    date: r.date,
    startAt: r.start_at,
    endAt: r.end_at,
    buyin: r.buyin,
    cashout: r.cashout,
    stopLoss: r.stop_loss,
    selfState: r.self_state,
    mtt,
    ...(r.currency === 'CHIP' &&
      r.chip_value != null &&
      r.chip_currency && { chipRate: { value: r.chip_value, currency: r.chip_currency } }),
  };
}

export type SummaryFormValues = {
  cashout: string;
  grade: string;
  selfState: string;
  /** One item per line. */
  good: string;
  leaks: string[];
  /** One item per line. */
  rules: string;
  notes: string;
  place: string;
  entries: string;
  prize: string;
  bounty: string;
  reentries: string;
  bustStage: string;
};

export type SummaryField = keyof SummaryFormValues;
export type SummaryErrors = Partial<Record<SummaryField, 'invalid' | 'required'>>;

export const SUMMARY_TEXT_FIELDS = [
  'cashout',
  'grade',
  'selfState',
  'good',
  'rules',
  'notes',
  'place',
  'entries',
  'prize',
  'bounty',
  'reentries',
  'bustStage',
] as const satisfies readonly SummaryField[];

export const emptySummaryForm = (): SummaryFormValues => ({
  cashout: '',
  grade: '',
  selfState: '',
  good: '',
  leaks: [],
  rules: '',
  notes: '',
  place: '',
  entries: '',
  prize: '',
  bounty: '',
  reentries: '',
  bustStage: '',
});

const lines = (s: string, max: number) =>
  s
    .split('\n')
    .map((l) => l.trim().slice(0, LINE_MAX))
    .filter(Boolean)
    .slice(0, max);

const joined = (list: string[]) => list.join('\n');

/** Form values for a saved session, so the page can be edited again. */
export function summaryFormFrom(row: {
  kind: string;
  cashout: number | null;
  self_state: string | null;
  summary: unknown;
  mtt: unknown;
}): SummaryFormValues {
  const s = readSummary(row.summary);
  const m = readMttResult(row.mtt);
  const str = (n: number | null) => (n == null ? '' : String(n));
  return {
    cashout: row.kind === 'cash' ? str(row.cashout) : '',
    grade: s.grade ?? '',
    selfState: isOneOf(SELF_STATES, row.self_state) ? row.self_state : '',
    good: joined(s.good),
    leaks: s.leak_tags,
    rules: joined(s.rules),
    notes: s.notes,
    place: str(m.place),
    entries: str(m.entries),
    prize: str(m.prize),
    bounty: str(m.bounty),
    reentries: m.reentries ? String(m.reentries) : '',
    bustStage: m.bust_stage ?? '',
  };
}

export type SummaryParsed = {
  cashout: number | null;
  self_state: SelfState | null;
  summary: SessionSummary;
  mttResult: MttResult;
};

export type SummaryParse =
  { ok: true; value: SummaryParsed } | { ok: false; errors: SummaryErrors };

/**
 * Validate the summary form. Cash needs a cash-out (0 is a valid cash-out: busted); for MTT the
 * prize is the result (0 = out of the money). Everything else is optional.
 */
export function parseSummaryForm(v: SummaryFormValues, kind: 'cash' | 'mtt'): SummaryParse {
  const errors: SummaryErrors = {};
  const money = (field: SummaryField, raw: string, required = false): number | null => {
    if (!raw.trim()) {
      if (required) errors[field] = 'required';
      return null;
    }
    const n = parseAmount(raw);
    if (n == null || n < 0) {
      errors[field] = 'invalid';
      return null;
    }
    return n;
  };
  const count = (field: SummaryField, raw: string): number | null => {
    if (!raw.trim()) return null;
    const n = Number(raw.trim());
    if (!Number.isInteger(n) || n < 0) {
      errors[field] = 'invalid';
      return null;
    }
    return n;
  };

  const cashout = kind === 'cash' ? money('cashout', v.cashout, true) : null;
  const prize = kind === 'mtt' ? money('prize', v.prize, true) : null;
  const bounty = kind === 'mtt' ? money('bounty', v.bounty) : null;
  const place = kind === 'mtt' ? count('place', v.place) : null;
  const entries = kind === 'mtt' ? count('entries', v.entries) : null;
  const reentries = kind === 'mtt' ? count('reentries', v.reentries) : null;

  if (v.grade && !isOneOf(GRADES, v.grade)) errors.grade = 'invalid';
  if (v.selfState && !isOneOf(SELF_STATES, v.selfState)) errors.selfState = 'invalid';
  if (v.bustStage && !isOneOf(BUST_STAGES, v.bustStage)) errors.bustStage = 'invalid';
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      cashout,
      self_state: isOneOf(SELF_STATES, v.selfState) ? v.selfState : null,
      summary: {
        grade: isOneOf(GRADES, v.grade) ? v.grade : null,
        good: lines(v.good, SUMMARY_LIMITS.good),
        leak_tags: [...new Set(v.leaks.filter(isLeakTag))].slice(0, ERROR_TAGS.length),
        rules: lines(v.rules, SUMMARY_LIMITS.rules),
        notes: v.notes.trim().slice(0, NOTES_MAX),
      },
      mttResult: {
        reentries: reentries ?? 0,
        place,
        entries,
        prize,
        bounty,
        bust_stage: isOneOf(BUST_STAGES, v.bustStage) ? v.bustStage : null,
      },
    },
  };
}

/** The `sessions.mtt` jsonb after saving: entry info kept, result fields replaced. */
export function mergeMtt(existing: unknown, result: MttResult): (MttInfo & MttResult) | null {
  const info = readMtt(existing);
  return info ? { ...info, ...result } : null;
}

/**
 * The session as the form shows it right now: result and state typed but not saved yet override
 * the stored ones. Values that do not parse are ignored (the stored value stays).
 */
export function applyFormToStats(
  base: StatsSession,
  v: Partial<
    Pick<
      SummaryFormValues,
      'cashout' | 'selfState' | 'prize' | 'bounty' | 'place' | 'entries' | 'reentries' | 'bustStage'
    >
  >,
): StatsSession {
  const amount = (raw: string | undefined): number | null => {
    const n = raw?.trim() ? parseAmount(raw) : null;
    return n != null && n >= 0 ? n : null;
  };
  const count = (raw: string | undefined): number | null => {
    const n = raw?.trim() ? Number(raw.trim()) : NaN;
    return Number.isInteger(n) && n >= 0 ? n : null;
  };
  const m = base.mtt;
  return {
    ...base,
    selfState: isOneOf(SELF_STATES, v.selfState) ? v.selfState : base.selfState,
    cashout: base.kind === 'cash' ? (amount(v.cashout) ?? base.cashout) : base.cashout,
    mtt:
      base.kind === 'mtt' && m
        ? {
            reentries: count(v.reentries) ?? m.reentries,
            prize: amount(v.prize) ?? m.prize,
            bounty: amount(v.bounty) ?? m.bounty,
            place: count(v.place) ?? m.place,
            entries: count(v.entries) ?? m.entries,
            bustStage: isOneOf(BUST_STAGES, v.bustStage) ? v.bustStage : m.bustStage,
          }
        : m,
  };
}

/** Typed when leaving the table: the result and how the player felt (DEC-044). */
export const END_FIELDS = [
  'cashout',
  'selfState',
  'place',
  'entries',
  'prize',
  'bounty',
  'reentries',
  'bustStage',
] as const satisfies readonly SummaryField[];

/** Typed in the debrief after reviewing hands (DEC-044). */
export const NOTE_FIELDS = [
  'grade',
  'good',
  'rules',
  'notes',
] as const satisfies readonly SummaryField[];

export type EndParse =
  | { ok: true; value: Pick<SummaryParsed, 'cashout' | 'self_state' | 'mttResult'> }
  | { ok: false; errors: SummaryErrors };

/** Validate only the "end session" fields; the debrief fields are left out of the check. */
export function parseEndForm(v: SummaryFormValues, kind: 'cash' | 'mtt'): EndParse {
  const end = emptySummaryForm();
  for (const field of END_FIELDS) end[field] = v[field];
  const parsed = parseSummaryForm(end, kind);
  if (!parsed.ok) return parsed;
  const { cashout, self_state, mttResult } = parsed.value;
  return { ok: true, value: { cashout, self_state, mttResult } };
}

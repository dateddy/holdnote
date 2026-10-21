import {
  blindLevelsToJson,
  parseAmount,
  readBlindLevels,
  roundMoney,
  startRow,
  type BlindLevel,
  type BlindLevelJson,
} from 'poker-core';

export const KINDS = ['cash', 'mtt'] as const;
export const MODES = ['live', 'online'] as const;
export const CURRENCIES = ['VND', 'USD', 'EUR', 'KRW', 'JPY', 'THB', 'CHIP'] as const;
/** Units offered on the form: Chip first (what a live game plays in), then the currencies. */
export const UNIT_OPTIONS = ['CHIP', 'VND', 'USD', 'EUR', 'KRW', 'JPY', 'THB'] as const;
/** Currencies a chip can be valued in. */
export const CHIP_RATE_CURRENCIES = CURRENCIES.filter((c) => c !== 'CHIP');
export const ANTE_MODES = ['none', 'each', 'bb'] as const;
export const MTT_TYPES = ['regular', 'bounty', 'turbo', 'satellite'] as const;

export type Kind = (typeof KINDS)[number];
export type Currency = (typeof CURRENCIES)[number];
export type AnteMode = (typeof ANTE_MODES)[number];
export type MttType = (typeof MTT_TYPES)[number];

/** Raw form fields, exactly as typed. Amounts accept `1k5`, `18.000`, `0.02` (poker-core). */
export type SessionFormValues = {
  kind: string;
  mode: string;
  currency: string;
  /** Optional "1 chip = …" rate of a CHIP session: the number and the currency it is in. */
  chipValue: string;
  chipCurrency: string;
  venue: string;
  /** Local date `YYYY-MM-DD` from the browser; empty = database default. */
  date: string;
  sb: string;
  bb: string;
  straddle: string;
  anteMode: string;
  ante: string;
  seats: string;
  buyin: string;
  stopLoss: string;
  mttName: string;
  mttType: string;
  /** Checkbox: `on` when ticked. */
  mttReentry: string;
  mttStartLevel: string;
  mttStartStack: string;
  /** Blind structure as JSON (`sessions.mtt.blind_levels`); empty = none. */
  mttBlindLevels: string;
};

export type SessionField = keyof SessionFormValues;
export type FieldError = 'required' | 'invalid' | 'positive' | 'sbAboveBb' | 'seatsRange';
export type FormErrors = Partial<Record<SessionField, FieldError>>;

/** `sessions.mtt` (spec 4: name, type, re-entry, start level…). Blinds of the start level live in sb/bb/ante. */
export type MttInfo = {
  name: string | null;
  type: MttType;
  reentry: boolean;
  start_level: number | null;
  /** Chips. */
  start_stack: number | null;
  /** Optional blind structure, one row per level (spec 5). */
  blind_levels?: BlindLevelJson[];
};

export type SessionInsertRow = {
  kind: Kind;
  mode: (typeof MODES)[number];
  currency: Currency;
  chip_value: number | null;
  chip_currency: Currency | null;
  venue: string | null;
  date?: string;
  stake_label: string | null;
  sb: number | null;
  bb: number | null;
  straddle: number | null;
  ante_mode: AnteMode;
  ante: number | null;
  seats: number | null;
  buyin: number | null;
  stop_loss: number | null;
  mtt: MttInfo | null;
};

export type ParseResult =
  { ok: true; insert: SessionInsertRow } | { ok: false; errors: FormErrors };

export const SESSION_FIELDS = [
  'kind',
  'mode',
  'currency',
  'chipValue',
  'chipCurrency',
  'venue',
  'date',
  'sb',
  'bb',
  'straddle',
  'anteMode',
  'ante',
  'seats',
  'buyin',
  'stopLoss',
  'mttName',
  'mttType',
  'mttReentry',
  'mttStartLevel',
  'mttStartStack',
  'mttBlindLevels',
] as const satisfies readonly SessionField[];

export function emptyForm(currency: string): SessionFormValues {
  return {
    kind: 'cash',
    mode: 'live',
    currency: isOneOf(CURRENCIES, currency) ? currency : 'VND',
    chipValue: '',
    chipCurrency: '',
    venue: '',
    date: '',
    sb: '',
    bb: '',
    straddle: '',
    anteMode: 'none',
    ante: '',
    seats: '',
    buyin: '',
    stopLoss: '',
    mttName: '',
    mttType: 'regular',
    mttReentry: '',
    mttStartLevel: '',
    mttStartStack: '',
    mttBlindLevels: '',
  };
}

export function parseSessionForm(v: SessionFormValues): ParseResult {
  const errors: FormErrors = {};
  const fail = (field: SessionField, error: FieldError) => {
    errors[field] ??= error;
  };

  if (!isOneOf(KINDS, v.kind)) fail('kind', 'invalid');
  if (!isOneOf(MODES, v.mode)) fail('mode', 'invalid');
  if (!isOneOf(CURRENCIES, v.currency)) fail('currency', 'invalid');
  const kind: Kind = v.kind === 'mtt' ? 'mtt' : 'cash';

  /** Optional amount: null when empty, > 0 (or >= 0) otherwise. */
  const amount = (field: SessionField, { allowZero = false } = {}): number | null => {
    const raw = v[field].trim();
    if (!raw) return null;
    const n = parseAmount(raw);
    if (n == null) return (fail(field, 'invalid'), null);
    if (n < 0 || (!allowZero && n === 0)) return (fail(field, 'positive'), null);
    return roundMoney(n);
  };

  // Blind structure (MTT, optional). With one, the start level sets the session blinds and ante:
  // what the form carries over from the last session or has typed is not used.
  let levels: BlindLevel[] = [];
  if (kind === 'mtt' && v.mttBlindLevels.trim()) {
    try {
      const parsed: unknown = JSON.parse(v.mttBlindLevels);
      if (!Array.isArray(parsed)) throw new Error('not a list');
      levels = readBlindLevels(parsed);
    } catch {
      fail('mttBlindLevels', 'invalid');
    }
  }
  const startN = Number(v.mttStartLevel.trim());
  const start = startRow(
    levels,
    v.mttStartLevel.trim() && Number.isInteger(startN) ? startN : null,
  );

  let sb: number | null;
  let bb: number | null;
  let anteMode: AnteMode;
  let ante: number | null;
  if (start) {
    sb = start.sb;
    bb = start.bb;
    anteMode = start.anteMode;
    ante = start.ante > 0 ? start.ante : null;
  } else {
    sb = amount('sb', { allowZero: true });
    bb = amount('bb');
    if (bb == null && !errors.bb && (kind === 'cash' || sb != null)) fail('bb', 'required');
    if (sb != null && bb != null && sb > bb) fail('sb', 'sbAboveBb');

    anteMode = isOneOf(ANTE_MODES, v.anteMode) ? v.anteMode : 'none';
    if (!isOneOf(ANTE_MODES, v.anteMode)) fail('anteMode', 'invalid');
    ante = anteMode === 'none' ? null : amount('ante');
    if (anteMode !== 'none' && ante == null) fail('ante', 'required');
  }
  const straddle = kind === 'cash' ? amount('straddle') : null;

  // "1 chip = …": only on a CHIP session, number and currency together; empty = no rate.
  let chipValue: number | null = null;
  let chipCurrency: Currency | null = null;
  if (v.currency === 'CHIP' && v.chipValue.trim()) {
    chipValue = rate(v.chipValue);
    if (chipValue == null) fail('chipValue', 'positive');
    if (isOneOf(CHIP_RATE_CURRENCIES, v.chipCurrency)) chipCurrency = v.chipCurrency;
    else fail('chipCurrency', 'required');
  }

  let seats: number | null = null;
  if (v.seats.trim()) {
    const n = Number(v.seats.trim());
    if (Number.isInteger(n) && n >= 2 && n <= 10) seats = n;
    else fail('seats', 'seatsRange');
  }

  const buyin = amount('buyin', { allowZero: true });
  const stopLoss = kind === 'cash' ? amount('stopLoss') : null;

  let mtt: MttInfo | null = null;
  if (kind === 'mtt') {
    if (!isOneOf(MTT_TYPES, v.mttType)) fail('mttType', 'invalid');
    let startLevel: number | null = null;
    if (v.mttStartLevel.trim()) {
      const n = Number(v.mttStartLevel.trim());
      if (!Number.isInteger(n)) fail('mttStartLevel', 'invalid');
      else if (n <= 0) fail('mttStartLevel', 'positive');
      else startLevel = n;
    }
    mtt = {
      name: v.mttName.trim() || null,
      type: isOneOf(MTT_TYPES, v.mttType) ? v.mttType : 'regular',
      reentry: v.mttReentry === 'on',
      start_level: startLevel,
      start_stack: amount('mttStartStack'),
      ...(levels.length > 0 && { blind_levels: blindLevelsToJson(levels) }),
    };
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const insert: SessionInsertRow = {
    kind,
    mode: v.mode as SessionInsertRow['mode'],
    currency: v.currency as Currency,
    chip_value: chipValue,
    chip_currency: chipCurrency,
    venue: v.venue.trim() || null,
    stake_label:
      kind === 'cash' && bb != null
        ? [sb ?? 0, bb, ...(straddle != null ? [straddle] : [])].map(String).join('/')
        : null,
    sb,
    bb,
    straddle,
    ante_mode: anteMode,
    ante,
    seats,
    buyin,
    stop_loss: stopLoss,
    mtt,
  };
  if (/^\d{4}-\d{2}-\d{2}$/.test(v.date)) insert.date = v.date;
  return { ok: true, insert };
}

/** A rate such as `1000` or `0.5`: more than 0, four decimals at most (`sessions.chip_value`). */
function rate(raw: string): number | null {
  const n = parseAmount(raw.trim());
  return n != null && n > 0 ? Math.round(n * 10000) / 10000 : null;
}

/** Fields of a previous session that pre-fill the form (spec 3.4). */
export type PrefillSource = {
  kind: string;
  mode: string;
  currency: string;
  chip_value?: number | null;
  chip_currency?: string | null;
  venue: string | null;
  sb: number | null;
  bb: number | null;
  straddle: number | null;
  ante_mode: string;
  ante: number | null;
  seats: number | null;
  buyin: number | null;
  stop_loss: number | null;
  mtt: unknown;
};

/** Columns to select for {@link prefillFrom}. */
export const PREFILL_COLUMNS =
  'kind, mode, currency, chip_value, chip_currency, venue, sb, bb, straddle, ante_mode, ante, seats, buyin, stop_loss, mtt';

/** Form values copied from the previous session of the same kind; never date or results. */
export function prefillFrom(
  prev: PrefillSource | null,
  profileCurrency: string,
): SessionFormValues {
  const base = emptyForm(profileCurrency);
  if (!prev) return base;
  const str = (n: number | null) => (n == null ? '' : String(n));
  const mtt = readMtt(prev.mtt);
  return {
    ...base,
    kind: isOneOf(KINDS, prev.kind) ? prev.kind : base.kind,
    mode: isOneOf(MODES, prev.mode) ? prev.mode : base.mode,
    currency: isOneOf(CURRENCIES, prev.currency) ? prev.currency : base.currency,
    chipValue: str(prev.chip_value ?? null),
    chipCurrency: isOneOf(CHIP_RATE_CURRENCIES, prev.chip_currency) ? prev.chip_currency : '',
    venue: prev.venue ?? '',
    sb: str(prev.sb),
    bb: str(prev.bb),
    straddle: str(prev.straddle),
    anteMode: isOneOf(ANTE_MODES, prev.ante_mode) ? prev.ante_mode : 'none',
    ante: str(prev.ante),
    seats: str(prev.seats),
    buyin: str(prev.buyin),
    stopLoss: str(prev.stop_loss),
    ...(mtt && {
      mttName: mtt.name ?? '',
      mttType: mtt.type,
      mttReentry: mtt.reentry ? 'on' : '',
      mttStartLevel: str(mtt.start_level),
      mttStartStack: str(mtt.start_stack),
    }),
  };
}

/** Defensive read of `sessions.mtt` jsonb. */
export function readMtt(json: unknown): MttInfo | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const o = json as Record<string, unknown>;
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  const levels = readBlindLevels(o.blind_levels);
  return {
    name: typeof o.name === 'string' ? o.name : null,
    type: isOneOf(MTT_TYPES, o.type) ? o.type : 'regular',
    reentry: o.reentry === true,
    start_level: num(o.start_level),
    start_stack: num(o.start_stack),
    ...(levels.length > 0 && { blind_levels: blindLevelsToJson(levels) }),
  };
}

export function isOneOf<T extends string>(list: readonly T[], x: unknown): x is T {
  return typeof x === 'string' && (list as readonly string[]).includes(x);
}

/** Form values of a saved session, for editing: like {@link prefillFrom} but the date is kept. */
export function editFormFrom(
  row: PrefillSource & { date: string },
  profileCurrency: string,
): SessionFormValues {
  return { ...prefillFrom(row, profileCurrency), date: row.date };
}

/**
 * `sessions.mtt` after an edit: the setup comes from the form, the result fields (prize, place,
 * re-entries...) stay. The blind structure is whatever the form carries, so an emptied editor removes it.
 */
export function mergeMttUpdate(
  existing: unknown,
  next: MttInfo | null,
): Record<string, unknown> | null {
  if (!next) return null;
  const old =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  delete old.blind_levels;
  return { ...old, ...next };
}

/**
 * Unit a new session starts with: Chip for a live cash game, otherwise the profile's currency
 * (a profile currency of CHIP means VND, since an online game is played in money).
 */
export function defaultUnit(kind: string, mode: string, profileCurrency: string): Currency {
  if (kind === 'cash' && mode === 'live') return 'CHIP';
  return isOneOf(CHIP_RATE_CURRENCIES, profileCurrency) ? profileCurrency : 'VND';
}

export type SummaryLabels = {
  kind: Record<Kind, string>;
  mode: Record<(typeof MODES)[number], string>;
  chip: string;
  straddle: string;
  ante: string;
  /** "1 chip = {value}", where value already carries the currency. */
  chipRate: (value: string) => string;
  formatMoney: (amount: number, currency: string) => string;
};

/**
 * One line that says what the form will create, e.g. "Cash · Live · Chip · 20/50 · straddle 100".
 * The units are named here once, so the fields themselves carry none.
 */
export function sessionSummaryLine(v: SessionFormValues, l: SummaryLabels): string {
  const kind = isOneOf(KINDS, v.kind) ? v.kind : 'cash';
  const mode = isOneOf(MODES, v.mode) ? v.mode : 'live';
  const parts = [l.kind[kind], l.mode[mode], v.currency === 'CHIP' ? l.chip : v.currency];
  const sb = v.sb.trim();
  const bb = v.bb.trim();
  if (bb) parts.push(sb ? `${sb}/${bb}` : bb);
  if (kind === 'cash' && v.straddle.trim()) parts.push(`${l.straddle} ${v.straddle.trim()}`);
  if (v.anteMode !== 'none' && v.ante.trim()) {
    parts.push(`${l.ante} ${v.ante.trim()}${v.anteMode === 'bb' ? ' BB' : ''}`);
  }
  const n = v.currency === 'CHIP' ? rate(v.chipValue) : null;
  if (n != null && isOneOf(CHIP_RATE_CURRENCIES, v.chipCurrency)) {
    parts.push(l.chipRate(l.formatMoney(n, v.chipCurrency)));
  }
  return parts.join(' · ');
}

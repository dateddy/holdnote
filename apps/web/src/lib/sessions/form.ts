import { parseAmount, roundMoney } from 'poker-core';

export const KINDS = ['cash', 'mtt'] as const;
export const MODES = ['live', 'online'] as const;
export const CURRENCIES = ['VND', 'USD', 'EUR', 'KRW', 'JPY', 'THB', 'CHIP'] as const;
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
};

export type SessionInsertRow = {
  kind: Kind;
  mode: (typeof MODES)[number];
  currency: Currency;
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
] as const satisfies readonly SessionField[];

export function emptyForm(currency: string): SessionFormValues {
  return {
    kind: 'cash',
    mode: 'live',
    currency: isOneOf(CURRENCIES, currency) ? currency : 'VND',
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

  const sb = amount('sb', { allowZero: true });
  const bb = amount('bb');
  const straddle = kind === 'cash' ? amount('straddle') : null;
  if (bb == null && !errors.bb && (kind === 'cash' || sb != null)) fail('bb', 'required');
  if (sb != null && bb != null && sb > bb) fail('sb', 'sbAboveBb');

  const anteMode: AnteMode = isOneOf(ANTE_MODES, v.anteMode) ? v.anteMode : 'none';
  if (!isOneOf(ANTE_MODES, v.anteMode)) fail('anteMode', 'invalid');
  const ante = anteMode === 'none' ? null : amount('ante');
  if (anteMode !== 'none' && ante == null) fail('ante', 'required');

  let seats: number | null = null;
  if (kind === 'cash' && v.seats.trim()) {
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
    };
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const insert: SessionInsertRow = {
    kind,
    mode: v.mode as SessionInsertRow['mode'],
    currency: v.currency as Currency,
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

/** Fields of a previous session that pre-fill the form (spec 3.4). */
export type PrefillSource = {
  kind: string;
  mode: string;
  currency: string;
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
  'kind, mode, currency, venue, sb, bb, straddle, ante_mode, ante, seats, buyin, stop_loss, mtt';

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
  return {
    name: typeof o.name === 'string' ? o.name : null,
    type: isOneOf(MTT_TYPES, o.type) ? o.type : 'regular',
    reentry: o.reentry === true,
    start_level: num(o.start_level),
    start_stack: num(o.start_stack),
  };
}

export function isOneOf<T extends string>(list: readonly T[], x: unknown): x is T {
  return typeof x === 'string' && (list as readonly string[]).includes(x);
}

import { parseAmount } from '../amount';
import { normalizePosition } from '../positions';
import type { PlayerAct, Position, Verb } from '../types';

/** Who a token names, before hero/villain positions are known. */
export type ActorRef =
  | { kind: 'hero' }
  | { kind: 'villain' }
  | { kind: 'label'; who: string }
  | { kind: 'pos'; pos: Position };

export type Token =
  | { type: 'actor'; ref: ActorRef; raw: string }
  | { type: 'act'; act: PlayerAct; verb?: Verb; amount?: number; raw: string }
  | { type: 'bad_amount'; raw: string }
  | { type: 'word'; raw: string };

interface VerbDef {
  act: PlayerAct;
  verb?: Verb;
  /** Calls, checks and folds never carry a meaningful amount. */
  sized: boolean;
}

const VERBS: Record<string, VerbDef> = {
  o: { act: 'raise', verb: 'open', sized: true },
  lp: { act: 'call', verb: 'limp', sized: false },
  x: { act: 'check', sized: false },
  b: { act: 'bet', sized: true },
  c: { act: 'call', sized: false },
  r: { act: 'raise', sized: true },
  l: { act: 'bet', verb: 'lead', sized: true },
  '3b': { act: 'raise', verb: '3bet', sized: true },
  '4b': { act: 'raise', verb: '4bet', sized: true },
  '5b': { act: 'raise', verb: '5bet', sized: true },
  cr: { act: 'raise', verb: 'check-raise', sized: true },
  ai: { act: 'all-in', sized: true },
  f: { act: 'fold', sized: false },
  d: { act: 'bet', verb: 'donk', sized: true },
};

/** Words found in real notes, mapped onto the spec codes. */
const ALIASES: Record<string, keyof typeof VERBS> = {
  limp: 'lp',
  iso: 'r',
  sq: '3b',
  shove: 'ai',
  allin: 'ai',
  call: 'c',
  fold: 'f',
  check: 'x',
  bet: 'b',
  raise: 'r',
};

// Longest names first so `cr` wins over `c` and `limp` over `l`.
const VERB_NAMES = [...Object.keys(ALIASES), ...Object.keys(VERBS)].sort(
  (a, b) => b.length - a.length,
);
const ACT_RE = new RegExp(`^(${VERB_NAMES.join('|')})(\\d[\\d.,k]*)?$`, 'i');

export function actorRef(raw: string): ActorRef | null {
  const t = raw.toUpperCase().replace(/[:,]+$/, '');
  if (t === 'H') return { kind: 'hero' };
  if (t === 'V') return { kind: 'villain' };
  if (/^V[1-9]$/.test(t)) return { kind: 'label', who: t };
  const pos = normalizePosition(t);
  return pos ? { kind: 'pos', pos } : null;
}

function actToken(raw: string): Token | null {
  const m = ACT_RE.exec(raw);
  if (!m) return null;
  const name = (m[1] ?? '').toLowerCase();
  const def = VERBS[ALIASES[name] ?? name];
  if (!def) return null;
  const token: Token = { type: 'act', act: def.act, raw };
  if (def.verb) token.verb = def.verb;
  if (m[2] && def.sized) {
    const amount = parseAmount(m[2]);
    if (amount == null || amount <= 0) return { type: 'bad_amount', raw };
    token.amount = amount;
  }
  return token;
}

/** Split one street segment into actor / action / unknown-word tokens. */
export function tokenize(segment: string): Token[] {
  const out: Token[] = [];
  const words = segment
    .replace(/all[\s-]?in/gi, 'ai')
    .split(/\s+/)
    .filter(Boolean);

  for (const raw of words) {
    // `BTN-o600`: actor prefix glued to the action.
    const dash = raw.indexOf('-');
    if (dash > 0) {
      const ref = actorRef(raw.slice(0, dash));
      if (ref) {
        out.push({ type: 'actor', ref, raw: raw.slice(0, dash) });
        const rest = raw.slice(dash + 1);
        if (rest) out.push(actToken(rest) ?? { type: 'word', raw: rest });
        continue;
      }
    }
    const ref = actorRef(raw);
    if (ref) {
      out.push({ type: 'actor', ref, raw });
      continue;
    }
    out.push(actToken(raw) ?? { type: 'word', raw });
  }
  return out;
}

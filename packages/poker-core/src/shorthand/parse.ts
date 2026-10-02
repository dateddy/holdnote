import { parseCards } from '../cards';
import { STREETS, type Action, type Card, type Position, type Street } from '../types';
import { tokenize, type ActorRef } from './tokenize';

export interface ShorthandContext {
  heroPos?: Position;
  villPos?: Position;
}

export interface BoardFromLine {
  flop?: Card[];
  turn?: Card;
  river?: Card;
}

export type ParseErrorCode = 'unknown_token' | 'missing_actor' | 'bad_amount' | 'too_many_streets';

export interface ParseError {
  street: Street;
  /** Token index within the street segment. */
  index: number;
  token: string;
  code: ParseErrorCode;
}

export interface ShorthandResult {
  actions: Action[];
  boardFromLine: BoardFromLine;
  errors: ParseError[];
}

const CARD_TOKEN = /^(?:(?:10|[2-9TJQKA])[shdc?]?){1,5}$/i;

function resolveActor(ref: ActorRef, ctx: ShorthandContext): Pick<Action, 'actor' | 'pos' | 'who'> {
  switch (ref.kind) {
    case 'hero':
      return ctx.heroPos ? { actor: 'hero', pos: ctx.heroPos } : { actor: 'hero' };
    case 'villain':
      return ctx.villPos ? { actor: 'villain', pos: ctx.villPos } : { actor: 'villain' };
    case 'label':
      return { actor: 'other', who: ref.who };
    case 'pos':
      if (ref.pos === ctx.heroPos) return { actor: 'hero', pos: ref.pos };
      if (ref.pos === ctx.villPos) return { actor: 'villain', pos: ref.pos };
      return { actor: 'other', pos: ref.pos };
  }
}

/**
 * Parse a shorthand line such as `H o600 V c / 8sQhJh V x H b800 V c` into spec 4.2 actions.
 *
 * Each action needs its own actor token (H, V, V1..V9 or a position); only checks and folds may
 * go without one. Call amounts are left empty: `resolveActions` fills them from the betting state,
 * the same way for both entry modes.
 */
export function parseShorthand(line: string, ctx: ShorthandContext = {}): ShorthandResult {
  const actions: Action[] = [];
  const errors: ParseError[] = [];
  const boardFromLine: BoardFromLine = {};

  if (!line.trim()) return { actions, boardFromLine, errors };

  const segments = line.split('/');
  if (segments.length > STREETS.length) {
    errors.push({ street: 'river', index: 0, token: '/', code: 'too_many_streets' });
  }

  segments.slice(0, STREETS.length).forEach((segment, i) => {
    const street = STREETS[i] as Street;
    const tokens = tokenize(segment);
    let index = 0;

    // Board cards may open a postflop street.
    if (i > 0) {
      const cards: Card[] = [];
      while (index < tokens.length) {
        const t = tokens[index];
        if (!t || t.type !== 'word' || !CARD_TOKEN.test(t.raw)) break;
        cards.push(...parseCards(t.raw));
        index++;
      }
      if (cards.length) {
        if (street === 'flop') boardFromLine.flop = cards.slice(0, 3);
        // A rewritten full board (`K22J`) still ends with the new card.
        else if (street === 'turn') boardFromLine.turn = cards[cards.length - 1];
        else boardFromLine.river = cards[cards.length - 1];
      }
    }

    let pending: ActorRef | null = null;
    for (; index < tokens.length; index++) {
      const t = tokens[index];
      if (!t) continue;
      switch (t.type) {
        case 'actor':
          pending = t.ref;
          break;
        case 'word':
          errors.push({ street, index, token: t.raw, code: 'unknown_token' });
          pending = null;
          break;
        case 'bad_amount':
          errors.push({ street, index, token: t.raw, code: 'bad_amount' });
          pending = null;
          break;
        case 'act': {
          if (!pending && t.act !== 'check' && t.act !== 'fold') {
            errors.push({ street, index, token: t.raw, code: 'missing_actor' });
            break;
          }
          const action: Action = {
            street,
            ...(pending ? resolveActor(pending, ctx) : { actor: 'other' as const }),
            act: t.act,
          };
          if (t.verb) action.verb = t.verb;
          if (t.amount !== undefined) action.amount = t.amount;
          actions.push(action);
          pending = null;
          break;
        }
      }
    }
  });

  return { actions, boardFromLine, errors };
}

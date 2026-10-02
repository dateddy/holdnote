import { parseShorthand, type Blinds, type HandInput } from '../src/index';

export const NO_ANTE = { mode: 'none' } as const;
export const BLINDS_25_50: Blinds = { sb: 25, bb: 50, ante: NO_ANTE };

/** Build a HandInput from a shorthand line; fails loudly on parse errors. */
export function hand(line: string, opts: Partial<Omit<HandInput, 'actions'>> = {}): HandInput {
  const ctx = { heroPos: opts.heroPos, villPos: opts.villPos };
  const { actions, errors } = parseShorthand(line, ctx);
  if (errors.length) throw new Error(`parse errors in "${line}": ${JSON.stringify(errors)}`);
  return { blinds: BLINDS_25_50, ...opts, actions };
}

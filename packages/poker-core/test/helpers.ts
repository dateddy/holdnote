import {
  act as machineAct,
  parseShorthand,
  replay,
  type Action,
  type ActInput,
  type Blinds,
  type BoardInput,
  type HandInput,
  type HandSetup,
  type HandState,
  type Notice,
} from '../src/index';

export const NO_ANTE = { mode: 'none' } as const;
export const BLINDS_25_50: Blinds = { sb: 25, bb: 50, ante: NO_ANTE };

/** Build a HandInput from a shorthand line; fails loudly on parse errors. */
export function hand(line: string, opts: Partial<Omit<HandInput, 'actions'>> = {}): HandInput {
  const ctx = { heroPos: opts.heroPos, villPos: opts.villPos };
  const { actions, errors } = parseShorthand(line, ctx);
  if (errors.length) throw new Error(`parse errors in "${line}": ${JSON.stringify(errors)}`);
  return { blinds: BLINDS_25_50, ...opts, actions };
}

// ---- state machine helpers ----

/** 9-max 25/50, hero MP vs villain BTN, no ante, no straddle, stacks unknown. */
export function setup(over: Partial<HandSetup> = {}): HandSetup {
  return { seats: 9, sb: 25, bb: 50, ante: NO_ANTE, heroPos: 'MP', villPos: 'BTN', ...over };
}

export interface Played {
  actions: Action[];
  state: HandState;
  notices: Notice[];
}

/** Feed inputs one by one; throws when the machine refuses one. */
export function play(s: HandSetup, inputs: ActInput[], board?: BoardInput): Played {
  let actions: Action[] = [];
  let state = replay(s, actions, board);
  const notices: Notice[] = [];
  inputs.forEach((input, i) => {
    const r = machineAct(s, actions, input, board);
    if (!r.accepted) {
      throw new Error(`input ${i} ${JSON.stringify(input)} refused: ${JSON.stringify(r.notices)}`);
    }
    actions = r.actions;
    state = r.state;
    notices.push(...r.notices);
  });
  return { actions, state, notices };
}

export function toAct(state: HandState): string | null {
  return state.phase.kind === 'act' ? state.phase.toAct : null;
}

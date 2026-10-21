import { forcedBets, type Action, type HandSetup, type Position } from 'poker-core';
import { describe, expect, it } from 'vitest';
import {
  buildReviewContext,
  buildReviewRequest,
  type ReviewHand,
  type ReviewSession,
} from './context';
import { SYSTEM_PROMPT_V1_BASE, systemPrompt } from './prompt';

const cash: ReviewSession = {
  kind: 'cash',
  mode: 'live',
  sb: 25,
  bb: 50,
  straddle: null,
  ante_mode: 'none',
  ante: null,
  buyin: 10000,
  seats: 9,
  mtt: null,
  stake_label: '25/50',
};

const step = (
  street: Action['street'],
  pos: Position,
  actor: Action['actor'],
  act: Action['act'],
  amount?: number,
): Action => ({ street, pos, actor, act, ...(amount !== undefined && { amount }) });

/** A hand saved in the DEC-045 way: forced bets first, then the player's actions. */
function row(setup: HandSetup, actions: Action[], over: Partial<ReviewHand> = {}): ReviewHand {
  return {
    num: 1,
    hero_cards: ['Ah', 'Kd'],
    board: ['7c', '8d', '2s'],
    villain_cards: null,
    hero_pos: setup.heroPos,
    villain_pos: setup.villPos,
    opponent_id: null,
    raw_line: null,
    outcome: 'win',
    result: 0,
    hero_stack: 10000,
    villain_stack: 10000,
    level_bb: null,
    players_dealt: setup.seats,
    ante: null,
    stage: null,
    thought: null,
    flagged: false,
    actions: [...forcedBets(setup), ...actions],
    ...over,
  };
}

const ctx = (session: ReviewSession, hand: ReviewHand) =>
  buildReviewContext({ session, hand, topLeaks: [], locale: 'en' });

const NO_WINNER = /winner|wins|takes the pot/i;

describe('table facts in the review context (task 3.5)', () => {
  it('heads-up: pot type, players per street, uncalled bet, no multiway lines', () => {
    const setup: HandSetup = {
      seats: 2,
      sb: 25,
      bb: 50,
      ante: { mode: 'none' },
      heroPos: 'BTN',
      villPos: 'BB',
    };
    const text = ctx(
      cash,
      row(
        setup,
        [
          step('preflop', 'BTN', 'hero', 'raise', 150),
          step('preflop', 'BB', 'villain', 'call'),
          step('flop', 'BB', 'villain', 'check'),
          step('flop', 'BTN', 'hero', 'bet', 200),
          step('flop', 'BB', 'villain', 'fold'),
        ],
        { opponents: [{ pos: 'BB', stack: 10000 }] },
      ),
    );
    expect(text).toContain('Pot type: single-raised pot.');
    expect(text).toContain('Players at the start of each street: flop 2.');
    expect(text).toContain(
      'Uncalled bet returned to its owner, not in the pot: flop Hero (BTN) 4bb.',
    );
    expect(text).not.toContain('Opponents (');
    expect(text).not.toContain('Pots:');
    expect(text).not.toContain('Straddle');
    expect(text).not.toMatch(NO_WINNER);
    // Forced bets are not Hero decisions.
    expect(text).not.toMatch(/\d\. preflop: .*posts/);
  });

  it('straddle: size in bb', () => {
    const setup: HandSetup = {
      seats: 6,
      sb: 25,
      bb: 50,
      ante: { mode: 'none' },
      straddles: [100],
      heroPos: 'CO',
      villPos: 'BTN',
    };
    const text = ctx(
      cash,
      row(
        setup,
        [step('preflop', 'CO', 'hero', 'raise', 300), step('preflop', 'BTN', 'villain', 'call')],
        { opponents: [{ pos: 'BTN', stack: 10000 }] },
      ),
    );
    expect(text).toContain('Straddle: 2bb.');
    expect(text).toContain('Pot type: single-raised pot.');
  });

  it('multiway with a side pot: every opponent, cards shown, pots and who can win them', () => {
    const setup: HandSetup = {
      seats: 3,
      sb: 25,
      bb: 50,
      ante: { mode: 'none' },
      heroPos: 'BTN',
      villPos: 'SB',
      tracked: ['BB'],
      listedOnly: true,
      stacks: { BTN: 1000, SB: 3000, BB: 5000 },
    };
    const text = ctx(
      cash,
      row(
        setup,
        [
          step('preflop', 'BTN', 'hero', 'all-in', 1000),
          step('preflop', 'SB', 'villain', 'all-in', 3000),
          step('preflop', 'BB', 'other', 'call', 3000),
        ],
        {
          hero_stack: 1000,
          villain_pos: 'BB',
          villain_stack: 5000,
          opponents: [
            { pos: 'SB', stack: 3000, cards: ['Qh', 'Qd'] },
            { pos: 'BB', stack: 5000 },
          ],
          board: ['2c', '7d', '9h', 'Js', '3c'],
        },
      ),
    );
    expect(text).toContain('Opponents (2), main opponent first:');
    expect(text).toContain('- BB: main opponent, shown as Villain; stack 100bb');
    expect(text).toContain('- SB: stack 60bb; showed QhQd');
    // 1000 from each of three, then 2000 from two: 60bb main pot, 80bb side pot.
    expect(text).toContain(
      'Pots: main pot 60bb (can be won by Hero (BTN), SB, Villain (BB)); side pot 1 80bb (can be won by SB, Villain (BB)).',
    );
    expect(text).toContain('Pot type: 3-bet pot.');
    expect(text).not.toMatch(NO_WINNER);
  });

  it('MTT: ante kind and size, level blinds, stage', () => {
    const setup: HandSetup = {
      seats: 9,
      sb: 100,
      bb: 200,
      ante: { mode: 'bb', amount: 200 },
      heroPos: 'CO',
      villPos: 'BB',
    };
    const text = ctx(
      {
        ...cash,
        kind: 'mtt',
        mode: 'online',
        sb: null,
        bb: 200,
        ante_mode: 'bb',
        stake_label: null,
      },
      row(
        setup,
        [step('preflop', 'CO', 'hero', 'raise', 500), step('preflop', 'BB', 'villain', 'call')],
        {
          level_bb: 200,
          stage: 'bubble',
          players_left: 12,
          hero_stack: 8000,
          villain_stack: 9000,
          opponents: [{ pos: 'BB', stack: 9000 }],
        },
      ),
    );
    expect(text).toContain('Tournament spot: stage bubble, 12 players left.');
    expect(text).toContain('Big-blind ante: 1bb, posted by the big blind.');
    expect(text).toContain('Level: blinds 100/200 chips, ante 200.');
  });

  describe('MTT level and stacks (task: MTT review context)', () => {
    const setup: HandSetup = {
      seats: 9,
      sb: 300,
      bb: 600,
      ante: { mode: 'bb', amount: 600 },
      heroPos: 'CO',
      villPos: 'BB',
    };
    const mtt = (blindLevels: unknown): ReviewSession => ({
      ...cash,
      kind: 'mtt',
      mode: 'online',
      sb: null,
      bb: 600,
      ante_mode: 'bb',
      stake_label: null,
      mtt: blindLevels ? { blind_levels: blindLevels } : { start_stack: 30000 },
    });
    const play = [
      step('preflop', 'CO', 'hero', 'raise', 1500),
      step('preflop', 'BB', 'villain', 'call'),
    ];
    const hand = (over: Partial<ReviewHand> = {}) =>
      row(setup, play, {
        level_bb: 600,
        stage: 'bubble',
        players_left: 12,
        hero_stack: 27000,
        villain_stack: 18000,
        opponents: [{ pos: 'BB', stack: 18000 }],
        ...over,
      });
    const structure = [
      { level: 8, sb: 300, bb: 600, ante: 600, ante_mode: 'bb', minutes: 20 },
      { level: 9, sb: 400, bb: 800, ante: 800, ante_mode: 'bb', minutes: 20 },
    ];

    it('with a structure: level number, blinds, ante, stage, stacks in bb', () => {
      const text = ctx(mtt(structure), hand({ level: 8, ante: 600, ante_mode: 'bb' }));
      expect(text).toContain('Level 8: blinds 300/600 chips, ante 600.');
      expect(text).toContain('Tournament spot: stage bubble, 12 players left.');
      expect(text).toContain('Stacks: Hero 45bb, Villain 30bb.');
    });

    it('without a structure: blinds from the hand, no level number, stacks in bb', () => {
      const text = ctx(mtt(null), hand({ level: null }));
      expect(text).toContain('Level: blinds 300/600 chips, ante 600.');
      expect(text).not.toMatch(/Level \d/);
      expect(text).toContain('Stacks: Hero 45bb, Villain 30bb.');
    });

    it('an unknown stack is said to be unknown', () => {
      const text = ctx(mtt(null), hand({ hero_stack: null, villain_stack: null, opponents: [] }));
      expect(text).toContain('Stacks: Hero unknown, Villain unknown.');
    });

    it('editing the structure afterwards does not change what a saved hand says', () => {
      const edited = structure.map((l) => (l.level === 8 ? { ...l, sb: 500, bb: 1000 } : l));
      const text = ctx(mtt(edited), hand({ level: 8, ante: 600, ante_mode: 'bb' }));
      expect(text).toContain('Level 8: blinds 300/600 chips, ante 600.');
      expect(text).toContain('Stacks: Hero 45bb, Villain 30bb.');
    });

    it('cash hands have no Level or Stacks line', () => {
      const cashSetup: HandSetup = {
        seats: 9,
        sb: 25,
        bb: 50,
        ante: { mode: 'none' },
        heroPos: 'CO',
        villPos: 'BB',
      };
      const text = ctx(cash, row(cashSetup, play, { opponents: [{ pos: 'BB', stack: 10000 }] }));
      expect(text).not.toMatch(/^Level/m);
      expect(text).not.toContain('Stacks:');
    });

    it('hands without a state machine get neither line', () => {
      const old = hand({ level: 8, ante: 600, ante_mode: 'bb' });
      const text = ctx(mtt(structure), {
        ...old,
        actions: (old.actions as Action[]).filter((a) => !a.act.startsWith('post_')),
      });
      expect(text).not.toContain('Stacks:');
    });
  });

  it('hands without forced-bet actions (shorthand, old hands) get no table lines', () => {
    const old = row(
      { seats: 9, sb: 25, bb: 50, ante: { mode: 'none' }, heroPos: 'MP', villPos: 'BTN' },
      [step('preflop', 'BTN', 'villain', 'raise', 500), step('preflop', 'MP', 'hero', 'call', 500)],
    );
    const text = ctx(cash, {
      ...old,
      actions: (old.actions as Action[]).filter((a) => !a.act.startsWith('post_')),
    });
    expect(text).not.toContain('Pot type');
    expect(text).not.toContain('Uncalled');
  });

  it('raise multiples are measured against the bet that was faced', () => {
    const setup: HandSetup = {
      seats: 2,
      sb: 25,
      bb: 50,
      ante: { mode: 'none' },
      heroPos: 'BTN',
      villPos: 'BB',
    };
    const text = ctx(
      cash,
      row(
        setup,
        [
          step('preflop', 'BTN', 'hero', 'call'),
          step('preflop', 'BB', 'villain', 'raise', 150),
          step('preflop', 'BTN', 'hero', 'raise', 450),
        ],
        { opponents: [{ pos: 'BB', stack: 10000 }] },
      ),
    );
    expect(text).toContain('raises to 9bb; 3x the bet it faces');
  });
});

describe('prompt fields follow the hand (task 3.5b)', () => {
  const heads = (over: Partial<HandSetup> = {}): HandSetup => ({
    seats: 2,
    sb: 25,
    bb: 50,
    ante: { mode: 'none' },
    heroPos: 'BTN',
    villPos: 'BB',
    ...over,
  });
  const play = [
    step('preflop', 'BTN', 'hero', 'raise', 150),
    step('preflop', 'BB', 'villain', 'call'),
  ];
  const request = (hand: ReviewHand) =>
    buildReviewRequest({ session: cash, hand, topLeaks: [], locale: 'en' });

  it('a heads-up hand with forced bets: flow only', () => {
    const { promptFields } = request(
      row(heads(), play, { opponents: [{ pos: 'BB', stack: 10000 }] }),
    );
    expect(promptFields).toEqual({
      flow: true,
      straddle: false,
      ante: false,
      level: false,
      multiway: false,
      sidePots: false,
      uncalled: false,
      heroHand: true,
    });
    const prompt = systemPrompt('v1', promptFields);
    expect(prompt).toContain('Pot type and players left');
    expect(prompt).not.toMatch(/straddle|side pot|multiway pot/i);
  });

  it('a hand without forced bets (shorthand or old) gets the old v1 prompt', () => {
    const hand = row(heads(), play);
    const old = {
      ...hand,
      actions: (hand.actions as Action[]).filter((a) => !a.act.startsWith('post_')),
    };
    const { promptFields } = request(old);
    expect(promptFields).toMatchObject({ flow: false, heroHand: true });
    // Only the line for Hero's made hand is added to the old prompt.
    expect(systemPrompt('v1', promptFields).replace(/^- Hero's made hand.*\n/m, '')).toBe(
      SYSTEM_PROMPT_V1_BASE,
    );
    const noBoard = request({ ...old, board: [] });
    expect(noBoard.promptFields).toBeNull();
  });
});

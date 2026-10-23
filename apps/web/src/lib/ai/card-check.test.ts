import { describe, expect, it, vi } from 'vitest';
import { cardMistake, cardTokens } from './card-check';
import { runRebuttal } from './rebuttal';
import { runReview } from './run-review';

// A♦Q♦ on Q♣ 7♠ 2♥ A♥ Q♥: full house, queens full of aces.
const hand = { hero: ['Ad', 'Qd'], board: ['Qc', '7s', '2h', 'Ah', 'Qh'], villain: [] };

describe('cardTokens', () => {
  it('reads letters, symbols, glued pairs and 10', () => {
    expect(cardTokens('QhQc on Q♥, then 10s and A♦ Q♦').map((t) => t.cards)).toEqual([
      ['Qh', 'Qc'],
      ['Qh'],
      ['Ts'],
      ['Ad', 'Qd'],
    ]);
  });
  it('does not take English "As" or words for cards', () => {
    expect(cardTokens('As the river pairs, Hero checks. Ask, 1990s, 4bb.')).toEqual([]);
    expect(cardTokens('As Ks on board').map((t) => t.cards)).toEqual([['As', 'Ks']]);
  });
});

describe('cardMistake', () => {
  it('flags the misread QhQc as Hero holding', () => {
    const msg = cardMistake(
      ['Với full house (QhQc trên board AhQh), bài của mình quá mạnh để chỉ call.'],
      hand,
    );
    expect(msg).toContain('AdQd');
    expect(msg).toContain('not QhQc');
    expect(msg).toContain('Qc 7s 2h Ah Qh');
  });
  it('accepts Hero cards and board cards, in any notation', () => {
    expect(
      cardMistake(
        [
          'Mình cầm A♦Q♦, flop Qc 7s 2h cho pair of queens.',
          'River Qh: full house. AdQd is strong.',
        ],
        hand,
      ),
    ).toBeNull();
  });
  it('a card that is nowhere in the hand is a mistake', () => {
    expect(cardMistake(['Turn Kh gives Hero two pair.'], hand)).toContain('Kh');
  });
  it('board words: the cards after them must be on the board', () => {
    expect(cardMistake(['The board Ad Qc 7s is dry.'], hand)).toContain('Ad');
  });
  it('cards named for the opponent or a range are left alone', () => {
    expect(
      cardMistake(['Đối thủ có thể có QhQc hoặc 7d7c.', 'Villain range includes KsKh.'], hand),
    ).toBeNull();
  });
  it('an opponent word after the cards does not excuse them (AhTh named as Hero flush)', () => {
    const flush = { hero: ['Kh', 'Qh'], board: ['Ah', 'Th', '3c', '2h', '8s'], villain: [] };
    expect(
      cardMistake(
        ['Với nut flush (AhTh), bạn đánh bại toàn bộ value range của đối thủ, call là chuẩn.'],
        flush,
      ),
    ).toContain('not AhTh');
    expect(cardMistake(['KhQh trên board Ah Th 3c 2h 8s là nut flush.'], flush)).toBeNull();
  });
  it('no known cards: nothing to check', () => {
    expect(cardMistake(['QhQc'], { hero: [], board: [], villain: [] })).toBeNull();
    expect(
      cardMistake(['Mình có KhKd'], { hero: ['A?', 'Q?'], board: [], villain: [] }),
    ).toBeNull();
  });
});

describe('runReview / runRebuttal check the cards and retry once', () => {
  const review = {
    range: 'Villain BTN calls wide: broadways, suited aces, small pairs.',
    math: 'River: 30bb to call into 61.5bb, pot odds 33%.',
    line: 'Raise the river for value with the full house.',
    icm: '',
    error_tags: ['missed_value'],
    ev_verdict: 'mistake',
    key_mistake_street: 'river',
    repeats_known_leak: false,
    lesson: '1. With a full house on the river, raise for value.',
    missing_info: [],
  };
  const misread = { ...review, line: 'With full house (QhQc on board AhQh), Hero must raise.' };
  const reply = (content: unknown, cost = 0.001) =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(content) } }],
        usage: { prompt_tokens: 100, completion_tokens: 50, cost },
      }),
    );
  const review$ = (f: unknown) =>
    runReview({
      apiKey: 'k',
      model: 'm',
      userMessage: 'hand',
      locale: 'en',
      cards: hand,
      fetchImpl: f as typeof fetch,
    });

  it('QhQc: asked again with the right cards, the fixed review has no flag', async () => {
    const f = vi.fn().mockResolvedValueOnce(reply(misread)).mockResolvedValueOnce(reply(review));
    const r = await review$(f);
    expect(f).toHaveBeenCalledTimes(2);
    const retry = JSON.parse(f.mock.calls[1][1].body).messages.at(-1).content;
    expect(retry).toContain("Hero's cards are AdQd, not QhQc");
    expect(r).toMatchObject({ attempts: 2, flag: null, costUsd: 0.002 });
    expect(r.review.line).toBe(review.line);
  });

  it('still wrong after the retry: kept, flagged, both calls paid for', async () => {
    const f = vi.fn(async () => reply(misread));
    const r = await review$(f);
    expect(f).toHaveBeenCalledTimes(2);
    expect(r.flag).toContain('QhQc');
    expect(r.costUsd).toBe(0.002);
    expect(r.review.line).toContain('QhQc');
  });

  it('a broken retry keeps the first reply, flagged', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(reply(misread))
      .mockResolvedValueOnce(reply({ nope: true }));
    const r = await review$(f);
    expect(r.flag).toContain('QhQc');
    expect(r.attempts).toBe(2);
  });

  it('right cards: one call, no flag', async () => {
    const f = vi.fn(async () => reply(review));
    const r = await review$(f);
    expect(f).toHaveBeenCalledTimes(1);
    expect(r.flag).toBeNull();
  });

  it('the rebuttal reply is checked too', async () => {
    const f = vi.fn(async () =>
      reply({ decision: 'keep', reply: 'Hero holds QhQc, so raising is right.', review }),
    );
    const r = await runRebuttal({
      apiKey: 'k',
      model: 'm',
      userMessage: 'hand',
      locale: 'en',
      cards: hand,
      fetchImpl: f as unknown as typeof fetch,
    });
    expect(f).toHaveBeenCalledTimes(2);
    expect(r.flag).toContain('QhQc');
  });
});

import { describe, expect, it } from 'vitest';
import { formatShorthand, parseShorthand } from '../src/index';

const GOLD = 'H lp V o500 H c / H x V b500 H c / H x V b1k H c / H b5000 V ai H c';

describe('formatShorthand', () => {
  it('formats the golden hand', () => {
    const { actions } = parseShorthand(GOLD, { heroPos: 'MP', villPos: 'BTN' });
    expect(formatShorthand(actions)).toBe(
      'H lp V o500 H c / H x V b500 H c / H x V b1000 H c / H b5000 V ai H c',
    );
  });

  it('round trips parse(format(actions))', () => {
    const ctx = { heroPos: 'BTN', villPos: 'BB' } as const;
    const lines = [
      'H o150 V 3b500 H 4b1200 V c / V x H b300 V cr900 H f',
      'H o2k V c / V l400 H r1k5 V ai H c',
      'CO o3k V3 c H c / V x H b0.25 V d1.5 H c',
    ];
    for (const line of lines) {
      const first = parseShorthand(line, ctx);
      expect(first.errors).toEqual([]);
      const again = parseShorthand(formatShorthand(first.actions), ctx);
      expect(again.errors).toEqual([]);
      expect(again.actions).toEqual(first.actions);
    }
  });

  it('puts board cards at the head of each postflop street', () => {
    const { actions } = parseShorthand('H o150 V c / V x H b100 V c / V x H x / V x H x', {});
    const board = ['8s', 'Qh', 'Jh', '2c', '9d'] as const;
    const line = formatShorthand(actions, [...board]);
    expect(line).toBe('H o150 V c / 8sQhJh V x H b100 V c / 2c V x H x / 9d V x H x');
    const parsed = parseShorthand(line, {});
    expect(parsed.boardFromLine).toEqual({ flop: ['8s', 'Qh', 'Jh'], turn: '2c', river: '9d' });
    expect(parsed.actions).toEqual(actions);
  });

  it('empty hand is an empty line', () => {
    expect(formatShorthand([])).toBe('');
  });
});

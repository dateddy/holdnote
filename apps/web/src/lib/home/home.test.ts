import { describe, expect, it } from 'vitest';
import { topLeaks } from './home';

const line = (tag: string, trend: boolean[], hands = 1) => ({
  tag,
  hands,
  sessions: trend.filter(Boolean).length,
  trend,
  repeated: trend.filter(Boolean).length >= 3,
});

describe('topLeaks', () => {
  it('ranks by presence in recent sessions, then hands, and drops absent ones', () => {
    const lines = [
      line('a', [true, false, false, false, false], 9),
      line('b', [true, true, true, false, false], 1),
      line('c', [true, true, true, false, false], 4),
      line('d', [false, false, false, false, false], 20),
      line('e', [false, true, false, false, false], 2),
    ];
    expect(topLeaks(lines).map((l) => l.tag)).toEqual(['c', 'b', 'a']);
    expect(topLeaks(lines, 5).map((l) => l.tag)).toEqual(['c', 'b', 'a', 'e']);
  });
});

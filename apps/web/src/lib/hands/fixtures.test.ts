import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveHand } from './build';
import { CASH, MTT, fixtureRows, goldenDraft, mttDraft, sidePotDraft } from './fixtures';

const FILE = new URL('../../../../../scripts/fixtures/hands-5.1d-2b.json', import.meta.url);

describe('hand fixtures', () => {
  it('derive cleanly: no refused action, golden -360 bb, side pot of two, MTT in level bb', () => {
    const golden = deriveHand(CASH, goldenDraft());
    expect(golden.machine?.invalid).toEqual([]);
    expect(golden.resultBb).toBe(-360);

    const side = deriveHand(CASH, sidePotDraft());
    expect(side.machine?.invalid).toEqual([]);
    expect(side.showdown?.pots).toHaveLength(2);

    const mtt = deriveHand(MTT, mttDraft());
    expect(mtt.machine?.invalid).toEqual([]);
    expect(mtt.bb).toBe(1000);
    expect(mtt.resultBb).toBe(-5);
    expect(mtt.missing).toBe(false);
  });

  it('the JSON the screenshot script seeds from is up to date (WRITE_FIXTURES=1 rewrites it)', () => {
    const rows = JSON.parse(JSON.stringify(fixtureRows())) as unknown;
    if (process.env.WRITE_FIXTURES) {
      mkdirSync(dirname(FILE.pathname.replace(/^\/([A-Za-z]:)/, '$1')), { recursive: true });
      writeFileSync(FILE, `${JSON.stringify(rows, null, 2)}\n`);
    }
    expect(JSON.parse(readFileSync(FILE, 'utf8'))).toEqual(rows);
  });
});

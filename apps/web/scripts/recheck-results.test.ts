/**
 * Dry run (task 5.1c-6a-fix): recompute the result and the final pot of every saved hand with the
 * current poker-core and list the hands that differ from what is stored. Only reads; it never
 * writes to the database. Run: `pnpm recheck:results`.
 *
 * With `RECHECK_WRITE=1` it writes the new `pot_final` (and `result` when it changes) of the listed
 * hands, once the list has been approved.
 *
 * Hands whose result was typed by hand (tag `manual_result`) are listed apart and not compared.
 */
import { describe, expect, it } from 'vitest';
import {
  deriveHand,
  fromHandRow,
  HAND_EDIT_COLUMNS,
  HAND_SESSION_COLUMNS,
  type HandRowIn,
  type HandSession,
} from '../src/lib/hands/build';
import { createAdminClient } from '../src/lib/supabase/admin';

const enabled = Boolean(process.env.SUPABASE_SECRET_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);
const same = (a: number | null, b: number | null) =>
  a === b || (a !== null && b !== null && Math.abs(a - b) < 0.005);

describe.skipIf(!enabled)('recheck saved results', () => {
  it('lists the hands whose result or pot changes', async () => {
    const db = createAdminClient();

    const sessions = new Map<string, HandSession & { date: string }>();
    const { data: sessionRows, error: sessionError } = await db
      .from('sessions')
      .select(`id, date, ${HAND_SESSION_COLUMNS}`);
    if (sessionError) throw sessionError;
    for (const s of sessionRows ?? [])
      sessions.set(s.id, s as unknown as HandSession & { date: string });

    const hands: Record<string, unknown>[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from('hands')
        .select(`${HAND_EDIT_COLUMNS}, pot_final, tags, user_id`)
        .order('created_at')
        .range(from, from + 999);
      if (error) throw error;
      hands.push(...(data ?? []));
      if ((data?.length ?? 0) < 1000) break;
    }

    const changed: Record<string, unknown>[] = [];
    const manual: string[] = [];
    let compared = 0;
    for (const row of hands) {
      const session = sessions.get(row.session_id as string);
      if (!session) continue;
      if (((row.tags as string[] | null) ?? []).includes('manual_result')) {
        manual.push(String(row.id));
        continue;
      }
      const draft = fromHandRow(session, row as unknown as HandRowIn);
      draft.resultText = ''; // fromHandRow keeps the stored result as an override; we want the engine's
      const d = deriveHand(session, draft);
      compared++;
      const oldResult = (row.result as number | null) ?? null;
      const oldPot = (row.pot_final as number | null) ?? null;
      if (same(oldResult, d.result) && same(oldPot, d.potFinal)) continue;
      changed.push({
        id: row.id,
        session: `${session.date} (${String(row.session_id).slice(0, 8)})`,
        hand: row.num,
        'result old': oldResult,
        'result new': d.result,
        'pot old': oldPot,
        'pot new': d.potFinal,
        _fix: { pot_final: d.potFinal, ...(same(oldResult, d.result) ? {} : { result: d.result }) },
        why:
          oldResult === null && d.result !== null
            ? 'result was missing'
            : !same(oldResult, d.result)
              ? 'result changes'
              : 'pot only',
      });
    }

    console.log(
      `\nHands read: ${hands.length}, compared: ${compared}, manual result: ${manual.length}`,
    );
    if (manual.length) console.log('Manual results (not compared):', manual.join(', '));
    console.log(changed.length ? `Changed: ${changed.length}` : 'No hand changes.');
    if (changed.length) {
      console.table(changed.map(({ _fix, ...shown }) => shown));
    }
    if (process.env.RECHECK_WRITE === '1') {
      for (const c of changed) {
        const { error } = await db
          .from('hands')
          .update(c._fix as { pot_final: number | null; result?: number | null })
          .eq('id', c.id as string);
        if (error) throw error;
      }
      console.log(`Written: ${changed.length} hand(s).`);
    }
    expect(compared).toBeGreaterThanOrEqual(0);
  });
});

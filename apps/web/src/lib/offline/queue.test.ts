import { describe, expect, it } from 'vitest';
import {
  classifyError,
  flushOpponents,
  flushQueue,
  undoHand,
  type InsertOutcome,
  type OpponentStore,
  type QueuedOpponent,
  type QueuedHand,
  type QueueStore,
  type RemoteHands,
} from './queue';

function memoryStore(items: QueuedHand[] = []): QueueStore & { items: Map<string, QueuedHand> } {
  const map = new Map(items.map((i) => [i.id, i]));
  return {
    items: map,
    put: async (i) => void map.set(i.id, i),
    getAll: async () => [...map.values()],
    remove: async (id) => void map.delete(id),
  };
}

const hand = (id: string, num: number, extra: Partial<QueuedHand> = {}): QueuedHand => ({
  id,
  userId: 'u1',
  sessionId: 's1',
  row: { num },
  createdAt: num,
  status: 'pending',
  ...extra,
});

/** Fake server: `script` decides each insert; accepted hands are recorded. */
function fakeRemote(
  script: (item: QueuedHand, calls: number) => InsertOutcome,
  max: number | null = 0,
) {
  const accepted: Array<{ id: string; num: number }> = [];
  let calls = 0;
  const remote: Pick<RemoteHands, 'insert' | 'maxNum'> = {
    insert: async (item) => {
      const outcome = script(item, ++calls);
      if (outcome.kind === 'ok') accepted.push({ id: item.id, num: item.row.num });
      return outcome;
    },
    maxNum: async () => max,
  };
  return { remote, accepted };
}

describe('classifyError', () => {
  it('treats a request that never completed as retry', () => {
    expect(classifyError({ message: 'TypeError: Failed to fetch' }).kind).toBe('retry');
    expect(classifyError({ status: 0 }).kind).toBe('retry');
    expect(classifyError({ status: 503 }).kind).toBe('retry');
    expect(classifyError({ status: 401, message: 'JWT expired' }).kind).toBe('retry');
  });

  it('tells the two unique violations apart', () => {
    const base = { code: '23505', status: 409 };
    expect(
      classifyError({ ...base, message: 'duplicate key value violates "hands_pkey"' }).kind,
    ).toBe('dup_id');
    expect(
      classifyError({ ...base, message: 'duplicate key ... "hands_session_id_num_key"' }).kind,
    ).toBe('num_conflict');
  });

  it('other client errors are final', () => {
    expect(classifyError({ code: '23503', status: 409, message: 'fk' }).kind).toBe('fatal');
    expect(classifyError({ code: '23514', status: 400, message: 'check' }).kind).toBe('fatal');
  });
});

describe('flushQueue', () => {
  it('sends hands in saved order and empties the queue', async () => {
    const store = memoryStore([hand('b', 2), hand('a', 1)]);
    const { remote, accepted } = fakeRemote(() => ({ kind: 'ok' }));
    const r = await flushQueue(store, 'u1', remote);
    expect(accepted.map((h) => h.id)).toEqual(['a', 'b']);
    expect(r).toEqual({ synced: ['a', 'b'], pending: 0, failed: 0 });
    expect(store.items.size).toBe(0);
  });

  it('offline: keeps everything and stops at the first failure', async () => {
    const store = memoryStore([hand('a', 1), hand('b', 2)]);
    const { remote } = fakeRemote(() => ({ kind: 'retry' }));
    const r = await flushQueue(store, 'u1', remote);
    expect(r).toEqual({ synced: [], pending: 2, failed: 0 });
    expect(store.items.size).toBe(2);
  });

  it('a hand that already reached the server counts as synced', async () => {
    const store = memoryStore([hand('a', 1)]);
    const { remote } = fakeRemote(() => ({ kind: 'dup_id' }));
    expect((await flushQueue(store, 'u1', remote)).synced).toEqual(['a']);
    expect(store.items.size).toBe(0);
  });

  it('bumps num after a conflict and keeps later hands in order', async () => {
    const store = memoryStore([hand('a', 3), hand('b', 4)]);
    // The server already has hands 1..5: the first try of each hand collides.
    const taken = 5;
    const { remote, accepted } = fakeRemote(
      (item) => (item.row.num <= taken ? { kind: 'num_conflict' } : { kind: 'ok' }),
      taken,
    );
    const r = await flushQueue(store, 'u1', {
      ...remote,
      maxNum: async () => taken + accepted.length,
    });
    expect(accepted).toEqual([
      { id: 'a', num: 6 },
      { id: 'b', num: 7 },
    ]);
    expect(r.pending).toBe(0);
  });

  it('gives up on a conflict that never settles but keeps the hand', async () => {
    const store = memoryStore([hand('a', 1)]);
    const { remote } = fakeRemote(() => ({ kind: 'num_conflict' }));
    const r = await flushQueue(store, 'u1', remote);
    expect(r.pending).toBe(1);
    expect(store.items.get('a')?.status).toBe('pending');
  });

  it('marks refused hands as failed and continues with the rest', async () => {
    const store = memoryStore([hand('a', 1), hand('b', 2)]);
    const { remote, accepted } = fakeRemote((item) =>
      item.id === 'a' ? { kind: 'fatal', message: 'session gone' } : { kind: 'ok' },
    );
    const r = await flushQueue(store, 'u1', remote);
    expect(accepted.map((h) => h.id)).toEqual(['b']);
    expect(r).toEqual({ synced: ['b'], pending: 0, failed: 1 });
    expect(store.items.get('a')).toMatchObject({ status: 'failed', error: 'session gone' });
  });

  it('never sends another account hands', async () => {
    const store = memoryStore([hand('a', 1, { userId: 'u2' })]);
    const { remote, accepted } = fakeRemote(() => ({ kind: 'ok' }));
    const r = await flushQueue(store, 'u1', remote);
    expect(accepted).toEqual([]);
    expect(r).toEqual({ synced: [], pending: 0, failed: 0 });
    expect(store.items.size).toBe(1);
  });

  it('does not retry hands already marked failed', async () => {
    const store = memoryStore([hand('a', 1, { status: 'failed', error: 'x' })]);
    const { remote, accepted } = fakeRemote(() => ({ kind: 'ok' }));
    const r = await flushQueue(store, 'u1', remote);
    expect(accepted).toEqual([]);
    expect(r.failed).toBe(1);
  });
});

describe('undoHand', () => {
  it('removes a hand that is still queued without touching the server', async () => {
    const store = memoryStore([hand('a', 1)]);
    const deleted: string[] = [];
    expect(await undoHand(store, 'a', async (id) => void deleted.push(id))).toBe('removed');
    expect(store.items.size).toBe(0);
    expect(deleted).toEqual([]);
  });

  it('deletes a hand that already synced', async () => {
    const store = memoryStore();
    const deleted: string[] = [];
    expect(await undoHand(store, 'a', async (id) => void deleted.push(id))).toBe('deleted');
    expect(deleted).toEqual(['a']);
  });
});

describe('flushOpponents', () => {
  const pending = (id: string, createdAt: number, userId = 'u1'): QueuedOpponent => ({
    id,
    userId,
    name: id,
    venue: 'Club',
    createdAt,
  });
  const opponentStore = (items: QueuedOpponent[]): OpponentStore & { ids: () => string[] } => {
    const map = new Map(items.map((i) => [i.id, i]));
    return {
      put: async (i) => void map.set(i.id, i),
      getAll: async () => [...map.values()],
      remove: async (id) => void map.delete(id),
      ids: () => [...map.keys()],
    };
  };

  it('sends one user in the order made and clears them', async () => {
    const store = opponentStore([pending('b', 2), pending('a', 1), pending('x', 1, 'u2')]);
    const sent: string[] = [];
    const r = await flushOpponents(store, 'u1', async (o) => {
      sent.push(o.id);
      return { kind: 'ok' };
    });
    expect(r).toBe('done');
    expect(sent).toEqual(['a', 'b']);
    expect(store.ids()).toEqual(['x']);
  });

  it('a repeated id counts as sent', async () => {
    const store = opponentStore([pending('a', 1)]);
    expect(await flushOpponents(store, 'u1', async () => ({ kind: 'dup_id' }))).toBe('done');
    expect(store.ids()).toEqual([]);
  });

  it('stops at the first network failure and keeps the rest, so hands are held back', async () => {
    const store = opponentStore([pending('a', 1), pending('b', 2)]);
    const r = await flushOpponents(store, 'u1', async () => ({ kind: 'retry' }));
    expect(r).toBe('retry');
    expect(store.ids()).toEqual(['a', 'b']);
  });

  it('drops an opponent the server will never accept', async () => {
    const store = opponentStore([pending('a', 1)]);
    const r = await flushOpponents(store, 'u1', async () => ({ kind: 'fatal', message: 'x' }));
    expect(r).toBe('done');
    expect(store.ids()).toEqual([]);
  });
});

/** A hand saved on this device that may not have reached the server yet. */
export type QueuedHand = {
  /** Also the `hands.id`, so a repeated insert never creates a second hand. */
  id: string;
  userId: string;
  sessionId: string;
  /** `hands` insert row without `id` / `session_id` (see `toHandRow`). `num` can be bumped on conflict. */
  row: { num: number } & Record<string, unknown>;
  createdAt: number;
  status: 'pending' | 'failed';
  error?: string;
};

export interface QueueStore {
  put(item: QueuedHand): Promise<void>;
  getAll(): Promise<QueuedHand[]>;
  remove(id: string): Promise<void>;
}

export type InsertOutcome =
  | { kind: 'ok' }
  /** Same id already on the server: an earlier attempt got through. */
  | { kind: 'dup_id' }
  /** Another hand took this `num` in the session. */
  | { kind: 'num_conflict' }
  /** Network, server or session-refresh trouble: keep the hand and try later. */
  | { kind: 'retry' }
  /** The server will never accept this hand (session deleted, invalid value). */
  | { kind: 'fatal'; message: string };

export type RemoteHands = {
  insert(item: QueuedHand): Promise<InsertOutcome>;
  /** Highest `num` in the session, null when it has no hands. */
  maxNum(sessionId: string): Promise<number | null>;
  delete(id: string): Promise<void>;
};

/** Map a Supabase/PostgREST error to what the queue should do next. */
export function classifyError(error: {
  message?: string;
  code?: string;
  status?: number;
}): InsertOutcome {
  const { message = '', code = '', status } = error;
  if (code === '23505') {
    if (message.includes('hands_pkey')) return { kind: 'dup_id' };
    if (message.includes('session_id_num')) return { kind: 'num_conflict' };
    return { kind: 'fatal', message };
  }
  // No HTTP status means the request never completed (offline, DNS, timeout).
  if (!status || status >= 500 || status === 401 || status === 408 || status === 429) {
    return { kind: 'retry' };
  }
  return { kind: 'fatal', message };
}

export type FlushResult = {
  /** Ids that reached the server in this run. */
  synced: string[];
  /** Hands still waiting (offline or conflicts not settled). */
  pending: number;
  /** Hands the server rejected for good. */
  failed: number;
};

const MAX_NUM_BUMPS = 3;

/**
 * Send this user's pending hands in the order they were saved. Stops at the first sign the
 * network is down so order is kept; marks hands the server refuses as failed and moves on.
 */
export async function flushQueue(
  store: QueueStore,
  userId: string,
  remote: Pick<RemoteHands, 'insert' | 'maxNum'>,
): Promise<FlushResult> {
  const all = (await store.getAll()).filter((h) => h.userId === userId);
  const queue = all.filter((h) => h.status === 'pending').sort((a, b) => a.createdAt - b.createdAt);
  const result: FlushResult = {
    synced: [],
    pending: queue.length,
    failed: all.filter((h) => h.status === 'failed').length,
  };

  for (const item of queue) {
    let current = item;
    let done = false;
    for (let attempt = 0; attempt <= MAX_NUM_BUMPS && !done; attempt++) {
      const outcome = await remote.insert(current);
      if (outcome.kind === 'ok' || outcome.kind === 'dup_id') {
        await store.remove(current.id);
        result.synced.push(current.id);
        result.pending--;
        done = true;
      } else if (outcome.kind === 'num_conflict') {
        const max = await remote.maxNum(current.sessionId);
        current = { ...current, row: { ...current.row, num: (max ?? 0) + 1 } };
        await store.put(current);
      } else if (outcome.kind === 'fatal') {
        await store.put({ ...current, status: 'failed', error: outcome.message });
        result.pending--;
        result.failed++;
        done = true;
      } else {
        return result; // retry: network is down, try again later
      }
    }
    if (!done) return result; // conflicts did not settle; leave it pending
  }
  return result;
}

/** Take a just-saved hand back: drop it from the queue, or delete it if it already synced. */
export async function undoHand(
  store: QueueStore,
  id: string,
  deleteRemote: (id: string) => Promise<void>,
): Promise<'removed' | 'deleted'> {
  const queued = (await store.getAll()).some((h) => h.id === id);
  if (queued) {
    await store.remove(id);
    return 'removed';
  }
  await deleteRemote(id);
  return 'deleted';
}

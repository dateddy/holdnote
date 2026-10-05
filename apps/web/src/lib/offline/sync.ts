'use client';

import type { Database } from '@/lib/supabase/database.types';
import { createClient } from '@/lib/supabase/client';
import { idbStore } from './idb-store';
import {
  classifyError,
  flushQueue,
  undoHand as undoQueued,
  type FlushResult,
  type QueuedHand,
  type RemoteHands,
} from './queue';

type HandInsert = Database['public']['Tables']['hands']['Insert'];

export type SyncCounts = { pending: number; failed: number };

const FLUSH_EVERY_MS = 30_000;

const listeners = new Set<(counts: SyncCounts, result: FlushResult | null) => void>();
let inFlight: Promise<FlushResult | null> | null = null;
let started = false;

async function currentUserId(): Promise<string | null> {
  // Reads the stored session, so it also works with no network.
  const { data } = await createClient().auth.getSession();
  return data.session?.user.id ?? null;
}

function remote(): RemoteHands {
  const supabase = createClient();
  return {
    insert: async (item) => {
      try {
        const { error, status } = await supabase.from('hands').insert({
          ...item.row,
          id: item.id,
          session_id: item.sessionId,
        } as HandInsert);
        return error ? classifyError({ ...error, status }) : { kind: 'ok' };
      } catch {
        return { kind: 'retry' };
      }
    },
    maxNum: async (sessionId) => {
      const { data } = await supabase
        .from('hands')
        .select('num')
        .eq('session_id', sessionId)
        .order('num', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.num ?? null;
    },
    delete: async (id) => {
      const { error } = await supabase.from('hands').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
  };
}

/** How many of this account's hands wait for the network, and how many the server refused. */
export async function getCounts(): Promise<SyncCounts> {
  const userId = await currentUserId();
  const mine = (await idbStore.getAll()).filter((h) => h.userId === userId);
  return {
    pending: mine.filter((h) => h.status === 'pending').length,
    failed: mine.filter((h) => h.status === 'failed').length,
  };
}

async function notify(result: FlushResult | null) {
  const counts = await getCounts();
  for (const fn of listeners) fn(counts, result);
}

/** Subscribe to queue changes. Returns the unsubscribe function. */
export function subscribe(fn: (counts: SyncCounts, result: FlushResult | null) => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** Send what is waiting. One run at a time; callers share the same promise. */
export function flush(): Promise<FlushResult | null> {
  inFlight ??= (async () => {
    try {
      const userId = await currentUserId();
      if (!userId) return null;
      const result = await flushQueue(idbStore, userId, remote());
      await notify(result);
      return result;
    } catch {
      return null; // IndexedDB or auth trouble: the hands stay queued
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/**
 * Save a new hand on this device first, then try to send it. Resolves once the hand is stored,
 * so a lost connection never loses it.
 */
export async function saveHand(input: {
  sessionId: string;
  row: QueuedHand['row'];
}): Promise<QueuedHand> {
  const userId = await currentUserId();
  if (!userId) throw new Error('not signed in');
  const item: QueuedHand = {
    id: crypto.randomUUID(),
    userId,
    sessionId: input.sessionId,
    row: input.row,
    createdAt: Date.now(),
    status: 'pending',
  };
  await idbStore.put(item);
  await notify(null);
  void flush();
  return item;
}

/** Take back a hand saved a moment ago, whether or not it reached the server. */
export async function undoHand(id: string): Promise<void> {
  // Wait for a running flush so a half-sent hand is not missed.
  await inFlight;
  const r = remote();
  await undoQueued(idbStore, id, r.delete);
  await notify(null);
}

/** Flush now and keep flushing when the network comes back or the app is reopened. */
export function startAutoSync() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const run = () => void flush();
  window.addEventListener('online', run);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') run();
  });
  setInterval(async () => {
    if ((await getCounts().catch(() => ({ pending: 0, failed: 0 }))).pending > 0) run();
  }, FLUSH_EVERY_MS);
  run();
}

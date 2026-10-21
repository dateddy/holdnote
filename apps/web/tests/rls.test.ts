/**
 * Row Level Security, end to end against the linked Supabase project.
 * Two throwaway users A and B; everything they create is removed in afterAll (cascade).
 * Run: pnpm test:rls
 */
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../src/lib/supabase/database.types';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
const configured = !!(url && publishable && secret);

type Client = SupabaseClient<Database>;
const OPTS = { auth: { persistSession: false, autoRefreshToken: false } };
const OWNED_TABLES = ['opponents', 'sessions', 'hands', 'reviews', 'user_rules'] as const;

describe.skipIf(!configured)('RLS', () => {
  const admin = configured ? createClient<Database>(url, secret, OPTS) : (null as never);
  const anon = configured ? createClient<Database>(url, publishable, OPTS) : (null as never);
  const userIds: string[] = [];
  let a: Client;
  let b: Client;
  let aId: string;
  let bId: string;
  const ids = {} as Record<(typeof OWNED_TABLES)[number], string>;

  async function makeUser(tag: string, locale: string) {
    const email = `rls-${tag}-${randomUUID().slice(0, 8)}@example.com`;
    const password = randomUUID();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `RLS ${tag}`, locale },
    });
    if (error) throw error;
    userIds.push(data.user.id);
    const client = createClient<Database>(url!, publishable!, OPTS);
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    return { id: data.user.id, client };
  }

  beforeAll(async () => {
    const ua = await makeUser('a', 'en');
    const ub = await makeUser('b', 'vi');
    a = ua.client;
    b = ub.client;
    aId = ua.id;
    bId = ub.id;

    const opp = await a.from('opponents').insert({ name: 'Seat 3' }).select('id').single();
    const sess = await a
      .from('sessions')
      .insert({ kind: 'cash', mode: 'live', sb: 25, bb: 50 } as never)
      .select('id')
      .single();
    if (opp.error || sess.error) throw opp.error ?? sess.error;
    ids.opponents = opp.data.id;
    ids.sessions = sess.data.id;

    const hand = await a
      .from('hands')
      .insert({
        session_id: ids.sessions,
        num: 1,
        hero_cards: ['Ah', 'Kd'],
        opponent_id: ids.opponents,
        actions: [{ street: 'preflop', actor: 'hero', act: 'raise', amount: 150 }],
        result: -18000,
        level: 8,
      })
      .select('id')
      .single();
    if (hand.error) throw hand.error;
    ids.hands = hand.data.id;

    const review = await a
      .from('reviews')
      .insert({ hand_id: ids.hands, source: 'manual', error_tags: ['sizing_too_small'] })
      .select('id')
      .single();
    const rule = await a
      .from('user_rules')
      .insert({ text: 'Fold more', source_session_id: ids.sessions })
      .select('id')
      .single();
    if (review.error || rule.error) throw review.error ?? rule.error;
    ids.reviews = review.data.id;
    ids.user_rules = rule.data.id;

    // Server-side rows the client must never see or write.
    const key = await admin
      .from('user_api_keys')
      .insert({ user_id: aId, provider: 'openrouter', vault_secret_id: randomUUID() });
    const usage = await admin
      .from('ai_usage')
      .insert({ user_id: aId, kind: 'hand_review', model: 'test', tokens_in: 1, tokens_out: 1 });
    if (key.error || usage.error) throw key.error ?? usage.error;
  });

  afterAll(async () => {
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
    if (userIds.length) {
      const left = await admin.from('sessions').select('id').in('user_id', userIds);
      expect(left.data ?? []).toHaveLength(0);
    }
  });

  describe('owner (A)', () => {
    it('gets a profile from the sign-up trigger, locale from metadata', async () => {
      const { data, error } = await a.from('profiles').select('id, locale, plan').single();
      expect(error).toBeNull();
      expect(data).toMatchObject({ id: aId, locale: 'en', plan: 'free' });
    });

    it('hand level round-trips and must be positive', async () => {
      const { data } = await a.from('hands').select('level').eq('id', ids.hands).single();
      expect(data?.level).toBe(8);
      const bad = await a.from('hands').update({ level: 0 }).eq('id', ids.hands);
      expect(bad.error).not.toBeNull();
    });

    it('chip rate needs both columns and a CHIP session; another user cannot change it', async () => {
      const only = await a.from('sessions').update({ chip_value: 1000 }).eq('id', ids.sessions);
      expect(only.error).not.toBeNull();
      const notChip = await a
        .from('sessions')
        .update({ chip_value: 1000, chip_currency: 'VND' })
        .eq('id', ids.sessions);
      expect(notChip.error).not.toBeNull();
      const ok = await a
        .from('sessions')
        .update({ currency: 'CHIP', chip_value: 1000, chip_currency: 'VND' })
        .eq('id', ids.sessions);
      expect(ok.error).toBeNull();
      const theirs = await b
        .from('sessions')
        .update({ chip_value: 1 })
        .eq('id', ids.sessions)
        .select('id');
      expect(theirs.data ?? []).toEqual([]);
      const reset = await a
        .from('sessions')
        .update({ chip_value: null, chip_currency: null, currency: 'VND' })
        .eq('id', ids.sessions);
      expect(reset.error).toBeNull();
    });

    it('session without currency takes the profile currency', async () => {
      const { data } = await a.from('sessions').select('currency').eq('id', ids.sessions).single();
      const { data: profile } = await a.from('profiles').select('currency').single();
      expect(data?.currency).toBe(profile?.currency);
    });

    it('reads all own rows', async () => {
      for (const table of OWNED_TABLES) {
        const { data, error } = await a.from(table).select('id').eq('id', ids[table]);
        expect(error, table).toBeNull();
        expect(data, table).toHaveLength(1);
      }
    });

    it('rejects invalid cards', async () => {
      const { error } = await a
        .from('hands')
        .insert({ session_id: ids.sessions, num: 2, hero_cards: ['Xx'] });
      expect(error).not.toBeNull();
    });

    it('leak_stats shows own tags', async () => {
      const { data, error } = await a.from('leak_stats').select('tag');
      expect(error).toBeNull();
      expect(data?.map((r) => r.tag)).toContain('sizing_too_small');
    });

    it('can change own locale but not own plan', async () => {
      const loc = await a.from('profiles').update({ locale: 'vi' }).eq('id', aId).select('locale');
      expect(loc.data?.[0]?.locale).toBe('vi');
      const plan = await a
        .from('profiles')
        .update({ plan: 'pro' } as never)
        .eq('id', aId);
      expect(plan.error).not.toBeNull();
    });

    it('can set own onboarding fields, within the allowed values', async () => {
      const now = new Date().toISOString();
      const ok = await a
        .from('profiles')
        .update({ onboarded_at: now, play_mode: 'live', play_kind: 'mtt' })
        .eq('id', aId)
        .select('onboarded_at, play_mode, play_kind');
      expect(ok.error).toBeNull();
      expect(ok.data?.[0]).toMatchObject({ play_mode: 'live', play_kind: 'mtt' });
      const bad = await a
        .from('profiles')
        .update({ play_kind: 'sng' } as never)
        .eq('id', aId);
      expect(bad.error).not.toBeNull();
    });

    it('cannot write ai_usage (quota is server-side)', async () => {
      const ins = await a
        .from('ai_usage')
        .insert({ user_id: aId, kind: 'hand_review', model: 'x' } as never);
      expect(ins.error).not.toBeNull();
      const del = await a.from('ai_usage').delete().eq('user_id', aId).select('id');
      expect(del.data ?? []).toHaveLength(0);
      const { count } = await admin
        .from('ai_usage')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', aId);
      expect(count).toBe(1);
    });

    it('ai_usage.failed defaults to false and the client cannot mark rows failed', async () => {
      const row = await admin.from('ai_usage').select('failed').eq('user_id', aId).single();
      expect(row.data?.failed).toBe(false);
      const upd = await a
        .from('ai_usage')
        .update({ failed: true } as never)
        .eq('user_id', aId)
        .select('id');
      expect(upd.data ?? []).toHaveLength(0);
    });

    it('cannot read user_api_keys at all, not even own row', async () => {
      for (const columns of ['vault_secret_id', 'provider', '*']) {
        const { data, error } = await a.from('user_api_keys').select(columns);
        expect(!!error || (data ?? []).length === 0, columns).toBe(true);
      }
    });
  });

  describe('other user (B)', () => {
    it('reads none of A rows', async () => {
      for (const table of OWNED_TABLES) {
        const { data, error } = await b.from(table).select('id').eq('id', ids[table]);
        expect(error, table).toBeNull();
        expect(data, table).toHaveLength(0);
      }
      const profile = await b.from('profiles').select('id').eq('id', aId);
      expect(profile.data).toHaveLength(0);
      const leak = await b.from('leak_stats').select('tag');
      expect(leak.data).toHaveLength(0);
    });

    it('updates 0 rows of A', async () => {
      const patches = {
        opponents: { notes: 'x' },
        sessions: { venue: 'x' },
        hands: { thought: 'x', level: 9 },
        reviews: { lesson: 'x' },
        user_rules: { text: 'x' },
      } as const;
      for (const table of OWNED_TABLES) {
        const { data } = await b
          .from(table)
          .update(patches[table] as never)
          .eq('id', ids[table])
          .select('id');
        expect(data ?? [], table).toHaveLength(0);
      }
      const prof = await b
        .from('profiles')
        .update({ display_name: 'x' })
        .eq('id', aId)
        .select('id');
      expect(prof.data ?? []).toHaveLength(0);
    });

    it('deletes 0 rows of A', async () => {
      for (const table of [...OWNED_TABLES].reverse()) {
        const { data } = await b.from(table).delete().eq('id', ids[table]).select('id');
        expect(data ?? [], table).toHaveLength(0);
      }
    });

    it('A rows are untouched afterwards', async () => {
      for (const table of OWNED_TABLES) {
        const { data } = await a.from(table).select('id').eq('id', ids[table]);
        expect(data, table).toHaveLength(1);
      }
      const { data } = await a.from('sessions').select('venue').eq('id', ids.sessions).single();
      expect(data?.venue).toBeNull();
    });

    it('cannot insert rows with A user_id', async () => {
      const rows = {
        opponents: { user_id: aId, name: 'x' },
        sessions: { user_id: aId, kind: 'cash', mode: 'live', currency: 'USD' },
        hands: { user_id: aId, session_id: ids.sessions, num: 50 },
        reviews: { user_id: aId, hand_id: ids.hands, source: 'manual' },
        user_rules: { user_id: aId, text: 'x' },
      };
      for (const table of OWNED_TABLES) {
        const { error } = await b.from(table).insert(rows[table] as never);
        expect(error, table).not.toBeNull();
      }
      const profile = await b.from('profiles').insert({ id: aId } as never);
      expect(profile.error).not.toBeNull();
    });

    it('cannot attach own rows to A parents', async () => {
      const hand = await b.from('hands').insert({ session_id: ids.sessions, num: 9 });
      expect(hand.error).not.toBeNull();
      const review = await b.from('reviews').insert({ hand_id: ids.hands, source: 'manual' });
      expect(review.error).not.toBeNull();
    });
  });

  describe('AI review helpers', () => {
    it('users and signed-out callers cannot call the Vault functions', async () => {
      for (const client of [a, b, anon]) {
        const calls = [
          client.rpc('set_user_api_key', { p_user: aId, p_key: 'sk-x', p_model: null } as never),
          client.rpc('get_user_api_key', { p_user: aId } as never),
          client.rpc('delete_user_api_key', { p_user: aId } as never),
        ];
        for (const { error } of await Promise.all(calls)) expect(error).not.toBeNull();
      }
    });

    it('server stores, reads and deletes a key in Vault; client never sees it', async () => {
      const set = await admin.rpc('set_user_api_key', {
        p_user: bId,
        p_key: 'sk-test-secret',
        p_model: 'some/model',
      });
      expect(set.error).toBeNull();
      const got = await admin.rpc('get_user_api_key', { p_user: bId });
      expect(got.data?.[0]).toMatchObject({ api_key: 'sk-test-secret', model: 'some/model' });
      const own = await b.from('user_api_keys').select('*');
      expect(!!own.error || (own.data ?? []).length === 0).toBe(true);
      const del = await admin.rpc('delete_user_api_key', { p_user: bId });
      expect(del.error).toBeNull();
      const after = await admin.rpc('get_user_api_key', { p_user: bId });
      expect(after.data ?? []).toHaveLength(0);
    });

    it('replace_current_review keeps one current review per kind and keeps history', async () => {
      const id = await a.rpc('replace_current_review', {
        p_hand_id: ids.hands,
        p_review: { source: 'ai', model: 'm', error_tags: ['bad_bluff'], lesson: 'l' },
      });
      expect(id.error).toBeNull();
      const { data } = await a
        .from('reviews')
        .select('id, source, is_current, error_tags')
        .eq('hand_id', ids.hands);
      // The AI review is the current one of its kind; the student's own review stays current too.
      expect(data?.filter((r) => r.is_current && r.source === 'ai')).toHaveLength(1);
      expect(data?.filter((r) => r.is_current && r.source === 'manual')).toHaveLength(1);
      expect(data?.find((r) => r.is_current && r.source === 'ai')).toMatchObject({
        id: id.data,
        error_tags: ['bad_bluff'],
      });
      // A second AI review retires only the first one.
      const again = await a.rpc('replace_current_review', {
        p_hand_id: ids.hands,
        p_review: { source: 'ai', model: 'm2', error_tags: ['tilt'] },
      });
      expect(again.error).toBeNull();
      const after = await a.from('reviews').select('source, is_current').eq('hand_id', ids.hands);
      expect(after.data?.filter((r) => r.is_current && r.source === 'ai')).toHaveLength(1);
      expect(after.data?.filter((r) => r.is_current && r.source === 'manual')).toHaveLength(1);
      expect(after.data?.length).toBeGreaterThanOrEqual(3);
    });

    it('two current reviews of the same kind are refused', async () => {
      const dup = await a
        .from('reviews')
        .insert({ hand_id: ids.hands, source: 'manual', is_current: true });
      expect(dup.error).not.toBeNull();
    });

    it('the leak table counts the own review of a hand, not the AI one', async () => {
      const { data } = await a
        .from('leak_stats')
        .select('tag, source')
        .eq('source', 'review')
        .eq('session_id', ids.sessions);
      const tags = (data ?? []).map((r) => r.tag);
      expect(tags).toContain('sizing_too_small');
      expect(tags).not.toContain('tilt');
      expect(tags).not.toContain('bad_bluff');
    });

    it('B cannot replace the review of A hand', async () => {
      const before = await a
        .from('reviews')
        .select('id')
        .eq('hand_id', ids.hands)
        .eq('is_current', true);
      const { error } = await b.rpc('replace_current_review', {
        p_hand_id: ids.hands,
        p_review: { source: 'manual' },
      });
      expect(error).not.toBeNull();
      const { data } = await a
        .from('reviews')
        .select('id')
        .eq('hand_id', ids.hands)
        .eq('is_current', true);
      expect(data).toHaveLength(before.data?.length ?? -1);
    });

    it('signed-out callers cannot call replace_current_review', async () => {
      const { error } = await anon.rpc('replace_current_review', {
        p_hand_id: ids.hands,
        p_review: { source: 'manual' },
      });
      expect(error).not.toBeNull();
    });
  });

  describe('signed out', () => {
    it('reads nothing', async () => {
      for (const table of ['profiles', ...OWNED_TABLES, 'ai_usage', 'user_api_keys'] as const) {
        const { data, error } = await anon.from(table).select('*');
        expect(!!error || (data ?? []).length === 0, table).toBe(true);
      }
    });
  });
});

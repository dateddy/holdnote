// End-to-end RLS check against the linked Supabase project.
// Creates two throwaway users, checks every isolation rule, then deletes them (cascade cleans up).
// Run: pnpm --filter web rls:check   (reads ../../.env.local)
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !publishable || !secret) {
  console.error('Missing Supabase env vars in .env.local');
  process.exit(1);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, opts);
const anon = createClient(url, publishable, opts);

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  -> ${detail}`}`);
  if (!ok) failures++;
}

async function makeUser(tag) {
  const email = `rls-${tag}-${randomUUID().slice(0, 8)}@example.com`;
  const password = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `RLS ${tag}`, locale: 'en' },
  });
  if (error) throw error;
  const client = createClient(url, publishable, opts);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

const users = [];
try {
  const a = await makeUser('a');
  users.push(a);
  const b = await makeUser('b');
  users.push(b);

  // Profile created by trigger, locale taken from sign-up metadata.
  const profile = await a.client.from('profiles').select('id, locale, currency, plan').single();
  check('profile auto-created', profile.data?.id === a.id, profile.error?.message);
  check('profile locale from metadata', profile.data?.locale === 'en');

  // A creates data. Session without currency gets the profile currency.
  const opp = await a.client.from('opponents').insert({ name: 'Seat 3' }).select().single();
  const sess = await a.client
    .from('sessions')
    .insert({ kind: 'cash', mode: 'live', bb: 50, sb: 25 })
    .select()
    .single();
  check('A creates session', !!sess.data, sess.error?.message);
  check('session currency defaults to profile', sess.data?.currency === profile.data?.currency);
  const hand = await a.client
    .from('hands')
    .insert({
      session_id: sess.data.id,
      num: 1,
      hero_cards: ['Ah', 'Kd'],
      opponent_id: opp.data.id,
      actions: [{ street: 'preflop', actor: 'hero', act: 'raise', amount: 150 }],
      result: -18000,
    })
    .select()
    .single();
  check('A creates hand', !!hand.data, hand.error?.message);
  const review = await a.client
    .from('reviews')
    .insert({ hand_id: hand.data.id, source: 'manual', error_tags: ['sizing_too_small'] })
    .select()
    .single();
  check('A creates review', !!review.data, review.error?.message);
  const rule = await a.client
    .from('user_rules')
    .insert({ text: 'Fold more', source_session_id: sess.data.id })
    .select()
    .single();
  check('A creates rule', !!rule.data, rule.error?.message);

  const bad = await a.client
    .from('hands')
    .insert({ session_id: sess.data.id, num: 2, hero_cards: ['Xx'] });
  check('invalid card rejected', !!bad.error);

  // B sees nothing of A.
  for (const table of ['profiles', 'opponents', 'sessions', 'hands', 'reviews', 'user_rules']) {
    const { data, error } = await b.client.from(table).select('*');
    const foreign = (data ?? []).filter((r) => (r.user_id ?? r.id) === a.id);
    check(`B cannot read A ${table}`, !error && foreign.length === 0, error?.message);
  }
  const leak = await b.client.from('leak_stats').select('*');
  check('B leak_stats empty', !leak.error && leak.data.length === 0, leak.error?.message);
  const leakA = await a.client.from('leak_stats').select('*');
  check(
    'A leak_stats sees own tag',
    leakA.data?.some((r) => r.tag === 'sizing_too_small'),
    leakA.error?.message,
  );

  const upd = await b.client
    .from('sessions')
    .update({ venue: 'hacked' })
    .eq('id', sess.data.id)
    .select();
  check('B cannot update A session', (upd.data ?? []).length === 0);
  const del = await b.client.from('sessions').delete().eq('id', sess.data.id).select();
  check('B cannot delete A session', (del.data ?? []).length === 0);
  const still = await a.client.from('sessions').select('venue').eq('id', sess.data.id).single();
  check('A session untouched', still.data && still.data.venue === null);

  const steal = await b.client.from('hands').insert({ session_id: sess.data.id, num: 9 });
  check('B cannot add hand to A session', !!steal.error);
  const stealReview = await b.client
    .from('reviews')
    .insert({ hand_id: hand.data.id, source: 'manual' });
  check('B cannot review A hand', !!stealReview.error);

  // Restricted columns / server-only tables.
  const plan = await a.client.from('profiles').update({ plan: 'pro' }).eq('id', a.id);
  check('A cannot change own plan', !!plan.error);
  const loc = await a.client
    .from('profiles')
    .update({ locale: 'vi' })
    .eq('id', a.id)
    .select('locale');
  check('A can change own locale', loc.data?.[0]?.locale === 'vi', loc.error?.message);
  const usage = await a.client
    .from('ai_usage')
    .insert({ user_id: a.id, kind: 'hand_review', model: 'x' });
  check('A cannot write ai_usage', !!usage.error);
  const vault = await a.client.from('user_api_keys').select('vault_secret_id');
  check('A cannot read vault_secret_id', !!vault.error);

  // Not signed in.
  for (const table of ['profiles', 'sessions', 'hands']) {
    const { data, error } = await anon.from(table).select('*');
    check(`anon cannot read ${table}`, !!error || (data ?? []).length === 0);
  }
} catch (e) {
  check('script ran', false, e?.message ?? String(e));
} finally {
  for (const u of users) await admin.auth.admin.deleteUser(u.id);
  const left = await admin
    .from('sessions')
    .select('id')
    .in(
      'user_id',
      users.map((u) => u.id),
    );
  check('cleanup cascades', (left.data ?? []).length === 0, left.error?.message);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll RLS checks passed');
process.exit(failures ? 1 : 0);

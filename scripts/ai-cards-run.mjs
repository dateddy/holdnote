/**
 * Real AI reviews of five hands whose made hand changes street by street (task 5.1f), through
 * /api/review on a running build, so the card check runs as in production.
 *
 *   pnpm --filter web build && pnpm --filter web start -p 3100   (other terminal)
 *   node scripts/ai-cards-run.mjs
 *
 * Throwaway user, deleted at the end. Costs a few real model calls on the app key.
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const { createClient } = createRequire(new URL('../apps/web/package.json', import.meta.url))(
  '@supabase/supabase-js',
);

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const OPTS = { auth: { persistSession: false, autoRefreshToken: false } };

const admin = createClient(URL_, env.SUPABASE_SECRET_KEY, OPTS);
const users = [];
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok    ' : 'FAILED'} ${what}`);
  if (!ok) failures.push(what);
};

async function makeUser() {
  const email = `screens-${randomUUID().slice(0, 8)}@example.com`;
  const password = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Screens', locale: 'vi' },
  });
  if (error) throw error;
  const id = data.user.id;
  users.push(id);
  await admin
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString(), locale: 'vi', play_kind: 'cash' })
    .eq('id', id);
  const anon = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, OPTS);
  const { data: signed, error: signError } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (signError) throw signError;
  return { id, session: signed.session };
}

function authCookies(session) {
  const ref = new globalThis.URL(URL_).hostname.split('.')[0];
  const name = `sb-${ref}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  const chunks = value.match(/.{1,3180}/g) ?? [];
  const host = new globalThis.URL(BASE).hostname;
  return chunks.map((v, i) => ({
    name: chunks.length === 1 ? name : `${name}.${i}`,
    value: v,
    domain: host,
    path: '/',
  }));
}

const a = (street, actor, pos, act, amount) => ({
  street,
  actor,
  pos,
  act,
  ...(amount !== undefined && { amount }),
});

// Hero MP vs Villain BTN, a hand that reaches the river. Bets in chips, blinds 25/50.
const flow = [
  a('preflop', 'hero', 'MP', 'raise', 150),
  a('preflop', 'villain', 'BTN', 'call', 150),
  a('flop', 'hero', 'MP', 'bet', 200),
  a('flop', 'villain', 'BTN', 'call', 200),
  a('turn', 'hero', 'MP', 'check'),
  a('turn', 'villain', 'BTN', 'bet', 400),
  a('turn', 'hero', 'MP', 'call', 400),
  a('river', 'hero', 'MP', 'check'),
  a('river', 'villain', 'BTN', 'bet', 1500),
  a('river', 'hero', 'MP', 'call', 1500),
];

/** Hero cards, board, and what the hand is on flop / turn / river (from poker-core's evaluator). */
const CASES = [
  [
    'Ad Qd',
    'Qc 7s 2h Ah Qh',
    ['pair of queens', 'two pair, aces and queens', 'full house, queens full of aces'],
  ],
  ['9h 8h', '7h 6c 2h Kd 5s', ['high card nine', 'high card king', 'straight, nine high']],
  [
    'Js Jc',
    'Jd 9s 4h 9c 2d',
    [
      'three of a kind, jacks',
      'full house, jacks full of nines',
      'full house, jacks full of nines',
    ],
  ],
  ['Kh Qh', 'Ah Th 3c 2h 8s', ['high card ace', 'flush, ace high', 'flush, ace high']],
  [
    '7c 7d',
    'Kc 8s 3h 7h Ks',
    ['pair of sevens', 'three of a kind, sevens', 'full house, sevens full of kings'],
  ],
];

/** Words the AI must use for the river hand (Vietnamese keeps the English terms). */
const RIVER_WORDS = [
  /full house|cù lũ/i,
  /straight|sảnh/i,
  /full house|cù lũ/i,
  /flush|thùng/i,
  /full house|cù lũ/i,
];

async function main() {
  const user = await makeUser();
  const { data: session, error } = await admin
    .from('sessions')
    .insert({
      user_id: user.id,
      kind: 'cash',
      mode: 'live',
      currency: 'CHIP',
      venue: 'AI check',
      stake_label: '25/50',
      sb: 25,
      bb: 50,
      seats: 9,
      buyin: 5000,
      date: '2026-10-23',
    })
    .select('id')
    .single();
  if (error) throw error;
  const { data: hands, error: handError } = await admin
    .from('hands')
    .insert(
      CASES.map(([hero, board], i) => ({
        user_id: user.id,
        session_id: session.id,
        num: i + 1,
        hero_cards: hero.split(' '),
        board: board.split(' '),
        hero_pos: 'MP',
        villain_pos: 'BTN',
        hero_stack: 5000,
        villain_stack: 5000,
        outcome: 'lose',
        result: -2250,
        actions: flow,
      })),
    )
    .select('id, num');
  if (handError) throw handError;

  const cookie = authCookies(user.session)
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  let named = 0;
  let flagged = 0;
  for (const h of hands.sort((x, y) => x.num - y.num)) {
    const [hero, board, made] = CASES[h.num - 1];
    const res = await fetch(`${BASE}/api/review`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ hand_id: h.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.log(`#${h.num} ${hero} | ${board}: error ${data.error}`);
      continue;
    }
    const r = data.review;
    const text = [r.range_text, r.math_text, r.line_text, r.lesson].join('\n');
    const ok = RIVER_WORDS[h.num - 1].test(text);
    named += ok ? 1 : 0;
    flagged += data.card_flag ? 1 : 0;
    console.log(`\n#${h.num} Hero ${hero} | board ${board}`);
    console.log(`  real: flop ${made[0]}; turn ${made[1]}; river ${made[2]}`);
    console.log(
      `  river hand named: ${ok ? 'yes' : 'NO'} · card flag: ${data.card_flag ? 'YES' : 'no'}`,
    );
    console.log(`  ${text.replace(/\n/g, '\n  ')}`);
  }
  const { data: usage } = await admin
    .from('ai_usage')
    .select('kind, tokens_in, tokens_out, cost_usd, failed')
    .eq('user_id', user.id);
  const cost = (usage ?? []).reduce((n, u) => n + Number(u.cost_usd), 0);
  console.log(`\nRiver hand named right: ${named}/${hands.length} · flagged: ${flagged}`);
  console.log(`Calls logged: ${usage?.length} · cost $${cost.toFixed(6)}`);
  console.log(JSON.stringify(usage));
}

try {
  await main();
} finally {
  for (const id of users) await admin.auth.admin.deleteUser(id);
}

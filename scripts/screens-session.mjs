/**
 * Screenshots and checks for task 5.1d-2a (session detail + hand table) at 375 x 667 and 1440 x 900.
 *
 *   pnpm --filter web build && HOLDNOTE_SCREENS=1 pnpm --filter web start -p 3100   (other terminal)
 *   node scripts/screens-session.mjs
 *
 * Creates one throwaway user (Supabase secret key) with a cash session, an MTT session, a session
 * left open for 20 hours and an open one, signs in with the session cookie and deletes the user at
 * the end. Pictures land in screens/5.1d-2a/ (ignored by git).
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';

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
const OUT = process.env.SCREENS_DIR ?? 'screens/5.1d-2a';
const OPTS = { auth: { persistSession: false, autoRefreshToken: false } };
const chrome = join(homedir(), 'AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe');
mkdirSync(OUT, { recursive: true });

const admin = createClient(URL_, env.SUPABASE_SECRET_KEY, OPTS);
const users = [];
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok    ' : 'FAILED'} ${what}`);
  if (!ok) failures.push(what);
};

async function makeUser() {
  const email = `screens-session-${randomUUID().slice(0, 8)}@example.com`;
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

const iso = (date, hhmm) => `${date}T${hhmm}:00+07:00`;
const A = (street, actor, pos, act, amount) => ({
  street,
  actor,
  pos,
  act,
  ...(amount !== undefined && { amount }),
});

/** Hands as the app saves them before DEC-045 (no forced bets): blinds come from the session. */
const cashHands = [
  {
    // The golden hand: −360 bb.
    hero_cards: ['Ah', 'Kd'],
    board: ['7c', '8d', '2s', 'Jh', '3c'],
    hero_pos: 'MP',
    villain_pos: 'BTN',
    hero_stack: 18000,
    villain_stack: 20000,
    outcome: 'lose',
    result: -18000,
    flagged: true,
    thought: 'Call river all-in quá rộng? Đối thủ chỉ có nut hoặc bluff.',
    actions: [
      A('preflop', 'hero', 'MP', 'call', 50),
      A('preflop', 'villain', 'BTN', 'raise', 500),
      A('preflop', 'hero', 'MP', 'call', 500),
      A('flop', 'hero', 'MP', 'check'),
      A('flop', 'villain', 'BTN', 'bet', 500),
      A('flop', 'hero', 'MP', 'call', 500),
      A('turn', 'hero', 'MP', 'check'),
      A('turn', 'villain', 'BTN', 'bet', 1000),
      A('turn', 'hero', 'MP', 'call', 1000),
      A('river', 'hero', 'MP', 'bet', 5000),
      A('river', 'villain', 'BTN', 'all-in'),
      A('river', 'hero', 'MP', 'call'),
    ],
  },
  {
    hero_cards: ['Qs', 'Qd'],
    board: ['Jc', '7h', '2d'],
    hero_pos: 'CO',
    villain_pos: 'BB',
    hero_stack: 10000,
    villain_stack: 12000,
    outcome: 'win',
    result: 600,
    flagged: false,
    thought: 'Value bet mỏng, đối thủ call.',
    actions: [
      A('preflop', 'hero', 'CO', 'raise', 150),
      A('preflop', 'villain', 'BB', 'call', 150),
      A('flop', 'villain', 'BB', 'check'),
      A('flop', 'hero', 'CO', 'bet', 200),
      A('flop', 'villain', 'BB', 'fold'),
    ],
  },
  {
    hero_cards: ['9h', '9d'],
    board: ['Kc', '9s', '4h', '2d'],
    hero_pos: 'BTN',
    villain_pos: 'SB',
    hero_stack: 9000,
    villain_stack: 9000,
    outcome: 'win',
    result: 1750,
    flagged: true,
    actions: [
      A('preflop', 'villain', 'SB', 'raise', 150),
      A('preflop', 'hero', 'BTN', 'raise', 450),
      A('preflop', 'villain', 'SB', 'call', 450),
      A('flop', 'villain', 'SB', 'check'),
      A('flop', 'hero', 'BTN', 'bet', 300),
      A('flop', 'villain', 'SB', 'raise', 900),
      A('flop', 'hero', 'BTN', 'call', 900),
      A('turn', 'villain', 'SB', 'check'),
      A('turn', 'hero', 'BTN', 'check'),
    ],
  },
  {
    hero_cards: ['7s', '6s'],
    board: ['Ad', 'Kd', '5c'],
    hero_pos: 'UTG',
    villain_pos: 'BB',
    hero_stack: 8000,
    villain_stack: 8000,
    outcome: 'fold',
    result: -150,
    flagged: false,
    missing_data: true,
    actions: [
      A('preflop', 'hero', 'UTG', 'raise', 150),
      A('preflop', 'villain', 'BB', 'call', 150),
      A('flop', 'villain', 'BB', 'bet', 250),
      A('flop', 'hero', 'UTG', 'fold'),
    ],
  },
  {
    hero_cards: ['Ac', '5c'],
    board: [],
    hero_pos: 'SB',
    villain_pos: 'BB',
    hero_stack: 8000,
    villain_stack: 8000,
    outcome: 'fold',
    result: -25,
    flagged: false,
    actions: [A('preflop', 'hero', 'SB', 'fold')],
  },
  {
    hero_cards: ['Kh', 'Qh'],
    board: ['Th', '4h', '9s', 'Jd', '2c'],
    hero_pos: 'HJ',
    villain_pos: 'BTN',
    hero_stack: 12000,
    villain_stack: 12000,
    outcome: 'win',
    result: 3200,
    flagged: false,
    actions: [
      A('preflop', 'hero', 'HJ', 'raise', 150),
      A('preflop', 'villain', 'BTN', 'call', 150),
      A('flop', 'hero', 'HJ', 'bet', 200),
      A('flop', 'villain', 'BTN', 'call', 200),
      A('turn', 'hero', 'HJ', 'bet', 600),
      A('turn', 'villain', 'BTN', 'call', 600),
      A('river', 'hero', 'HJ', 'bet', 1500),
      A('river', 'villain', 'BTN', 'call', 1500),
    ],
  },
];

async function seed(userId) {
  const base = {
    user_id: userId,
    currency: 'VND',
    venue: 'Chill',
    seats: 9,
  };
  const rows = [
    {
      ...base,
      kind: 'cash',
      mode: 'live',
      stake_label: '25/50',
      sb: 25,
      bb: 50,
      buyin: 10000,
      cashout: 12500,
      date: '2026-10-14',
      start_at: iso('2026-10-14', '19:00'),
      end_at: iso('2026-10-14', '22:30'),
    },
    {
      ...base,
      kind: 'mtt',
      mode: 'online',
      venue: 'GGPoker',
      buyin: 500000,
      date: '2026-09-20',
      start_at: iso('2026-09-20', '14:00'),
      end_at: iso('2026-09-20', '19:00'),
      sb: 500,
      bb: 1000,
      mtt: {
        name: 'Sunday Million',
        type: 'bounty',
        reentry: true,
        reentries: 1,
        place: 12,
        entries: 180,
        prize: 3000000,
        bounty: 400000,
      },
    },
    {
      // Left open for 20 hours: the home page asks to end it.
      ...base,
      kind: 'cash',
      mode: 'live',
      stake_label: '25/50',
      sb: 25,
      bb: 50,
      buyin: 10000,
      date: '2026-10-20',
      start_at: new Date(Date.now() - 20 * 3_600_000).toISOString(),
    },
  ];
  const { data: sessions, error } = await admin.from('sessions').insert(rows).select('id, kind, date');
  if (error) throw error;
  const cash = sessions.find((s) => s.date === '2026-10-14');
  const mtt = sessions.find((s) => s.kind === 'mtt');
  const stale = sessions.find((s) => s.date === '2026-10-20');

  const handRow = (sessionId, h, i, extra = {}) => ({
    user_id: userId,
    session_id: sessionId,
    num: i + 1,
    missing_data: false,
    ...h,
    ...extra,
    created_at: new Date(Date.now() - (20 - i) * 3_600_000).toISOString(),
  });
  const hands = [
    ...cashHands.map((h, i) => handRow(cash.id, h, i)),
    ...cashHands.slice(0, 5).map((h, i) =>
      handRow(mtt.id, h, i, {
        level_bb: 1000,
        level: 8,
        stage: i < 3 ? 'bubble' : 'itm',
        result: Math.round((h.result ?? 0) * 20),
      }),
    ),
    handRow(stale.id, cashHands[1], 0),
  ];
  const { error: handError } = await admin.from('hands').insert(hands);
  if (handError) throw handError;
  return { cash: cash.id, mtt: mtt.id, stale: stale.id };
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

async function main() {
  const user = await makeUser();
  const ids = await seed(user.id);
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const errors = [];

  async function open(width, height) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2,
      colorScheme: 'dark',
    });
    await context.addCookies(authCookies(user.session));
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    return page;
  }

  // ---------------- phone ----------------
  {
    const page = await open(375, 667);
    const shot = (name, full = false) =>
      page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });

    // Home: the reminder for the session left open.
    await page.goto(`${BASE}/`);
    await page.getByRole('heading', { name: 'Phiên này còn mở' }).waitFor();
    check(true, 'home: reminder for a session open over 16 hours');
    await shot('phone-0-home-reminder');
    await page.getByRole('link', { name: 'Kết thúc phiên' }).first().click();
    await page.waitForURL(/\/end\?endAt=/);
    check(page.url().includes('endAt='), 'home: end link carries the chosen time');

    await page.goto(`${BASE}/sessions/${ids.cash}`);
    await page.getByRole('heading', { name: 'Chill' }).waitFor();
    check(
      (await page.evaluate(() => document.documentElement.scrollWidth)) <= 375,
      'phone cash: no horizontal scroll',
    );
    const heights = await page
      .locator('main > div.grid > div')
      .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
    check(new Set(heights).size === 1, `phone cash: tiles equal height (${heights.join(', ')})`);
    check(
      (await page.getByRole('link', { name: 'Tổng kết', exact: true }).count()) === 1,
      'phone cash: ended without debrief shows Tổng kết',
    );
    await shot('phone-1-cash');
    await shot('phone-1-cash-full', true);

    await page.getByRole('button', { name: 'Showdown', exact: true }).click();
    await page.getByRole('button', { name: /^Vị trí/ }).click();
    await page.getByRole('group', { name: 'Vị trí' }).getByRole('button').nth(1).click();
    await page.waitForTimeout(150);
    check(
      page.url().includes('sd=1') && page.url().includes('pos='),
      'phone cash: filter in the address',
    );
    await shot('phone-2-filtered');
    await page.reload();
    check(
      (await page.getByRole('button', { name: 'Showdown', exact: true }).getAttribute('aria-pressed')) ===
        'true',
      'phone cash: filter survives reload',
    );
    await page.getByRole('button', { name: 'Xóa lọc' }).click();

    await page.getByRole('button', { name: /^Sắp xếp/ }).click();
    await page.getByRole('group', { name: 'Sắp xếp' }).getByRole('button', { name: 'Thua nhiều' }).click();
    await page.waitForTimeout(150);
    const firstNum = await page.locator('ul li a').first().getAttribute('aria-label');
    check(firstNum === 'Hand 1', `phone cash: biggest loss first (${firstNum})`);

    await page.getByRole('button', { name: 'Thêm' }).click();
    await page.waitForTimeout(150);
    await shot('phone-3-menu');
    await page.keyboard.press('Escape');

    // Tap a hand: the hand page; Back returns with the filter.
    await page.getByRole('button', { name: 'Cần xem lại', exact: true }).click();
    await page.locator('ul li a').first().click();
    await page.waitForURL(/\/hands\//);
    check(page.url().includes('review=1'), 'phone: hand page keeps the filter in its address');
    await page.getByRole('link', { name: 'Về phiên' }).click();
    await page.waitForURL(/\/sessions\//);
    check(page.url().includes('review=1'), 'phone: back to the session keeps the filter');

    await page.goto(`${BASE}/sessions/${ids.mtt}`);
    await page.getByRole('heading', { name: 'Sunday Million' }).waitFor();
    check(
      (await page.evaluate(() => document.documentElement.scrollWidth)) <= 375,
      'phone mtt: no horizontal scroll',
    );
    check(
      (await page.getByRole('button', { name: /^Giai đoạn/ }).count()) === 1,
      'phone mtt: stage filter',
    );
    await shot('phone-4-mtt');
    await shot('phone-4-mtt-full', true);

    // Edit page.
    await page.goto(`${BASE}/sessions/${ids.cash}/edit`);
    await page.getByRole('heading', { name: 'Sửa phiên' }).waitFor();
    check(
      (await page.locator('input[name="venue"]').inputValue()) === 'Chill',
      'edit: form filled from the session',
    );
    await page.locator('input[name="venue"]').fill('Chill Club');
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await page.waitForURL(new RegExp(`/sessions/${ids.cash}$`));
    await page.getByRole('heading', { name: 'Chill Club' }).waitFor();
    check(true, 'edit: saved, back on the session');

    // Delete (the 20-hour session) with confirmation.
    await page.goto(`${BASE}/sessions/${ids.stale}`);
    await page.getByRole('button', { name: 'Thêm' }).click();
    await page.getByRole('menuitem', { name: 'Xóa phiên' }).click();
    await page.getByRole('dialog').waitFor();
    await shot('phone-5-delete-dialog');
    await page.getByRole('button', { name: 'Hủy' }).click();
    check((await admin.from('sessions').select('id').eq('id', ids.stale)).data.length === 1, 'delete: cancel keeps it');
    await page.getByRole('button', { name: 'Thêm' }).click();
    await page.getByRole('menuitem', { name: 'Xóa phiên' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Xóa phiên' }).click();
    await page.waitForURL(`${BASE}/`);
    check((await admin.from('sessions').select('id').eq('id', ids.stale)).data.length === 0, 'delete: confirmed');
    await page.context().close();
  }

  // ---------------- desktop ----------------
  {
    const page = await open(1440, 900);
    const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
    await page.goto(`${BASE}/sessions/${ids.cash}`);
    await page.getByRole('table', { name: 'Danh sách hand' }).waitFor();
    check(
      await page.getByRole('columnheader', { name: 'Preflop' }).isVisible(),
      'desktop: street columns',
    );
    await shot('desktop-1-cash');

    const selected = () =>
      page.locator('tr[aria-selected="true"]').first().getAttribute('data-hand-id');
    const first = await selected();
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);
    const second = await selected();
    check(first !== second, 'desktop: ↓ moves to the next hand');
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(100);
    check((await selected()) === first, 'desktop: ↑ moves back');
    const before = await admin.from('hands').select('flagged').eq('id', first).single();
    await page.keyboard.press('r');
    await page.waitForTimeout(800);
    const after = await admin.from('hands').select('flagged').eq('id', first).single();
    check(before.data.flagged !== after.data.flagged, 'desktop: R flips the review flag');
    await shot('desktop-2-panel');

    await page.getByRole('button', { name: 'Cần xem lại', exact: true }).click();
    await page.waitForTimeout(150);
    await shot('desktop-3-filtered');
    await page.goto(`${BASE}/sessions/${ids.mtt}`);
    await page.getByRole('table', { name: 'Danh sách hand' }).waitFor();
    await shot('desktop-4-mtt');
    await page.context().close();
  }

  await browser.close();
  check(errors.length === 0, `no console errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
}

try {
  await main();
} finally {
  for (const id of users) await admin.auth.admin.deleteUser(id);
}
if (failures.length) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exit(1);
}

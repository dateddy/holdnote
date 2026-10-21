/**
 * Screenshots and checks for tasks 5.1d-2a (session detail + hand table) and 5.1d-2b (replayer) at
 * 375 x 667 and 1440 x 900.
 *
 *   pnpm --filter web build && HOLDNOTE_SCREENS=1 pnpm --filter web start -p 3100   (other terminal)
 *   node scripts/screens-session.mjs
 *
 * Creates one throwaway user (Supabase secret key) with a cash session, an MTT session, a session
 * left open for 20 hours and an open one, signs in with the session cookie and deletes the user at
 * the end. Pictures land in screens/5.1d-2b/ (the MTT session also in screens/5.1d-2a/); ignored by git.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
// One source of truth with the tests: hands written by apps/web/src/lib/hands/fixtures.test.ts and
// the golden frames of packages/poker-core/test/replay.test.ts.
const FIXTURE = readJson('./fixtures/hands-5.1d-2b.json');
const GOLDEN = readJson('../packages/poker-core/test/fixtures/golden-frames.json');

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
const OUT = process.env.SCREENS_DIR ?? 'screens/5.1d-2b';
const OUT_2A = 'screens/5.1d-2a';
const OPTS = { auth: { persistSession: false, autoRefreshToken: false } };
const chrome = join(homedir(), 'AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe');
mkdirSync(OUT, { recursive: true });
mkdirSync(OUT_2A, { recursive: true });

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
      currency: 'CHIP',
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
  const { data: sessions, error } = await admin
    .from('sessions')
    .insert(rows)
    .select('id, kind, date');
  if (error) throw error;
  const cash = sessions.find((s) => s.date === '2026-10-14');
  const mtt = sessions.find((s) => s.kind === 'mtt');
  const stale = sessions.find((s) => s.date === '2026-10-20');

  const at = (i) => new Date(Date.now() - (30 - i) * 3_600_000).toISOString();
  const legacy = (sessionId, h, i, extra = {}) => ({
    user_id: userId,
    session_id: sessionId,
    num: i + 1,
    missing_data: false,
    tags: [],
    opponents: [],
    pot_winners: [],
    ...h,
    ...extra,
    created_at: at(i),
  });
  // Tournament chips: the cash hands above are in 25/50 money, a level of 500/1000 is 20 times that.
  const scale = (h, k) => ({
    ...h,
    hero_stack: h.hero_stack * k,
    villain_stack: h.villain_stack * k,
    result: h.result * k,
    actions: h.actions.map((a) => (a.amount === undefined ? a : { ...a, amount: a.amount * k })),
  });
  const saved = (sessionId, row, i) => ({
    ...row,
    user_id: userId,
    session_id: sessionId,
    num: i + 1,
    created_at: at(i),
  });

  const hands = [
    // Cash: the golden hand first (full format), five older ones, then the side pot hand.
    saved(cash.id, FIXTURE.golden, 0),
    ...cashHands.slice(1).map((h, i) => legacy(cash.id, h, i + 1)),
    saved(cash.id, FIXTURE.sidePot, cashHands.length),
    // MTT: the same older hands in chips of the tournament (bb 1000), and a saved tournament hand.
    ...cashHands.slice(1, 5).map((h, i) =>
      legacy(mtt.id, scale(h, 20), i, {
        level_bb: 1000,
        level: 8,
        stage: i < 2 ? 'bubble' : 'itm',
      }),
    ),
    saved(mtt.id, FIXTURE.mtt, 4),
    legacy(stale.id, cashHands[1], 0),
  ];
  const { data: inserted, error: handError } = await admin
    .from('hands')
    .insert(hands)
    .select('id, session_id, num');
  if (handError) throw handError;
  const idOf = (session, num) =>
    inserted.find((h) => h.session_id === session.id && h.num === num).id;

  // An AI review (prompt v1) on the golden hand.
  const goldenId = idOf(cash, 1);
  const { error: reviewError } = await admin.from('reviews').insert({
    user_id: userId,
    hand_id: goldenId,
    source: 'ai',
    model: 'screens/test',
    prompt_version: 'v1',
    range_text: 'Đối thủ tới river với set và các tay mạnh; bluff hiếm vì pot đã lớn.',
    math_text: 'Call 320bb vào pot ~400bb cần thắng khoảng 44%.',
    line_text: 'Check-call river là đủ; shove lại không có giá trị.',
    error_tags: ['call_too_loose'],
    ev_verdict: 'mistake',
    lesson: 'Gặp all-in lớn ở river khi range đối thủ lệch về value thì fold.',
    accepted: false,
  });
  if (reviewError) throw reviewError;

  return {
    cash: cash.id,
    mtt: mtt.id,
    stale: stale.id,
    golden: goldenId,
    sidePot: idOf(cash, cashHands.length + 1),
    mttHand: idOf(mtt, 5),
  };
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

/** Pot and the two stacks the replayer shows, in session money (data attributes of the table). */
async function readFrame(page) {
  return page.evaluate(() => {
    const num = (el, attr) => (el?.hasAttribute(attr) ? Number(el.getAttribute(attr)) : null);
    return {
      pot: num(document.querySelector('[data-pot]'), 'data-pot'),
      hero: num(document.querySelector('[data-seat="hero"]'), 'data-stack'),
      villain: num(document.querySelector('[data-seat="villain"]'), 'data-stack'),
    };
  });
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
    const shot = (name, full = false, dir = OUT) =>
      page.screenshot({ path: `${dir}/${name}.png`, fullPage: full });
    const noSideScroll = async (what) =>
      check(
        (await page.evaluate(() => document.documentElement.scrollWidth)) <= 375,
        `${what}: no horizontal scroll`,
      );

    // Home: the reminder for the session left open.
    await page.goto(`${BASE}/`);
    await page.getByRole('heading', { name: 'Phiên này còn mở' }).waitFor();
    check(true, 'home: reminder for a session open over 16 hours');
    await page.getByRole('link', { name: 'Kết thúc phiên' }).first().click();
    await page.waitForURL(/\/end\?endAt=/);
    check(page.url().includes('endAt='), 'home: end link carries the chosen time');

    await page.goto(`${BASE}/sessions/${ids.cash}`);
    await page.getByRole('heading', { name: 'Chill' }).waitFor();
    await noSideScroll('phone cash');
    const heights = await page
      .locator('main > div.grid > div')
      .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
    check(new Set(heights).size === 1, `phone cash: tiles equal height (${heights.join(', ')})`);
    check(
      (await page.getByRole('link', { name: 'Tổng kết', exact: true }).count()) === 1,
      'phone cash: ended without debrief shows Tổng kết',
    );
    await shot('phone-1-cash', false, OUT_2A);
    await shot('phone-1-cash-full', true, OUT_2A);

    await page.getByRole('button', { name: 'Showdown', exact: true }).click();
    await page.getByRole('button', { name: /^Vị trí/ }).click();
    await page.getByRole('group', { name: 'Vị trí' }).getByRole('button').nth(1).click();
    await page.waitForTimeout(150);
    check(
      page.url().includes('sd=1') && page.url().includes('pos='),
      'phone cash: filter in the address',
    );
    await shot('phone-2-filtered', false, OUT_2A);
    await page.reload();
    check(
      (await page
        .getByRole('button', { name: 'Showdown', exact: true })
        .getAttribute('aria-pressed')) === 'true',
      'phone cash: filter survives reload',
    );
    await page.getByRole('button', { name: 'Xóa lọc' }).click();
    await page.getByRole('button', { name: /^Sắp xếp/ }).click();
    await page
      .getByRole('group', { name: 'Sắp xếp' })
      .getByRole('button', { name: 'Thua nhiều' })
      .click();
    await page.waitForTimeout(150);
    const firstNum = await page.locator('ul li a').first().getAttribute('aria-label');
    check(firstNum === 'Hand 1', `phone cash: biggest loss first (${firstNum})`);
    await page.getByRole('button', { name: 'Thêm' }).click();
    await page.waitForTimeout(150);
    await shot('phone-3-menu', false, OUT_2A);
    await page.keyboard.press('Escape');

    // Tap a hand: the replayer page; Back returns with the filter.
    await page.getByRole('button', { name: 'Cần xem lại', exact: true }).click();
    await page.locator('ul li a').first().click();
    await page.waitForURL(/\/hands\//);
    check(page.url().includes('review=1'), 'phone: hand page keeps the filter in its address');
    await page.getByRole('link', { name: 'Về phiên' }).click();
    await page.waitForURL(/\/sessions\//);
    check(page.url().includes('review=1'), 'phone: back to the session keeps the filter');

    // ----- replayer: the golden hand, step by step against poker-core's frames -----
    await page.goto(`${BASE}/hands/${ids.golden}`);
    await page.locator('[data-result-bb]').waitFor();
    await noSideScroll('phone replayer');
    check(
      (await page.locator('[data-result-bb]').getAttribute('data-result-bb')) === '-360',
      'replayer: result -360 bb',
    );
    const frames = GOLDEN.frames;
    const same = (got, want) =>
      got.pot === want.pot && got.hero === want.hero && got.villain === want.villain;
    let k = frames.length - 1;
    check(same(await readFrame(page), frames[k]), `replayer: last frame matches poker-core (${k})`);
    await shot('phone-r1-replayer-cash');
    await shot('phone-r1-replayer-cash-full', true);
    let allMatch = true;
    for (k = frames.length - 2; k >= 0; k--) {
      await page.getByRole('button', { name: 'Action trước' }).click();
      const got = await readFrame(page);
      if (!same(got, frames[k])) {
        allMatch = false;
        console.log(`  step ${k}: got ${JSON.stringify(got)} want ${JSON.stringify(frames[k])}`);
      }
    }
    check(allMatch, 'replayer: ‹ walks back to the start, pot and stacks match every frame');
    check(
      await page.getByRole('button', { name: 'Action trước' }).isDisabled(),
      'replayer: ‹ is off at the start',
    );
    await shot('phone-r2-replayer-start');
    allMatch = true;
    for (k = 1; k < frames.length; k++) {
      await page.getByRole('button', { name: 'Action sau' }).click();
      if (!same(await readFrame(page), frames[k])) allMatch = false;
    }
    check(allMatch, 'replayer: › walks forward to the end, every frame matches');
    await page.keyboard.press('ArrowLeft');
    check(same(await readFrame(page), frames[frames.length - 2]), 'replayer: ← key steps back');
    await page.keyboard.press('ArrowRight');

    // AI review on the golden hand.
    check(
      (await page.getByRole('heading', { name: /Ý kiến thứ hai/ }).count()) === 1,
      'review: "Ý kiến thứ hai" heading',
    );
    check(
      (await page.getByText('Thử nghiệm', { exact: true }).count()) >= 1,
      'review: "Thử nghiệm" label',
    );
    check((await page.getByText('Prompt v1').count()) === 1, 'review: prompt version label');
    check(
      (await page.getByRole('button', { name: 'Phản biện' }).count()) >= 1,
      'review: rebuttal button',
    );
    await page.getByRole('heading', { name: /Ý kiến thứ hai/ }).scrollIntoViewIfNeeded();
    await shot('phone-r4-ai-review');
    await shot('phone-r4-ai-review-full', true);

    // Side pot.
    await page.goto(`${BASE}/hands/${ids.sidePot}`);
    await page.locator('[data-pots]').waitFor();
    check(
      (await page.locator('[data-pots]').getAttribute('data-pots')) === '2',
      'side pot: two pots shown',
    );
    check((await page.getByText('Pot phụ 1').count()) === 1, 'side pot: "Pot phụ 1"');
    check(
      (await page.getByRole('button', { name: 'AI review' }).count()) === 1,
      'side pot: no review yet, the AI button is there',
    );
    await noSideScroll('phone side pot');
    await shot('phone-r3-side-pot');
    await shot('phone-r3-side-pot-full', true);

    // MTT.
    await page.goto(`${BASE}/hands/${ids.mttHand}`);
    await page.locator('[data-result-bb]').waitFor();
    check(
      (await page.locator('[data-result-bb]').getAttribute('data-result-bb')) === '-5',
      'mtt replayer: result in bb of the level (-5)',
    );
    await noSideScroll('phone mtt replayer');
    await shot('phone-r5-replayer-mtt');
    await shot('phone-r5-replayer-mtt-full', true);

    await page.goto(`${BASE}/sessions/${ids.mtt}`);
    await page.getByRole('heading', { name: 'Sunday Million' }).waitFor();
    await noSideScroll('phone mtt');
    check(
      (await page.getByRole('button', { name: /^Giai đoạn/ }).count()) === 1,
      'phone mtt: stage filter',
    );
    await shot('phone-4-mtt', false, OUT_2A);
    await shot('phone-4-mtt-full', true, OUT_2A);
    await shot('phone-4-mtt-full', true);

    // The hand edit screen and the session edit screen.
    await page.goto(`${BASE}/hands/${ids.golden}/edit`);
    await page.getByRole('heading', { name: /Sửa hand/ }).waitFor();
    check(true, 'hand edit screen opens');
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
    await shot('phone-5-delete-dialog', false, OUT_2A);
    await page.getByRole('button', { name: 'Hủy' }).click();
    check(
      (await admin.from('sessions').select('id').eq('id', ids.stale)).data.length === 1,
      'delete: cancel keeps it',
    );
    await page.getByRole('button', { name: 'Thêm' }).click();
    await page.getByRole('menuitem', { name: 'Xóa phiên' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Xóa phiên' }).click();
    await page.waitForURL(`${BASE}/`);
    check(
      (await admin.from('sessions').select('id').eq('id', ids.stale)).data.length === 0,
      'delete: confirmed',
    );
    await page.context().close();
  }

  // ---------------- desktop ----------------
  {
    const page = await open(1440, 900);
    const shot = (name, dir = OUT) => page.screenshot({ path: `${dir}/${name}.png` });
    const fits = async (what) => {
      const r = await page.evaluate(() => {
        const wrap = document.querySelector('table')?.parentElement;
        return {
          page: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          table: wrap ? wrap.scrollWidth <= wrap.clientWidth : true,
        };
      });
      check(r.page && r.table, `${what}: no horizontal scroll (page ${r.page}, table ${r.table})`);
    };
    const listColumn = () => page.locator('ul[class*="overflow-y-auto"]').first();

    await page.goto(`${BASE}/sessions/${ids.cash}`);
    await page.getByRole('table', { name: 'Danh sách hand' }).waitFor();
    check(
      (await page.locator('[data-result-bb]').count()) === 0,
      'desktop: no hand chosen, no replayer',
    );
    check(
      await page.getByRole('columnheader', { name: 'River' }).isVisible(),
      'desktop: all street columns',
    );
    check(
      await page.getByRole('columnheader', { name: 'Nhãn' }).isVisible(),
      'desktop: the labels column fits on screen',
    );
    await fits('desktop table');
    await shot('desktop-1-no-selection');
    await shot('desktop-1-cash', OUT_2A);

    // Choose a hand: narrow list + replayer.
    await page.locator('table tbody tr').first().click();
    await page.locator('[data-result-bb]').waitFor();
    const listWidth = await listColumn().evaluate((el) =>
      Math.round(el.getBoundingClientRect().width),
    );
    check(Math.abs(listWidth - 420) <= 2, `desktop: list column is 420px (${listWidth})`);
    check(
      (await page.getByRole('table').count()) === 0,
      'desktop: table gone while a hand is open',
    );
    check(
      await page.getByRole('heading', { name: /Ý kiến thứ hai/ }).isVisible(),
      'desktop: second opinion under the replayer',
    );
    await fits('desktop split');
    check(page.url().includes('hand='), 'desktop: open hand is in the address');
    await shot('desktop-2-selected');
    await shot('desktop-2-selected-cash', OUT_2A);

    const current = () =>
      listColumn().locator('a[aria-current="true"]').first().getAttribute('aria-label');
    const first = await current();
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(150);
    const second = await current();
    check(first !== second, `desktop: ↓ moves to the next hand (${first} → ${second})`);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(150);
    check((await current()) === first, 'desktop: ↑ moves back');

    const handId = await page.evaluate(() => new URL(location.href).searchParams.get('hand'));
    const before = await admin.from('hands').select('flagged').eq('id', handId).single();
    await page.keyboard.press('r');
    await page.waitForTimeout(900);
    const after = await admin.from('hands').select('flagged').eq('id', handId).single();
    check(before.data.flagged !== after.data.flagged, 'desktop: R flips the review flag');
    await page.keyboard.press('r');
    await page.waitForTimeout(600);

    // Step with the keys while the replayer is open.
    const stepText = () => page.locator('[aria-live="polite"]').first().textContent();
    const was = await stepText();
    await page.keyboard.press('ArrowLeft');
    check((await stepText()) !== was, 'desktop: ← steps through the hand');

    // Esc closes the replayer and the full table comes back.
    await page.keyboard.press('Escape');
    await page.getByRole('table', { name: 'Danh sách hand' }).waitFor();
    check(!page.url().includes('hand='), 'desktop: Esc closes the replayer, address cleaned');
    await fits('desktop table after Esc');

    // Closing with the button.
    await page.locator('table tbody tr').nth(1).click();
    await page.getByRole('button', { name: 'Đóng' }).click();
    await page.getByRole('table', { name: 'Danh sách hand' }).waitFor();
    check(true, 'desktop: ✕ closes the replayer');

    // Reload on an open hand.
    await page.goto(`${BASE}/sessions/${ids.cash}?hand=${ids.golden}`);
    await page.locator('[data-result-bb]').waitFor();
    check(
      (await page.locator('[data-result-bb]').getAttribute('data-result-bb')) === '-360',
      'desktop: ?hand= opens that hand',
    );
    await shot('desktop-3-replayer-cash');
    await page.getByRole('heading', { name: /Ý kiến thứ hai/ }).scrollIntoViewIfNeeded();
    await shot('desktop-6-ai-review');

    await page.goto(`${BASE}/sessions/${ids.cash}?hand=${ids.sidePot}`);
    await page.locator('[data-pots]').waitFor();
    check(
      (await page.locator('[data-pots]').getAttribute('data-pots')) === '2',
      'desktop: side pot hand shows two pots',
    );
    await shot('desktop-4-side-pot');

    await page.goto(`${BASE}/sessions/${ids.mtt}?hand=${ids.mttHand}`);
    await page.locator('[data-result-bb]').waitFor();
    await shot('desktop-5-replayer-mtt');
    await page.goto(`${BASE}/sessions/${ids.mtt}`);
    await page.getByRole('table', { name: 'Danh sách hand' }).waitFor();
    await fits('desktop mtt table');
    await shot('desktop-4-mtt', OUT_2A);
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

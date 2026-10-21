/**
 * Screenshots and checks for task 5.1d-3 at 375 x 667, by Playwright.
 *
 *   pnpm --filter web build && HOLDNOTE_SCREENS=1 pnpm --filter web start -p 3100   (other terminal)
 *   node scripts/screens-5.1d-3.mjs
 *
 * Creates a throwaway user (Supabase secret key) with chip sessions and old hands, signs in with the
 * session cookie and deletes the user at the end. Pictures land in screens/5.1d-3/ (ignored by git).
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
const OUT = process.env.SCREENS_DIR ?? 'screens/5.1d-3';
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

const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();
const a = (street, actor, pos, act, amount) => ({
  street,
  actor,
  pos,
  act,
  ...(amount !== undefined && { amount }),
});

async function seed(userId) {
  const base = {
    user_id: userId,
    kind: 'cash',
    mode: 'live',
    currency: 'CHIP',
    chip_value: 1000,
    chip_currency: 'VND',
    venue: 'Chill',
    stake_label: '20/50/100',
    sb: 20,
    bb: 50,
    straddle: 100,
    seats: 9,
    buyin: 5000,
  };
  const { data: sessions, error } = await admin
    .from('sessions')
    .insert([
      {
        ...base,
        date: '2026-10-14',
        start_at: '2026-10-14T12:00:00Z',
        end_at: '2026-10-14T15:30:00Z',
        cashout: 10000,
      },
      { ...base, date: '2026-10-21', start_at: ago(50) },
    ])
    .select('id, date');
  if (error) throw error;
  const ended = sessions.find((s) => s.date === '2026-10-14').id;
  const open = sessions.find((s) => s.date === '2026-10-21').id;

  const hand = (session, num, over) => ({
    user_id: userId,
    session_id: session,
    num,
    hero_cards: ['9s', '9h'],
    flagged: false,
    ...over,
  });
  const { data: hands, error: handError } = await admin
    .from('hands')
    .insert([
      // Saved before forced bets were actions; the machine accepts it.
      hand(ended, 1, {
        board: ['Jd', '7s', '5h', 'As'],
        hero_pos: 'UTG+1',
        villain_pos: 'MP',
        outcome: 'win',
        result: 3270,
        hero_stack: 7150,
        actions: [
          a('preflop', 'hero', 'UTG+1', 'raise', 800),
          a('preflop', 'villain', 'MP', 'call', 800),
          a('preflop', 'other', 'LJ', 'call', 800),
          a('flop', 'hero', 'UTG+1', 'bet', 1500),
          a('flop', 'villain', 'MP', 'call', 1500),
          a('flop', 'other', 'LJ', 'fold'),
          a('turn', 'hero', 'UTG+1', 'bet', 2200),
          a('turn', 'villain', 'MP', 'fold'),
        ],
      }),
      // "H r500 V ai" with no stacks: cannot be moved to Theo action nor priced.
      hand(ended, 2, {
        hero_cards: ['As', 'Ks'],
        board: ['Ah', 'Kh', 'Qh', 'Jd', '9c'],
        hero_pos: 'UTG+1',
        villain_pos: 'MP',
        outcome: 'win',
        raw_line: 'H r500 V ai / AhKhQh / Jd / 9c',
        actions: [
          a('preflop', 'hero', 'UTG+1', 'raise', 500),
          a('preflop', 'villain', 'MP', 'all-in'),
        ],
      }),
      // Old heads-up hand with stacks: one pot, paid by the saved outcome.
      hand(ended, 3, {
        hero_cards: ['Kd', 'Kh'],
        board: ['Kc', 'Qc', 'Qs', 'Ts', '9s'],
        hero_pos: 'MP',
        villain_pos: 'BTN',
        outcome: 'win',
        hero_stack: 8000,
        villain_stack: 5000,
        actions: [
          a('preflop', 'hero', 'MP', 'all-in', 8000),
          a('preflop', 'villain', 'BTN', 'call', 5000),
        ],
      }),
      hand(open, 1, { hero_pos: 'BTN', villain_pos: 'BB', outcome: 'fold', actions: [] }),
    ])
    .select('id, num, session_id');
  if (handError) throw handError;
  const first = hands.find((h) => h.session_id === ended && h.num === 1).id;
  const flat = hands.find((h) => h.session_id === ended && h.num === 2).id;
  const pot = hands.find((h) => h.session_id === ended && h.num === 3).id;

  const { error: reviewError } = await admin.from('reviews').insert({
    user_id: userId,
    hand_id: first,
    source: 'ai',
    prompt_version: 'v1',
    range_text: 'Đối thủ call 800 với đôi nhỏ, Ax suited và broadway.',
    math_text: 'Pot 2.700, đặt 1.500 là 55% pot.',
    line_text: 'Bet flop 1/2 pot, bet turn lớn hơn để lấy value.',
    error_tags: ['none'],
    ev_verdict: 'correct',
    lesson: 'Value bet đúng cỡ khi có bộ.',
    accepted: false,
    is_current: true,
  });
  if (reviewError) throw reviewError;
  // The student's own review of the same hand, with the opposite verdict: both stay current.
  const { error: ownError } = await admin.from('reviews').insert({
    user_id: userId,
    hand_id: first,
    source: 'manual',
    ev_verdict: 'mistake',
    lesson: 'Mình nghĩ bet turn quá lớn.',
    is_current: true,
  });
  if (ownError) throw ownError;
  return { ended, open, first, flat, pot };
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
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    hasTouch: true,
  });
  await context.addCookies(authCookies(user.session));
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
  const noOverflow = async (what) =>
    check(
      (await page.evaluate(() => document.documentElement.scrollWidth)) <= 375,
      `${what}: no horizontal scroll`,
    );

  // ---- home ----
  await page.goto(`${BASE}/`);
  await page.getByRole('heading', { name: 'Phiên', exact: true }).waitFor();
  await noOverflow('home');
  check((await page.getByText('Đang chơi').count()) === 0, 'home: no "Đang chơi" label');
  check(
    (await page.getByText('Chưa kết thúc').count()) >= 1,
    'home: "Chưa kết thúc" on the open row',
  );
  const tabs = page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link');
  check((await tabs.count()) === 3, 'home: three tabs');
  check(
    (await tabs.allTextContents()).join('|') === 'Trang chủ|Thống kê|Cài đặt',
    'home: tab names',
  );
  check(
    (await page.getByRole('navigation', { name: 'Điều hướng chính' }).locator('svg').count()) === 3,
    'home: each tab has an icon',
  );
  check((await page.getByRole('link', { name: '+ Hand' }).count()) === 1, 'home: one "+ Hand"');
  check(
    (await page.getByRole('button', { name: 'Thêm' }).count()) >= 2,
    'home: every row has the "⋯" menu',
  );
  check((await page.getByText('Cài app').count()) === 0, 'home: no install button');
  await shot('1-home');

  // filter bar fades at the right edge while it can still scroll
  const bar = page.getByRole('group', { name: 'Bộ lọc' }).first();
  check(
    (await bar.evaluate((el) => getComputedStyle(el).maskImage)).includes('gradient'),
    'home: filter bar fades at the right edge',
  );
  check(
    (await bar.evaluate((el) => getComputedStyle(el).scrollbarWidth)) === 'none',
    'home: filter bar has no scrollbar',
  );

  // InfoTip of the right-hand tile stays on screen
  const tips = page.getByRole('button', { name: 'Giải thích' });
  await tips.last().click();
  await page.waitForTimeout(200);
  const tipBox = await page.getByRole('tooltip').boundingBox();
  check(
    tipBox != null && tipBox.x >= 7 && tipBox.x + tipBox.width <= 368,
    `home: tip inside the screen (${JSON.stringify(tipBox)})`,
  );
  await shot('2-home-infotip');
  await page.mouse.click(190, 400);

  // row menu
  await page.getByRole('button', { name: 'Thêm' }).first().click();
  await page.waitForTimeout(150);
  check((await page.getByRole('menuitem').count()) === 2, 'home: ⋯ shows Sửa and Xóa');
  await shot('3-home-row-menu');
  await page.getByRole('menuitem', { name: 'Xóa phiên' }).click();
  await page.waitForTimeout(200);
  check(await page.getByRole('dialog').isVisible(), 'home: delete asks first');
  await shot('4-home-delete-confirm');
  await page.getByRole('button', { name: 'Hủy' }).click();

  // ---- session form (create) ----
  await page.goto(`${BASE}/sessions/new`);
  await page.getByRole('heading', { name: 'Loại và hình thức' }).waitFor();
  await noOverflow('new session');
  check(
    (await page.getByRole('button', { name: 'Chip', exact: true }).getAttribute('aria-pressed')) ===
      'true',
    'new session: Chip is the unit for a live game',
  );
  check(
    (await page.locator('input[type=time]').first().inputValue()) !== '',
    'new session: start time filled',
  );
  check((await page.locator('input[type=date]').inputValue()) !== '', 'new session: date filled');
  check(
    (await page.getByText(/^Cash · Live · Chip/).count()) === 1,
    'new session: summary line names the unit once',
  );
  await page.getByRole('textbox', { name: 'Giá trị một chip' }).fill('1000');
  await shot('5-new-session-top');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(150);
  await shot('6-new-session-bottom');
  const saveBox = await page.getByRole('button', { name: 'Tạo phiên' }).boundingBox();
  check(
    saveBox != null && saveBox.y + saveBox.height <= 667,
    'new session: save button stays on screen',
  );
  check(
    (await page.getByRole('navigation', { name: 'Điều hướng chính' }).count()) === 0,
    'new session: bottom tabs hidden behind the save bar',
  );
  await page.getByRole('textbox', { name: 'Địa điểm / site' }).fill('Screens test');
  await page.getByRole('textbox', { name: 'SB' }).fill('20');
  await page.getByRole('textbox', { name: 'BB' }).fill('50');
  await page.getByRole('button', { name: 'Tạo phiên' }).click();
  await page.waitForURL(/\/sessions\/[^/]+\/record$/);
  check(true, 'new session: create goes straight to Ghi hand');
  await noOverflow('record');
  await shot('7-record-after-create');
  const created = page.url().split('/sessions/')[1].split('/')[0];
  const { data: made } = await admin
    .from('sessions')
    .select('currency, chip_value, chip_currency, start_at, end_at')
    .eq('id', created)
    .single();
  check(
    made?.currency === 'CHIP' && made.chip_value === 1000 && made.chip_currency === 'VND',
    `new session: saved as Chip, 1 chip = 1000 VND (${JSON.stringify(made)})`,
  );
  check(made?.start_at != null && made.end_at == null, 'new session: start now, no end');
  const back = page.getByRole('button', { name: 'Về phiên' });
  check((await back.count()) === 1, 'record: has the back arrow');

  // ---- back button goes through history ----
  await page.goto(`${BASE}/`);
  await page
    .getByRole('link', { name: /14\/10/ })
    .first()
    .click();
  await page.waitForURL(/\/sessions\/[^/]+$/);
  await page.getByRole('button', { name: 'Quay lại' }).click();
  await page.waitForURL(`${BASE}/`);
  check(true, 'detail: "<" goes back to the list');

  // ---- session detail ----
  await page.goto(`${BASE}/sessions/${ids.ended}`);
  await page.getByRole('button', { name: 'Quay lại' }).waitFor();
  await noOverflow('session detail');
  await shot('8-session-detail');
  const topBar = page.locator('header[data-back-href]');
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(100);
  check((await topBar.boundingBox())?.y === 0, 'detail: top bar sticks while scrolling');

  // ---- edit session ----
  await page.goto(`${BASE}/sessions/${ids.ended}/edit`);
  await page.getByRole('heading', { name: 'Địa điểm và thời gian' }).waitFor();
  check(
    (await page.locator('input[type=time]').nth(1).inputValue()) !== '',
    'edit: end time filled from the session',
  );
  await noOverflow('edit session');
  await shot('9-edit-session');

  // ---- hand detail: with review ----
  await page.goto(`${BASE}/hands/${ids.first}`);
  await page.getByRole('heading', { name: 'AI phân tích' }).waitFor();
  await noOverflow('hand with review');
  check((await page.getByText('Thử nghiệm').count()) === 0, 'hand: no "Thử nghiệm" label');
  check(
    (await page.getByRole('button', { name: 'AI review', exact: true }).count()) === 0,
    'hand with a review: no AI review button',
  );
  check(
    (await page.getByRole('heading', { name: 'Range đối thủ' }).count()) === 1,
    'hand with a review: range shown',
  );
  check(
    (await page.getByRole('button', { name: /Bạn tự review/ }).getAttribute('aria-expanded')) ===
      'false',
    'hand with a review: own review is collapsed',
  );
  check(
    (await page.getByText('AI: Đúng · Bạn: Sai').count()) === 1,
    'hand with both reviews: one line says they differ',
  );
  await page.getByRole('button', { name: 'Giải thích' }).last().click();
  await page.waitForTimeout(200);
  check(
    (await page.getByRole('tooltip').innerText()).includes('Mang tính chất tham khảo'),
    'hand: "!" opens "Mang tính chất tham khảo"',
  );
  await page.getByRole('button', { name: 'Chạy lại AI review' }).click();
  await page.waitForTimeout(200);
  const again = await page.getByRole('dialog').innerText();
  check(
    again.includes('Trừ 1 lượt') && again.includes('Còn 30 lượt'),
    `hand: re-run asks first and shows the turns left (${again.replace(/\s+/g, ' ').slice(0, 90)})`,
  );
  await shot('10b-hand-rerun-confirm');
  await page.getByRole('button', { name: 'Hủy' }).click();
  await shot('10-hand-with-review');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot('11-hand-with-review-bottom');

  // ---- hand detail: no review ----
  await page.goto(`${BASE}/hands/${ids.flat}`);
  await page.getByRole('heading', { name: 'AI phân tích' }).waitFor();
  check(
    (await page.getByRole('button', { name: 'AI review', exact: true }).count()) === 1,
    'hand without a review: the AI review button',
  );
  check((await page.getByText(/Còn \d+ lượt/).count()) === 1, 'hand without a review: turns left');
  check(
    (await page.getByText('Bạn tự review').count()) === 1,
    'hand without a review: own-review form',
  );
  await page.getByRole('textbox', { name: 'Bài học' }).fill('Đừng shove với bài trung bình.');
  await page.getByRole('button', { name: 'Lưu review' }).click();
  await page.getByText('Đã lưu review.').waitFor();
  const { data: own } = await admin
    .from('reviews')
    .select('source, lesson')
    .eq('hand_id', ids.flat)
    .eq('is_current', true)
    .single();
  check(
    own?.source === 'manual' && own.lesson?.startsWith('Đừng'),
    'hand without a review: saved as a manual review',
  );
  check(
    (await page.getByText('Hand lưu trước bản cập nhật, chưa có dữ liệu chia pot.').count()) === 1,
    'hand: unpriced old hand says it has no pot data',
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('12-hand-no-review');

  // ---- old heads-up hand: pot from the outcome ----
  await page.goto(`${BASE}/hands/${ids.pot}`);
  await page.getByRole('heading', { name: 'AI phân tích' }).waitFor();
  check(
    (await page.getByText('Hand lưu trước bản cập nhật, chưa có dữ liệu chia pot.').count()) === 0,
    'hand: heads-up old hand gets its pot back from the outcome',
  );
  await shot('13-hand-old-headsup');

  // ---- edit hand: converted opens in Theo action, the other stays a line ----
  await page.goto(`${BASE}/hands/${ids.first}/edit`);
  await page
    .getByRole('button', { name: 'Quay lại' })
    .waitFor()
    .catch(() => {});
  await page.waitForTimeout(500);
  check(
    (await page.getByText(/Không chuyển được sang Theo action/).count()) === 0,
    'edit hand: a convertible old hand opens in Theo action',
  );
  await shot('14-edit-hand-converted');
  await page.goto(`${BASE}/hands/${ids.flat}/edit`);
  await page.waitForTimeout(500);
  check(
    (await page
      .getByText(/Không chuyển được sang Theo action \(all-in nhưng chưa biết stack\)/)
      .count()) === 1,
    'edit hand: an old hand that cannot move says why and opens as a shorthand line',
  );
  await shot('15-edit-hand-shorthand');

  // ---- settings ----
  await page.goto(`${BASE}/settings`);
  await page.getByRole('heading', { name: 'Cài app' }).waitFor();
  await noOverflow('settings');
  await shot('16-settings');

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

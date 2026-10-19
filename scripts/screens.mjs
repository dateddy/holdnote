/**
 * Screenshots of the Ghi nhanh flow at 375px, driven by Playwright against a running app.
 *
 *   pnpm --filter web build && pnpm --filter web start -p 3100   (other terminal)
 *   pnpm screens
 *
 * Creates a throwaway user with two sessions through the Supabase secret key, signs in by writing
 * the session cookie, plays the golden hand (-360bb), saves it, checks the stored row and deletes
 * the user (cascade). Pictures land in screens/5.1c-2/ (ignored by git).
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';

// supabase-js is a dependency of apps/web, not of the root.
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
const OUT = process.env.SCREENS_DIR ?? 'screens/5.1c-2';
const OPTS = { auth: { persistSession: false, autoRefreshToken: false } };
const chrome = join(homedir(), 'AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe');
mkdirSync(OUT, { recursive: true });

const admin = createClient(URL_, env.SUPABASE_SECRET_KEY, OPTS);
const email = `screens-${randomUUID().slice(0, 8)}@example.com`;
const password = randomUUID();
let userId;

async function setUp() {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Screens', locale: 'vi' },
  });
  if (error) throw error;
  userId = data.user.id;
  await admin
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString(), locale: 'vi' })
    .eq('id', userId);
  const base = {
    user_id: userId,
    mode: 'live',
    currency: 'CHIP',
    venue: 'Screens',
    start_at: new Date().toISOString(),
  };
  const cash = await admin
    .from('sessions')
    .insert({ ...base, kind: 'cash', sb: 25, bb: 50, seats: 9, buyin: 18000 })
    .select('id')
    .single();
  const mtt = await admin
    .from('sessions')
    .insert({
      ...base,
      kind: 'mtt',
      sb: 25,
      bb: 50,
      ante_mode: 'bb',
      ante: 50,
      seats: 9,
      mtt: { start_stack: 20000 },
    })
    .select('id')
    .single();
  if (cash.error || mtt.error) throw cash.error ?? mtt.error;
  await admin.from('opponents').insert({ user_id: userId, name: 'Hùng', venue: 'Screens' });

  const anon = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, OPTS);
  const { data: signed, error: signError } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (signError) throw signError;
  return { cash: cash.data.id, mtt: mtt.data.id, session: signed.session };
}

/** Same cookie @supabase/ssr writes: `base64-` + base64url(JSON), chunked at 3180 characters. */
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
  const { cash, mtt, session } = await setUp();
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });
  await context.addCookies(authCookies(session));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
  const tap = (name, opts = {}) =>
    page
      .getByRole('button', { name, exact: true, ...opts })
      .first()
      .click();
  const pickCard = async (rank, suit) => {
    await page.getByRole('button', { name: rank, exact: true }).first().click();
    await page.getByRole('button', { name: suit, exact: true }).first().click();
  };
  const keypad = async (text, confirm = true) => {
    for (const k of text)
      await page.getByRole('dialog').getByRole('button', { name: k, exact: true }).click();
    if (confirm) await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận' }).click();
  };

  // ---- cash session: the golden hand ----
  await page.goto(`${BASE}/sessions/${cash}/record`);
  await page.getByText('Thiết lập hand').waitFor();
  await shot('01-setup-empty');

  await tap('MP');
  await tap('BTN');
  await pickCard('A', 's');
  await pickCard('K', 'd');
  await page.getByLabel('Stack của mình').fill('18000');
  await page.getByLabel('Stack của đối thủ').fill('20000');
  await shot('02-setup-filled');
  await tap('Bắt đầu ghi');

  await page.getByText(/Lượt: MP/).waitFor();
  await shot('03-preflop');
  await tap('Call'); // limp
  await tap('Open'); // villain
  await keypad('500', false);
  await shot('04-keypad');
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận' }).click();
  await tap('Call');

  // flop
  await page
    .getByText(/Chọn các lá board của Flop/i)
    .first()
    .waitFor();
  await shot('05-flop-board');
  await pickCard('Q', 'h');
  await pickCard('7', 'd');
  await pickCard('2', 'c');
  await page.getByText(/Lượt: MP/).waitFor();
  await tap('Check');
  await tap('Bet');
  await keypad('500');
  await tap('Call');
  await shot('06-flop-actions');

  // turn
  await pickCard('9', 's');
  await tap('Check');
  await tap('Bet');
  await keypad('1k');
  await tap('Call');

  // river
  await pickCard('3', 'h');
  await tap('Bet');
  await keypad('5000');
  await tap('All-in');
  await tap('Call');

  await page.getByText('Ai thắng?').waitFor();
  await tap('Đối thủ thắng');
  await page.getByText('-360bb').first().waitFor();
  await page.getByText('Ai thắng?').scrollIntoViewIfNeeded();
  await shot('07-showdown');

  // edit an old chip
  await page
    .getByRole('button', { name: /^Đối thủ Bet 10bb/ })
    .first()
    .click();
  await shot('08-edit-action');
  await page.keyboard.press('Escape');

  // shorthand mode keeps the same hand
  await tap('Ghi tắt H/V');
  await shot('09-shorthand');
  await tap('Theo action');

  await page.getByRole('button', { name: /^Lưu hand/ }).click();
  await page.getByText(/Đã lưu hand #1/).waitFor();
  await shot('10-saved');

  // ---- hand 2: straddle on, hero folds, a third player is added ----
  await page.getByLabel('Straddle', { exact: true }).click();
  await page.getByText('Mức straddle 1').waitFor();
  await page.getByText('Straddle', { exact: true }).scrollIntoViewIfNeeded();
  await shot('11-straddle-setup');
  await pickCard('Q', 's');
  await pickCard('J', 's');
  await page.getByLabel('Stack của mình').fill('5000');
  await page.getByLabel('Stack của đối thủ').fill('5000');
  await tap('Bắt đầu ghi');
  await page.getByText(/Lượt: /).waitFor();
  await shot('12-straddle-turn');
  await tap('Call');
  // the villain (SB) acts; then undo and re-enter with a fold
  // the toast of hand 1 has the same label; the action panel comes later in the page
  await page.getByRole('button', { name: 'Hoàn tác', exact: true }).last().click();
  await tap('Fold');
  await page
    .getByText(/thắng vì mọi người khác đã fold|Kết quả/)
    .first()
    .waitFor();
  await shot('13-hero-folded');

  // ---- the saved hand opens as a read view, edit form saves ----
  // Opening the screen again lets the offline queue send hand 1.
  await page.goto(`${BASE}/sessions/${cash}/record`);
  let saved = null;
  for (let i = 0; i < 30 && !saved; i++) {
    const { data } = await admin.from('hands').select('id').eq('session_id', cash).eq('num', 1);
    saved = data?.[0] ?? null;
    if (!saved) await new Promise((r) => setTimeout(r, 500));
  }
  if (!saved) throw new Error('hand 1 never reached the database');
  await page.goto(`${BASE}/hands/${saved.id}`);
  await page.getByText('Sửa hand').waitFor();
  await shot('14-hand-detail');
  await page.getByText('Sửa hand').click();
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await page.getByText('Đã lưu thay đổi.').waitFor();
  await shot('15-hand-edit-saved');

  // ---- onboarding practice uses the same form ----
  await page.goto(`${BASE}/onboarding/practice`);
  await page.getByText('Thiết lập hand').waitFor();
  await shot('16-practice');

  // ---- MTT session setup ----
  await page.goto(`${BASE}/sessions/${mtt}/record`);
  await page.getByText('Level của giải').waitFor();
  await page.getByText('Level của giải').scrollIntoViewIfNeeded();
  await shot('17-mtt-setup');

  await browser.close();

  // the stored row
  await new Promise((r) => setTimeout(r, 2500));
  const { data: hands } = await admin
    .from('hands')
    .select('result, actions, hero_pos, villain_pos')
    .eq('session_id', cash);
  const row = hands?.[0];
  console.log('stored result:', row?.result, 'first actions:', row?.actions?.slice(0, 2));
  if (row?.result !== -18000) throw new Error(`expected -18000, got ${row?.result}`);
  if (errors.length) console.log('browser errors:', errors.slice(0, 5));
}

try {
  await main();
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId);
}

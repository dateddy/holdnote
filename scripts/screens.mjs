/**
 * Screenshots of the Ghi nhanh flow at 375px, driven by Playwright against a running app.
 *
 *   pnpm --filter web build && pnpm --filter web start -p 3100   (other terminal)
 *   pnpm screens
 *
 * Creates a throwaway user with two sessions through the Supabase secret key, signs in by writing
 * the session cookie, plays the golden hand (-360bb), saves it, checks the stored row and deletes
 * the user (cascade). Start the app with HOLDNOTE_SCREENS=1 so no dev badge is in the pictures. Pictures land in screens/5.1c-2/ (ignored by git).
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
const OUT = process.env.SCREENS_DIR ?? 'screens/5.1c-4';
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
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });
  await context.addCookies(authCookies(session));
  const page = await context.newPage();
  const errors = [];
  const misfits = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
  const tap = (name) => page.getByRole('button', { name, exact: true }).first().click();
  const dialog = () => page.getByRole('dialog');
  const pickIn = async (scope, rank, suit) => {
    await scope.getByRole('button', { name: rank, exact: true }).first().click();
    await scope.getByRole('button', { name: suit, exact: true }).first().click();
  };
  const keypad = async (text, confirm = true) => {
    for (const k of text) await dialog().getByRole('button', { name: k, exact: true }).click();
    if (confirm) await dialog().getByRole('button', { name: 'Xác nhận' }).click();
  };
  /** Pick the cards of one board group through the sheet; it closes by itself after the last. */
  const board = async (first, cards) => {
    await page.getByRole('button', { name: first, exact: true }).click();
    for (const [rank, suit] of cards) await pickIn(dialog(), rank, suit);
    await dialog().waitFor({ state: 'detached' });
  };
  /** The Board card and the Action card must sit above the save bar without scrolling. */
  const fits = async (name) => {
    const card = page.getByRole('tablist').locator('xpath=ancestor::section[1]');
    const bar = page
      .getByRole('button', { name: /^(Lưu hand|Kiểm tra)/ })
      .locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
    const [c, b, top] = await Promise.all([
      card.boundingBox(),
      bar.boundingBox(),
      page.getByRole('button', { name: 'Flop 1', exact: true }).boundingBox(),
    ]);
    const ok = c && b && top && top.y >= 0 && c.y + c.height <= b.y + 1;
    const bottom = Math.round((c?.y ?? 0) + (c?.height ?? 0));
    console.log(
      `${ok ? 'fits  ' : 'NO FIT'} ${name}: action card bottom ${bottom}, save bar top ${Math.round(b?.y ?? 0)}`,
    );
    if (!ok) misfits.push(name);
  };
  const setupHand = async ({ hero, villain, cards, heroStack, villStack, record }) => {
    await page.goto(record);
    await page.getByText('Thiết lập hand').waitFor();
    await page.getByRole('button', { name: /^Mình/ }).first().click();
    await tap(hero);
    await page
      .getByRole('button', { name: /^Đối thủ/ })
      .first()
      .click();
    await tap(villain);
    await pickIn(page, cards[0][0], cards[0][1]);
    await pickIn(page, cards[1][0], cards[1][1]);
    await page.getByLabel('Stack của mình').fill(heroStack);
    await page.getByLabel('Stack của đối thủ').fill(villStack);
    await tap('Bắt đầu ghi');
    await page.getByText(/Lượt: /).waitFor();
  };
  const gold = {
    hero: 'MP',
    villain: 'BTN',
    cards: [
      ['A', 's'],
      ['K', 'd'],
    ],
    heroStack: '18000',
    villStack: '20000',
    record: `${BASE}/sessions/${cash}/record`,
  };
  const small = { ...gold, heroStack: '5000', villStack: '5000' };

  // ---- setup screen ----
  await page.goto(gold.record);
  await page.getByText('Thiết lập hand').waitFor();
  await shot('01-setup');

  // ---- hand 1, the golden hand: -360bb ----
  await setupHand(gold);
  await tap('Call'); // limp
  await fits('preflop, villain to act');
  await shot('02-preflop-entering');
  await tap('Open'); // villain
  await keypad('500', false);
  await shot('03-keypad');
  await dialog().getByRole('button', { name: 'Xác nhận' }).click();
  await tap('Call');

  await page.getByText(/Lượt: MP/).waitFor();
  await tap('Check');
  await fits('flop, board still empty');
  await shot('04-flop-entering');
  await board('Flop 1', [
    ['Q', 'h'],
    ['7', 'd'],
    ['2', 'c'],
  ]);
  await tap('Bet'); // villain
  await keypad('500');
  await tap('Call');

  await tap('Check'); // turn
  await tap('Bet');
  await keypad('1k');
  await tap('Call');
  // the sheet carries on to the next open slot: turn, then river
  await board('Turn 1', [
    ['9', 's'],
    ['3', 'h'],
  ]);
  await tap('Bet'); // river, hero first
  await keypad('5000');
  await tap('All-in');
  await tap('Call');

  await page.getByText('Ai thắng?').waitFor();
  await tap('Đối thủ thắng');
  await page.getByText('-360bb').first().waitFor();
  await shot('05-showdown');

  await page.getByRole('button', { name: 'Mở rộng: xem mọi action' }).click();
  await shot('06-expanded');
  await page.getByRole('button', { name: 'Thu về từng street' }).click();

  await page.getByRole('button', { name: /^Lưu hand/ }).click();
  await page.getByText(/Đã lưu hand #1/).waitFor();

  // ---- hand ended by a fold ----
  await setupHand(small);
  await tap('Fold');
  await page.getByText('Đối thủ thắng (mình fold)').waitFor();
  await shot('07-hero-folded');

  // ---- an edit makes later streets invalid ----
  await setupHand(small);
  await tap('Call');
  await tap('Open');
  await keypad('150');
  await tap('Call');
  await board('Flop 1', [
    ['Q', 'h'],
    ['7', 'd'],
    ['2', 'c'],
  ]);
  await tap('Check');
  await tap('Bet');
  await keypad('100');
  await tap('Call');
  await page.getByRole('tab', { name: 'Preflop' }).click();
  await page
    .getByRole('button', { name: /^Mình Call/ })
    .first()
    .click();
  await dialog().getByRole('button', { name: 'Fold', exact: true }).click();
  await dialog().getByRole('button', { name: 'Xác nhận' }).click();
  await shot('08-edit-makes-street-invalid');

  // ---- all-in called before the flop: the whole board opens ----
  await setupHand(small);
  await tap('All-in');
  await tap('Call');
  await page.getByText(/chọn nốt các lá board/).waitFor();
  await shot('09-allin-runout');

  // ---- the saved hand opens as a read view, edit form saves ----
  await page.goto(gold.record); // lets the offline queue send hand 1
  let saved = null;
  for (let i = 0; i < 30 && !saved; i++) {
    const { data } = await admin.from('hands').select('id').eq('session_id', cash).eq('num', 1);
    saved = data?.[0] ?? null;
    if (!saved) await new Promise((r) => setTimeout(r, 500));
  }
  if (!saved) throw new Error('hand 1 never reached the database');
  await page.goto(`${BASE}/hands/${saved.id}`);
  await page.getByText('Sửa hand').waitFor();
  await shot('10-hand-detail');
  await page.getByText('Sửa hand').click();
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await page.getByText('Đã lưu thay đổi.').waitFor();

  // ---- onboarding practice uses the same form ----
  await page.goto(`${BASE}/onboarding/practice`);
  await page.getByText('Thiết lập hand').waitFor();

  // ---- MTT session setup ----
  await page.goto(`${BASE}/sessions/${mtt}/record`);
  await page.getByText('Level của giải').waitFor();
  await page.getByText('Level của giải').scrollIntoViewIfNeeded();
  await shot('11-mtt-setup');

  await browser.close();

  const { data: hands } = await admin
    .from('hands')
    .select('result, actions')
    .eq('session_id', cash);
  const row = hands?.[0];
  console.log('stored result:', row?.result, '| first action:', row?.actions?.[0]?.act);
  if (row?.result !== -18000) throw new Error(`expected -18000, got ${row?.result}`);
  if (errors.length) console.log('browser errors:', errors.slice(0, 5));
  if (misfits.length) throw new Error(`does not fit 375x667: ${misfits.join(', ')}`);
}

try {
  await main();
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId);
}

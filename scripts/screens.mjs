/**
 * Screenshots of the Ghi nhanh flow at 375px (667 high; the panels are also checked at 550), driven by Playwright against a running app.
 *
 *   pnpm --filter web build && pnpm --filter web start -p 3100   (other terminal)
 *   pnpm screens
 *
 * Creates a throwaway user with two sessions through the Supabase secret key, signs in by writing
 * the session cookie, plays the golden hand (-360bb), saves it, checks the stored row and deletes
 * the user (cascade). Start the app with HOLDNOTE_SCREENS=1 so no dev badge is in the pictures. Pictures land in screens/5.1c-6b/ (ignored by git).
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
const OUT = process.env.SCREENS_DIR ?? 'screens/5.1c-6b';
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
  const errors = [];
  const misfits = [];

  /** A page at 375 x height with the signed-in cookie. */
  const open = async (height) => {
    const context = await browser.newContext({
      viewport: { width: 375, height },
      deviceScaleFactor: 2,
      colorScheme: 'dark',
    });
    await context.addCookies(authCookies(session));
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    return page;
  };

  const page = await open(667);
  const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
  const tap = (name) => page.getByRole('button', { name, exact: true }).first().click();
  const pad = () => page.getByRole('group', { name: 'Lên tới' });
  const picker = () => page.getByRole('group', { name: 'Bài và board' });
  const tableGroup = () => page.getByRole('group', { name: 'Chạm một ghế để đặt vị trí.' });
  const pickIn = async (scope, rank, suit) => {
    await scope.getByRole('button', { name: rank, exact: true }).first().click();
    await scope.getByRole('button', { name: suit, exact: true }).first().click();
  };
  const keypad = async (text, confirm = true) => {
    for (const k of text) await pad().getByRole('button', { name: k, exact: true }).click();
    if (confirm) await pad().getByRole('button', { name: 'Xác nhận' }).click();
  };
  /** Pick the cards of one slot group through the inline picker; it closes when no slot is left. */
  const board = async (first, cards) => {
    await page.getByRole('button', { name: first, exact: true }).click();
    for (const [rank, suit] of cards) await pickIn(picker(), rank, suit);
    await picker().waitFor({ state: 'detached' });
  };
  const bar = (p) =>
    p
      .getByRole('button', { name: /^(Lưu hand|Kiểm tra)/ })
      .locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
  /** The part in use must sit between the top of the screen and the save bar, without scrolling. */
  const fits = async (p, name, locator) => {
    await p.waitForTimeout(400);
    const [b, saveBar] = await Promise.all([locator.first().boundingBox(), bar(p).boundingBox()]);
    const ok = b && saveBar && b.y >= 0 && b.y + b.height <= saveBar.y + 1;
    console.log(
      `${ok ? 'fits  ' : 'NO FIT'} ${name}: bottom ${Math.round((b?.y ?? 0) + (b?.height ?? 0))}, save bar top ${Math.round(saveBar?.y ?? 0)}`,
    );
    if (!ok) misfits.push(name);
  };

  const panelBar = (p) => p.getByRole('button', { name: /^Hand #/ }).first();
  const openPanel = async (p) => {
    if ((await panelBar(p).getAttribute('aria-expanded')) !== 'true') await panelBar(p).click();
  };
  const closePanel = async (p) => {
    if ((await panelBar(p).getAttribute('aria-expanded')) === 'true') await panelBar(p).click();
    await p.waitForTimeout(300);
  };
  const seatBtn = (p, pos) =>
    p.getByRole('button', { name: new RegExp(`^${pos.replace('+', '\\+')}(,|$)`) }).first();

  /** Head count, hero seat and opponents on the mini table (the panel is open on a new hand). */
  const seatUp = async (p, { players, hero, villains, stacks = {}, heroStack }) => {
    await openPanel(p);
    const count = async () =>
      Number(
        (
          await p
            .getByRole('region', { name: 'Bàn' })
            .getByText(/^\d+ người$/)
            .textContent()
        ).split(' ')[0],
      );
    while (players && (await count()) > players) await p.getByLabel('Bớt một người').click();
    while (players && (await count()) < players) await p.getByLabel('Thêm một người').click();
    const group = p.getByRole('group', { name: 'Chạm một ghế để đặt vị trí.' });
    await group.getByRole('button', { name: /^Mình/ }).click();
    if (hero) await seatBtn(p, hero).click();
    await group.getByRole('button', { name: /^Đối thủ/ }).click();
    for (const v of villains) {
      const btn = p.getByRole('button', { name: v, exact: true });
      if (await btn.count()) await btn.click();
    }
    for (const [pos, stack] of Object.entries(stacks)) {
      await p.getByLabel(`Stack của đối thủ ${pos}`).fill(stack);
    }
    if (heroStack) await p.getByLabel('Stack của mình').fill(heroStack);
  };

  const setupHand = async ({ hero, villain, cards, heroStack, villStack, record }) => {
    await page.goto(record);
    await page.getByRole('button', { name: 'Mình 1', exact: true }).waitFor();
    await seatUp(page, {
      players: 9,
      hero,
      villains: [villain],
      stacks: { [villain]: villStack },
      heroStack,
    });
    await closePanel(page);
    await page.getByRole('button', { name: 'Mình 1', exact: true }).click();
    await pickIn(picker(), cards[0][0], cards[0][1]);
    await pickIn(picker(), cards[1][0], cards[1][1]);
    await picker().waitFor({ state: 'detached' });
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

  // ---- a new hand: the table panel is open on the hero bar ----
  await page.goto(gold.record);
  await page.getByRole('button', { name: 'Mình 1', exact: true }).waitFor();
  await page.waitForTimeout(400);
  await shot('01-new-hand-table-open');

  // ---- hand 1, the golden hand: -360bb ----
  await setupHand(gold);
  await shot('02-hero-cards-picked');
  await tap('Call'); // limp
  await shot('03-preflop-entering');
  await tap('Open'); // villain
  await fits(page, 'number pad (667)', pad());
  await keypad('500', false);
  await shot('04-numpad-open');
  await pad().getByRole('button', { name: 'Xác nhận' }).click();
  await tap('Call');

  await page.getByText(/Lượt: MP/).waitFor();
  await tap('Check');
  await page.getByRole('button', { name: 'Flop 1', exact: true }).click();
  await page.waitForTimeout(450);
  await shot('05-picking-flop');
  await fits(page, 'flop picker (667)', picker());
  for (const [rank, suit] of [
    ['Q', 'h'],
    ['7', 'd'],
    ['2', 'c'],
  ]) {
    await pickIn(picker(), rank, suit);
  }
  await picker().waitFor({ state: 'detached' });
  await tap('Bet'); // villain
  await keypad('500');
  await tap('Call');

  await tap('Check'); // turn
  await tap('Bet');
  await keypad('1k');
  await tap('Call');
  // the picker carries on to the next open slot: turn, then river
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
  await shot('06-showdown');

  await page.getByRole('button', { name: 'Mở rộng: xem mọi action' }).click();
  await shot('07-expanded');
  await page.getByRole('button', { name: 'Thu về từng street' }).click();

  await page.getByRole('button', { name: /^Lưu hand/ }).click();
  await page.getByText(/Đã lưu hand #1/).waitFor();
  await page.waitForTimeout(400);
  await shot('08-next-hand-table-open');

  // ---- two opponents ----
  await seatUp(page, {
    players: 9,
    hero: 'MP',
    villains: ['CO', 'BTN'],
    stacks: { CO: '3000', BTN: '4000' },
    heroStack: '5000',
  });
  await shot('09-two-opponents');
  await closePanel(page);

  // ---- deselecting an opponent who already acted: his action and all after turn red ----
  await page.getByRole('button', { name: 'Mình 1', exact: true }).click();
  await pickIn(picker(), 'A', 's');
  await pickIn(picker(), 'K', 'd');
  await picker().waitFor({ state: 'detached' });
  await tap('Open'); // hero MP
  await keypad('150');
  await tap('Call'); // CO
  await tap('Fold'); // BTN
  await openPanel(page);
  await page.getByRole('button', { name: 'CO, Đối thủ' }).click();
  await closePanel(page);
  await page
    .getByText(/không còn được chọn/)
    .first()
    .scrollIntoViewIfNeeded();
  await shot('10-deselected-opponent-red');
  await page
    .getByText(/không còn được chọn/)
    .first()
    .waitFor();

  // ---- table of 6, heads-up, and 9 -> 8 while hero sits MP ----
  await page.goto(gold.record);
  await page.getByRole('button', { name: 'Mình 1', exact: true }).waitFor();
  await seatUp(page, { players: 6, hero: 'HJ', villains: ['BTN'] });
  await page.waitForTimeout(400);
  await shot('11-six-handed');

  await page.goto(gold.record);
  await page.getByRole('button', { name: 'Mình 1', exact: true }).waitFor();
  await seatUp(page, { players: 2, hero: 'BTN', villains: ['BB'] });
  await page.waitForTimeout(400);
  await shot('12-heads-up');

  await page.goto(gold.record);
  await page.getByRole('button', { name: 'Mình 1', exact: true }).waitFor();
  await seatUp(page, { players: 9, hero: 'MP', villains: ['BTN'] });
  await page.getByLabel('Bớt một người').click();
  await page.getByText(/Bàn 8 người không có ghế MP/).waitFor();
  await page.waitForTimeout(400);
  await shot('13-nine-to-eight-at-mp');

  // ---- hand ended by a fold ----
  await setupHand(small);
  await tap('Fold');
  await page.getByText('Đối thủ thắng (mình fold)').waitFor();
  await shot('14-hero-folded');

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
  const editRow = page.getByRole('group', { name: 'Sửa hành động' });
  await editRow.waitFor();
  await page.waitForTimeout(300);
  await shot('15a-inline-edit-row');
  await fits(page, 'inline edit row (667)', editRow);
  await editRow.getByRole('button', { name: 'Fold', exact: true }).click();
  await editRow.getByRole('button', { name: 'Xác nhận' }).click();
  await shot('15-edit-makes-street-invalid');

  // ---- all-in called before the flop: the whole board opens ----
  await setupHand(small);
  await tap('All-in');
  await tap('Call');
  await page.getByText(/chọn nốt các lá board/).waitFor();
  await shot('16-allin-runout');

  // ---- 5.1c-6b: showdown by the cards ----
  const showdownCard = () => page.locator('section').filter({ hasText: /Ai thắng\?|Showdown/ });
  await setupHand(small);
  await tap('All-in');
  await tap('Call');
  await board('Flop 1', [
    ['Q', 'h'],
    ['7', 'd'],
    ['2', 'c'],
    ['9', 's'],
    ['3', 'h'],
  ]);
  await page.getByRole('button', { name: /^Bài Đối thủ/ }).click();
  await pickIn(showdownCard(), 'T', 'h');
  await pickIn(showdownCard(), 'T', 'd');
  await page
    .getByText('Mình: Mậu thầu · Đối thủ: Đôi')
    .waitFor({ timeout: 8000 })
    .catch(async (e) => {
      await page.screenshot({ path: `${OUT}/fail.png`, fullPage: true });
      throw e;
    });
  await page.getByText('-100bb').first().waitFor();
  await showdownCard().first().scrollIntoViewIfNeeded();
  await shot('22-showdown-auto-picked');

  // a pick against the cards: priced, warned, and Lưu is locked with the reason in the button
  await showdownCard().getByRole('button', { name: 'Mình thắng', exact: true }).click();
  await page.getByText(/Theo bài đã nhập, Đối thủ thắng \(Đôi\)/).waitFor();
  const locked = page.getByRole('button', { name: 'Kết quả không khớp bài' });
  await locked.waitFor();
  if (!(await locked.isDisabled())) throw new Error('save should be locked on a mismatch');
  await showdownCard().first().scrollIntoViewIfNeeded();
  await shot('23-showdown-mismatch-locked');
  await showdownCard().getByRole('button', { name: 'Mình thắng', exact: true }).click();
  await page.getByRole('button', { name: /^Lưu hand/ }).waitFor();

  // ---- three players, a short all-in: two pots; no cards, so a winner per pot ----
  await page.goto(gold.record);
  await page.getByRole('button', { name: 'Mình 1', exact: true }).waitFor();
  await seatUp(page, {
    players: 9,
    hero: 'MP',
    villains: ['CO', 'BTN'],
    stacks: { CO: '3000', BTN: '5000' },
    heroStack: '1000',
  });
  await closePanel(page);
  await page.getByRole('button', { name: 'Mình 1', exact: true }).click();
  await pickIn(picker(), 'A', 's');
  await pickIn(picker(), 'K', 'd');
  await picker().waitFor({ state: 'detached' });
  await tap('All-in');
  await tap('All-in');
  await tap('Call');
  await board('Flop 1', [
    ['Q', 'h'],
    ['7', 'd'],
    ['2', 'c'],
    ['9', 's'],
    ['3', 'h'],
  ]);
  await page.getByText('Pot phụ 1').waitFor();
  await showdownCard().first().scrollIntoViewIfNeeded();
  await shot('24-three-way-side-pot-choose');
  await showdownCard().getByRole('button', { name: 'Mình', exact: true }).click();
  await showdownCard().getByRole('button', { name: 'Đối thủ · CO thắng' }).click();
  await shot('25-three-way-per-pot-picked');
  // split the main pot with the short stack
  await showdownCard().getByRole('button', { name: 'Đối thủ · CO', exact: true }).click();
  await shot('26-three-way-split-main-pot');

  // ---- the table panel is a flow element: only the summary line sticks ----
  await page.goto(gold.record);
  await page.getByRole('button', { name: 'Mình 1', exact: true }).waitFor();
  await seatUp(page, { players: 9, hero: 'MP', villains: ['BTN'], heroStack: '5000' });
  await page.waitForTimeout(400);
  await page.mouse.wheel(0, 260);
  await page.waitForTimeout(400);
  await shot('27-panel-open-scrolled');
  const stuck = await panelBar(page).boundingBox();
  if (!stuck || stuck.y > 2) throw new Error('summary line should stay at the top');
  await panelBar(page).click(); // closes
  await page.waitForTimeout(300);
  await panelBar(page).click(); // opens again and returns to the top
  await page.waitForTimeout(700);
  if ((await page.evaluate(() => window.scrollY)) > 2) throw new Error('should scroll to the top');

  // ---- name an opponent from the box, creating him ----
  const nameBox = page.getByLabel('Tên đối thủ BTN');
  await nameBox.scrollIntoViewIfNeeded();
  await nameBox.fill('Áo đỏ');
  await page.getByRole('button', { name: '+ Tạo "Áo đỏ"' }).waitFor();
  await page.getByRole('button', { name: '+ Tạo "Áo đỏ"' }).scrollIntoViewIfNeeded();
  await shot('28-create-opponent-from-box');
  await page.getByRole('button', { name: '+ Tạo "Áo đỏ"' }).click();
  await page.waitForTimeout(500);
  await nameBox.scrollIntoViewIfNeeded();
  await shot('29-opponent-created-and-named');
  let made = null;
  for (let i = 0; i < 20 && !made; i++) {
    const { data } = await admin.from('opponents').select('id, name, venue').eq('name', 'Áo đỏ');
    made = data?.[0] ?? null;
    if (!made) await new Promise((r) => setTimeout(r, 500));
  }
  if (made?.venue !== 'Screens') throw new Error('new opponent should reach the database');
  await nameBox.fill('ao');
  await page.getByRole('button', { name: 'Áo đỏ', exact: true }).waitFor();

  // ---- Straddle is a real switch ----
  const straddle = page.getByRole('switch', { name: 'Straddle' });
  await straddle.scrollIntoViewIfNeeded();
  await shot('30-straddle-toggle-off');
  await straddle.click();
  await page.waitForTimeout(300);
  await shot('31-straddle-toggle-on');

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
  await shot('17-hand-detail');
  await page.getByText('Sửa hand').click();
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await page.getByText('Đã lưu thay đổi.').waitFor();

  // ---- onboarding practice uses the same form ----
  await page.goto(`${BASE}/onboarding/practice`);
  await page.getByRole('button', { name: 'Mình 1', exact: true }).waitFor();

  // ---- MTT session: the level fields live in the table panel ----
  await page.goto(`${BASE}/sessions/${mtt}/record`);
  await page.getByText('Level của giải').waitFor();
  await page.getByText('Level của giải').scrollIntoViewIfNeeded();
  await shot('18-mtt-table-panel');

  // ---- 375 x 550: the part in use must still sit above the save bar ----
  const low = await open(550);
  await low.goto(gold.record);
  await low.getByRole('button', { name: 'Mình 1', exact: true }).waitFor();
  await low.screenshot({ path: `${OUT}/19-550-table-open.png` });
  await seatUp(low, { players: 9, hero: 'MP', villains: ['BTN'], heroStack: '5000' });
  await closePanel(low);
  await low.getByRole('button', { name: 'Mình 1', exact: true }).click();
  await fits(low, 'hero card picker (550)', low.getByRole('group', { name: 'Bài và board' }));
  await low.screenshot({ path: `${OUT}/20-550-picker-open.png` });
  await pickIn(low.getByRole('group', { name: 'Bài và board' }), 'A', 's');
  await pickIn(low.getByRole('group', { name: 'Bài và board' }), 'K', 'd');
  await low.getByRole('button', { name: 'Open', exact: true }).first().click();
  await fits(low, 'number pad (550)', low.getByRole('group', { name: 'Lên tới' }));
  await low.screenshot({ path: `${OUT}/21-550-numpad-open.png` });

  await browser.close();

  const { data: hands } = await admin
    .from('hands')
    .select('result, actions')
    .eq('session_id', cash)
    .eq('num', 1);
  const row = hands?.[0];
  console.log('stored result:', row?.result, '| first action:', row?.actions?.[0]?.act);
  if (row?.result !== -18000) throw new Error(`expected -18000, got ${row?.result}`);
  if (errors.length) console.log('browser errors:', errors.slice(0, 5));
  if (misfits.length) throw new Error(`does not fit: ${misfits.join(', ')}`);
}

try {
  await main();
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId);
}

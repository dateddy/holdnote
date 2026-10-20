/**
 * Screenshots for task 5.1c-3 (MTT blind structure) at 375 x 550, driven by Playwright.
 *
 *   pnpm --filter web build && HOLDNOTE_SCREENS=1 pnpm --filter web start -p 3100   (other terminal)
 *   node scripts/screens-mtt.mjs
 *
 * Creates a throwaway user (Supabase secret key), signs in with the session cookie, and deletes the
 * user at the end. Pictures land in screens/5.1c-3/ (ignored by git). It also checks what reached
 * the database: blind_levels from the pasted text, hands.level, and the carry-over of SB and level.
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
const OUT = process.env.SCREENS_DIR ?? 'screens/5.1c-3';
const OPTS = { auth: { persistSession: false, autoRefreshToken: false } };
const chrome = join(homedir(), 'AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe');
mkdirSync(OUT, { recursive: true });

const admin = createClient(URL_, env.SUPABASE_SECRET_KEY, OPTS);
const email = `screens-${randomUUID().slice(0, 8)}@example.com`;
const password = randomUUID();
let userId;

const LEVELS = [
  { level: 1, sb: 25, bb: 50, ante: 0, ante_mode: 'none', minutes: 20 },
  { level: 2, sb: 50, bb: 100, ante: 0, ante_mode: 'none', minutes: 20 },
  { level: 3, sb: 75, bb: 150, ante: 150, ante_mode: 'bb', minutes: 20 },
  { level: 4, sb: 100, bb: 200, ante: 200, ante_mode: 'bb', minutes: 20 },
];

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
    .update({ onboarded_at: new Date().toISOString(), locale: 'vi', play_kind: 'mtt' })
    .eq('id', userId);
  const base = {
    user_id: userId,
    kind: 'mtt',
    mode: 'live',
    currency: 'VND',
    venue: 'Screens',
    sb: 25,
    bb: 50,
    seats: 9,
    buyin: 1_000_000,
  };
  // 45 minutes in, levels of 20 minutes: the clock says Lv 3 while the hands start at Lv 1.
  const withLevels = await admin
    .from('sessions')
    .insert({
      ...base,
      start_at: new Date(Date.now() - 45 * 60_000).toISOString(),
      mtt: { name: 'Giải thử', type: 'regular', reentry: true, start_level: 1, start_stack: 20000, blind_levels: LEVELS },
    })
    .select('id')
    .single();
  const plain = await admin
    .from('sessions')
    .insert({
      ...base,
      start_at: new Date().toISOString(),
      mtt: { name: 'Giải không cấu trúc', type: 'regular', reentry: false, start_stack: 20000 },
    })
    .select('id')
    .single();
  if (withLevels.error || plain.error) throw withLevels.error ?? plain.error;
  await admin.from('opponents').insert({ user_id: userId, name: 'Hùng', venue: 'Screens' });

  const anon = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, OPTS);
  const { data: signed, error: signError } = await anon.auth.signInWithPassword({ email, password });
  if (signError) throw signError;
  return { withLevels: withLevels.data.id, plain: plain.data.id, session: signed.session };
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

const check = (ok, what) => {
  console.log(`${ok ? 'ok    ' : 'FAILED'} ${what}`);
  if (!ok) failures.push(what);
};
const failures = [];

async function main() {
  const { withLevels, plain, session } = await setUp();
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const errors = [];
  const context = await browser.newContext({
    viewport: { width: 375, height: 550 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });
  await context.addCookies(authCookies(session));
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
  const noSideScroll = async (what) =>
    check(
      (await page.evaluate(() => document.documentElement.scrollWidth)) <= 375,
      `no horizontal scroll: ${what}`,
    );

  const panelBar = () => page.getByRole('button', { name: /^Hand #/ }).first();
  const openPanel = async () => {
    if ((await panelBar().getAttribute('aria-expanded')) !== 'true') await panelBar().click();
    await page.waitForTimeout(300);
  };
  const closePanel = async () => {
    if ((await panelBar().getAttribute('aria-expanded')) === 'true') await panelBar().click();
    await page.waitForTimeout(300);
  };
  const picker = () => page.getByRole('group', { name: 'Bài và board' });
  const pickIn = async (rank, suit) => {
    await picker().getByRole('button', { name: rank, exact: true }).first().click();
    await picker().getByRole('button', { name: suit, exact: true }).first().click();
  };
  const seatBtn = (pos) => page.getByRole('button', { name: new RegExp(`^${pos}(,|$)`) }).first();
  /** Seats and stacks of a quick fold hand, then the cards. */
  const foldHand = async () => {
    await page.getByRole('button', { name: 'Mình 1', exact: true }).waitFor();
    await openPanel();
    const group = page.getByRole('group', { name: 'Chạm một ghế để đặt vị trí.' });
    if (!(await panelBar().textContent())?.includes('MP')) {
      await group.getByRole('button', { name: /^Mình/ }).click();
      await seatBtn('MP').click();
    }
    await group.getByRole('button', { name: /^Đối thủ/ }).click();
    if (await page.getByRole('button', { name: 'BTN', exact: true }).count()) {
      await page.getByRole('button', { name: 'BTN', exact: true }).click();
    }
    const stack = page.getByLabel('Stack của đối thủ BTN');
    if (!(await stack.inputValue())) await stack.fill('20000');
    await closePanel();
    await page.getByRole('button', { name: 'Mình 1', exact: true }).click();
    await pickIn('A', 's');
    await pickIn('K', 'd');
    await picker().waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Fold', exact: true }).first().click();
  };
  const levelInput = (label) => page.getByLabel(label, { exact: true });

  // ---- 1. a new MTT session with a structure, typed and pasted ----
  await page.goto(`${BASE}/sessions/new?kind=mtt`);
  await page.getByText('Cấu trúc blind').first().waitFor();
  await page.getByText('Cấu trúc blind').first().scrollIntoViewIfNeeded();
  await shot('01-new-session-structure-empty');
  await page.getByRole('button', { name: 'Thêm level', exact: true }).click();
  await levelInput('Small blind').fill('100');
  await levelInput('Big blind').fill('200');
  await page.getByRole('button', { name: 'BB ante', exact: true }).click();
  await page.waitForTimeout(200);
  await shot('02-new-session-add-level');
  await page.getByRole('button', { name: 'Lưu level', exact: true }).click();
  await page.getByRole('button', { name: 'Dán từ văn bản', exact: true }).click();
  await page
    .getByPlaceholder(/8 300\/600 600/)
    .fill(
      ['Level SB/BB Ante', '2 150/300 300 20', '3 200/400 400 20', 'xin chào', '4 300/600 600 20', '5 400/800'].join(
        '\n',
      ),
    );
  await page.getByRole('button', { name: 'Đọc văn bản', exact: true }).click();
  await page.getByText(/Đọc được 4 dòng, bỏ qua 2 dòng/).waitFor();
  await page.getByText(/Đọc được 4 dòng/).scrollIntoViewIfNeeded();
  await shot('03-new-session-pasted');
  await noSideScroll('new session');
  // level numbers from the paste replaced the typed row; the start level fills the blinds
  await page.getByLabel('Level vào').fill('3');
  await page.getByLabel('Buy-in').fill('1000k');
  await page.locator('button[type=submit]').click();
  await page.waitForURL(/\/before$/, { timeout: 15000 }).catch(async (e) => {
    await page.screenshot({ path: `${OUT}/fail-new-session.png`, fullPage: true });
    console.log('alerts:', await page.getByRole('alert').allTextContents());
    throw e;
  });
  await shot('04-before-session-structure-link');
  const created = (
    await admin.from('sessions').select('id, sb, bb, mtt').eq('user_id', userId).order('created_at')
  ).data?.find(
    (x) => x.id !== withLevels && x.id !== plain && (x.mtt?.blind_levels?.length ?? 0) === 4,
  );
  check(Boolean(created), 'pasted structure reached sessions.mtt.blind_levels (4 levels)');
  check(Number(created?.bb) === 400, `blinds taken from the start level 3? bb = ${created?.bb}`);

  // ---- 2. recording with a structure ----
  await page.goto(`${BASE}/sessions/${withLevels}/record`);
  await page.getByRole('button', { name: 'Mình 1', exact: true }).waitFor();
  await page.getByText('Lv 1 · 25/50').first().waitFor();
  await page.getByText('Có thể đã sang Lv 3').waitFor({ timeout: 8000 });
  await closePanel();
  await shot('05-record-level-hint');
  await noSideScroll('record with hint');
  await openPanel();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Lên level', exact: true }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await shot('06-record-panel-level-buttons');
  await page.getByRole('button', { name: 'Lên level', exact: true }).click();
  await page.getByText('Lv 2 · 50/100').first().waitFor();
  await page.getByText('Level của giải').scrollIntoViewIfNeeded();
  await shot('07-after-level-up');
  check((await levelInput('Big blind').inputValue()) === '100', 'Lên level fills BB 100');
  check((await levelInput('Small blind').inputValue()) === '50', 'Lên level fills SB 50');
  await page.getByRole('button', { name: 'Lùi level', exact: true }).click();
  await page.getByText('Lv 1 · 25/50').first().waitFor();
  await page.getByRole('button', { name: 'Lên level', exact: true }).click();
  await closePanel();
  await foldHand();
  await page.getByRole('button', { name: /^Lưu hand/ }).click();
  await page.getByText(/Đã lưu hand #1/).waitFor();
  await page.waitForTimeout(500);
  await page.getByText('Lv 2 · 50/100').first().waitFor();
  check(true, 'the next hand starts at Lv 2 · 50/100');
  await shot('08-next-hand-keeps-level');
  // manual edit of the BB keeps the level number, and the SB follows it
  await openPanel();
  await levelInput('Big blind').fill('120');
  await page.getByText('Lv 2 · 60/120').first().waitFor();
  check(true, 'typing a BB keeps Lv 2 and the SB follows (60/120)');
  await page.getByText('Level của giải').scrollIntoViewIfNeeded();
  await shot('09-manual-bb-keeps-level');

  let row = null;
  for (let i = 0; i < 30 && !row; i++) {
    const { data } = await admin.from('hands').select('level, level_bb, ante, ante_mode').eq('session_id', withLevels).eq('num', 1);
    row = data?.[0] ?? null;
    if (!row) await new Promise((r) => setTimeout(r, 500));
  }
  check(row?.level === 2 && Number(row?.level_bb) === 100, `hand 1 stored level ${row?.level}, level_bb ${row?.level_bb}`);

  // ---- 3. no structure: everything typed, SB carried to the next hand ----
  await page.goto(`${BASE}/sessions/${plain}/record`);
  await page.getByRole('button', { name: 'Mình 1', exact: true }).waitFor();
  await openPanel();
  await page.getByText('Level của giải').scrollIntoViewIfNeeded();
  check((await page.getByRole('button', { name: 'Lên level' }).count()) === 0, 'no Lên level button without a structure');
  await shot('10-plain-session-panel');
  await levelInput('Big blind').fill('200');
  await levelInput('Small blind').fill('100');
  await closePanel();
  await foldHand();
  await page.getByRole('button', { name: /^Lưu hand/ }).click();
  await page.getByText(/Đã lưu hand #1/).waitFor();
  await page.waitForTimeout(500);
  await openPanel();
  check((await levelInput('Big blind').inputValue()) === '200', 'BB 200 carried to the next hand');
  check((await levelInput('Small blind').inputValue()) === '100', 'SB 100 carried to the next hand');
  await page.getByText('Level của giải').scrollIntoViewIfNeeded();
  await shot('11-plain-session-next-hand-carried');

  // ---- 4. editing the structure in the middle of a session ----
  await page.goto(`${BASE}/sessions/${withLevels}/structure`);
  await page.getByText('4 level').waitFor();
  await shot('12-structure-page');
  await page.getByRole('button', { name: 'Xóa level 4', exact: true }).click();
  await page.getByRole('button', { name: 'Lưu cấu trúc', exact: true }).click();
  await page.getByText('Đã lưu cấu trúc blind.').waitFor();
  await shot('13-structure-saved');
  const { data: after } = await admin.from('sessions').select('mtt').eq('id', withLevels).single();
  check(after?.mtt?.blind_levels?.length === 3, 'structure edit saved 3 levels');
  check(after?.mtt?.name === 'Giải thử' && after?.mtt?.start_stack === 20000, 'rest of sessions.mtt kept');

  // ---- 5. end of an MTT session ----
  await page.goto(`${BASE}/sessions/${withLevels}/end`);
  await page.locator('input[name=prize]').waitFor();
  await page.locator('input[name=prize]').fill('3000k');
  await page.locator('input[name=reentries]').fill('1');
  await page.locator('input[name=place]').fill('12');
  await page.locator('input[name=entries]').fill('180');
  await page.waitForTimeout(300);
  await page.getByText(/Chi phí: 2 lần vào/).waitFor();
  await shot('14-end-mtt-result');
  check(true, 'end form shows cost 2 entries and the result');
  await page.locator('button[type=submit]').click();
  await page.waitForURL(new RegExp(`/sessions/${withLevels}$`));
  const { data: ended } = await admin.from('sessions').select('mtt').eq('id', withLevels).single();
  check(ended?.mtt?.blind_levels?.length === 3, 'ending the session kept the blind structure');
  check(ended?.mtt?.prize === 3000000 && ended?.mtt?.reentries === 1, 'prize and re-entries saved');

  await browser.close();
  if (errors.length) console.log('browser errors:', errors.slice(0, 5));
  if (failures.length) throw new Error(`failed: ${failures.join('; ')}`);
}

try {
  await main();
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId);
}

/**
 * Screenshots and checks for task 5.1d-4 (desktop layout) at 1440 x 900, 1024 x 768 and 375 x 667.
 *
 *   pnpm --filter web build && HOLDNOTE_SCREENS=1 pnpm --filter web start -p 3100   (other terminal)
 *   node scripts/screens-5.1d-4.mjs
 *
 * Creates a throwaway user (Supabase secret key) with a few sessions, one of them left open for
 * days, signs in with the session cookie and deletes the user at the end. Pictures land in
 * screens/5.1d-4/ (ignored by git). The browser runs in the Ho Chi Minh time zone.
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
const OUT = process.env.SCREENS_DIR ?? 'screens/5.1d-4';
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

const a = (street, actor, pos, act, amount) => ({
  street,
  actor,
  pos,
  act,
  ...(amount !== undefined && { amount }),
});

async function seed(userId) {
  const cash = {
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
      // a win, a loss, an MTT, and one left open for days (13:12 in Ho Chi Minh time)
      {
        ...cash,
        date: '2026-10-14',
        start_at: '2026-10-14T12:00:00Z',
        end_at: '2026-10-14T15:30:00Z',
        cashout: 10000,
      },
      {
        ...cash,
        date: '2026-09-20',
        start_at: '2026-09-20T12:00:00Z',
        end_at: '2026-09-20T16:00:00Z',
        cashout: 2000,
      },
      {
        user_id: userId,
        kind: 'mtt',
        mode: 'online',
        currency: 'VND',
        venue: 'GGPoker',
        sb: 100,
        bb: 200,
        seats: 9,
        buyin: 500000,
        date: '2026-10-10',
        start_at: '2026-10-10T12:00:00Z',
        end_at: '2026-10-10T17:00:00Z',
        mtt: { name: 'Sunday', type: 'regular', prize: 1200000, place: 12, entries: 180 },
      },
      { ...cash, date: '2026-10-21', start_at: '2026-10-21T06:12:00Z' },
    ])
    .select('id, date, kind');
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
      hand(open, 1, { hero_pos: 'BTN', villain_pos: 'BB', outcome: 'fold', actions: [] }),
    ])
    .select('id, num, session_id');
  if (handError) throw handError;
  const first = hands.find((h) => h.session_id === ended && h.num === 1).id;
  return { ended, open, first };
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
      deviceScaleFactor: width < 600 ? 2 : 1,
      colorScheme: 'dark',
      hasTouch: width < 600,
      timezoneId: 'Asia/Ho_Chi_Minh',
      locale: 'vi-VN',
    });
    await context.addCookies(authCookies(user.session));
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    return { context, page };
  }
  const noOverflow = async (page, what, width) => {
    const wide = await page.evaluate(
      (w) =>
        [...document.querySelectorAll('body *')]
          .filter((e) => e.getBoundingClientRect().right > w + 1 && !e.closest('.overflow-x-auto'))
          .slice(0, 4)
          .map((e) => `${e.tagName}.${String(e.className).slice(0, 50)}`),
      width,
    );
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    if (sw > width) {
      console.log(
        await page.evaluate(() => {
          const out = [];
          for (const el of document.querySelectorAll('body *')) {
            const before = document.documentElement.scrollWidth;
            const keep = el.style.display;
            el.style.display = 'none';
            const after = document.documentElement.scrollWidth;
            el.style.display = keep;
            if (after < before && el.children.length < 3)
              out.push(`${el.tagName}.${String(el.className).slice(0, 40)} ${before}->${after}`);
          }
          return out.slice(0, 6).join(' / ');
        }),
      );
    }
    const wider = await page.evaluate(() =>
      [...document.querySelectorAll('body, body *')]
        .filter((e) => e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0)
        .slice(0, 5)
        .map(
          (e) =>
            `${e.tagName}.${String(e.className).slice(0, 30)} ${e.scrollWidth}>${e.clientWidth}`,
        ),
    );
    check(
      sw <= width,
      `${what}: no horizontal scroll (${sw}) ${wide.join(' ; ')} [${wider.join(' ; ')}]`,
    );
  };

  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [1024, 768],
  ]) {
    const tag = String(width);
    const { context, page } = await open(width, height);
    const shot = (name) => page.screenshot({ path: `${OUT}/${tag}-${name}.png` });

    // ---- home: shell (rail, account menu) ----
    await page.goto(`${BASE}/`);
    await page.getByRole('heading', { name: 'Phiên', exact: true }).waitFor();
    await noOverflow(page, `${tag} home`, width);
    const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
    check((await nav.getByRole('link').count()) === 2, `${tag}: rail has Trang chủ and Thống kê`);
    const home = await nav.getByRole('link', { name: 'Trang chủ' }).boundingBox();
    check(
      home != null && home.width <= 96,
      `${tag}: rail entry is icon + name below (${home?.width}px)`,
    );
    await page.getByRole('button', { name: 'Tài khoản' }).click();
    await page.waitForTimeout(150);
    const items = await page.getByRole('menuitem').allTextContents();
    check(
      items.join('|') === 'Cài đặt|Đăng xuất',
      `${tag}: account menu has Cài đặt and Đăng xuất (${items.join('|')})`,
    );
    await shot('home-account-menu');
    await page.keyboard.press('Escape');
    const panel = await page.locator('main').boundingBox();
    check(panel != null && panel.x + panel.width > width - 40, `${tag}: page fills the width`);
    check(
      (await page.getByText('HoldNote').first().isVisible()) === true,
      `${tag}: bar has HoldNote`,
    );
    check(
      (await page.getByRole('link', { name: /Phiên mới/ }).count()) === 1,
      `${tag}: one "Phiên mới" (floating)`,
    );
    check(
      (await page.getByRole('button', { name: 'Xóa lọc' }).count()) === 0,
      `${tag}: no "Xóa lọc" while not filtering`,
    );
    // stale strip: one row, buttons not links
    check(
      (await page.getByRole('button', { name: 'Kết thúc phiên' }).count()) === 1 &&
        (await page.getByRole('button', { name: 'Để sau' }).count()) === 1,
      `${tag}: stale strip has two buttons`,
    );
    const stale = await page.getByRole('button', { name: 'Kết thúc phiên' }).boundingBox();
    const later = await page.getByRole('button', { name: 'Để sau' }).boundingBox();
    check(
      stale != null && later != null && Math.abs(stale.y - later.y) < 12,
      `${tag}: stale buttons on one line`,
    );
    // tiles side by side above the table
    const tiles = await page
      .locator('main .grid.grid-cols-3 > div')
      .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    check(tiles.length === 3 && new Set(tiles).size === 1, `${tag}: three tiles in one row`);
    // Net tile: cash in bb, MTT in money, two lines, not a dash
    const net = await page.locator('main .grid.grid-cols-3 > div').nth(1).innerText();
    check(
      /bb/.test(net) && /₫|VND|đ/.test(net) && !/^—/m.test(net.split('\n')[1] ?? ''),
      `${tag}: Net shows bb and money (${net.replace(/\n/g, ' | ')})`,
    );
    await shot('home');

    // ---- filter: one-choice result; clear chip ----
    const rowsBefore = await page.locator('tbody tr').count();
    await page.getByRole('button', { name: 'Thắng', exact: true }).click();
    const wins = await page.locator('tbody tr').count();
    await page.getByRole('button', { name: 'Thua', exact: true }).click();
    const losses = await page.locator('tbody tr').count();
    check(wins >= 1 && losses >= 1, `${tag}: Thắng ${wins} / Thua ${losses} sessions, never zero`);
    check(
      (await page
        .getByRole('button', { name: 'Thắng', exact: true })
        .getAttribute('aria-pressed')) === 'false',
      `${tag}: choosing Thua turns Thắng off`,
    );
    check(
      (await page.getByRole('button', { name: 'Xóa lọc' }).count()) === 1,
      `${tag}: "Xóa lọc" appears while filtering`,
    );
    await shot('home-filtered');
    await page.getByRole('button', { name: 'Xóa lọc' }).click();
    check(
      (await page.locator('tbody tr').count()) === rowsBefore,
      `${tag}: clear restores the list`,
    );

    // ---- table row: whole row opens, ⋯ has Sửa and Xóa ----
    await page.locator('tbody tr').first().locator('button').first().click();
    await page.waitForTimeout(150);
    check((await page.getByRole('menuitem').count()) === 2, `${tag}: ⋯ shows Sửa and Xóa`);
    check(page.url() === `${BASE}/`, `${tag}: opening ⋯ does not open the session`);
    await page.keyboard.press('Escape');
    await page
      .locator('tbody tr', { hasText: '14' })
      .first()
      .click({ position: { x: 150, y: 10 } });
    await page.waitForURL(/\/sessions\//);
    check(/\/sessions\/[0-9a-f-]+/.test(page.url()), `${tag}: clicking a row opens the session`);
    await context.close();
  }

  // ---- forms and the hand screen, both desktop widths ----
  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [1024, 768],
  ]) {
    const tag = String(width);
    const { context, page } = await open(width, height);
    const shot = (name) => page.screenshot({ path: `${OUT}/${tag}-${name}.png`, fullPage: false });

    await page.goto(`${BASE}/sessions/new`);
    await page.getByRole('heading', { name: 'Phiên mới' }).first().waitFor();
    await page.waitForTimeout(300);
    await noOverflow(page, `${tag} new session`, width);
    const cards = await page
      .locator('main form section')
      .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
    check(
      new Set(cards).size === (width >= 1280 ? 2 : 1),
      `${tag}: blocks in ${width >= 1280 ? 'two columns' : 'one column'} (${cards.join(',')})`,
    );
    const save = await page.getByRole('button', { name: /^Tạo/ }).boundingBox();
    check(
      save != null && save.x > width * 0.6 && save.y < height - 80 === true,
      `${tag}: Tạo button in the right column`,
    );
    check(
      (await page.getByRole('group', { name: 'Đơn vị tiền' }).getByRole('button').count()) === 2,
      `${tag}: unit is Chip | Tiền tệ`,
    );
    await shot('form-new');

    await page.goto(`${BASE}/sessions/${ids.open}/edit`);
    await page.getByRole('heading', { name: 'Sửa phiên' }).first().waitFor();
    await page.waitForTimeout(400);
    const date = await page.locator('input[type=date]').inputValue();
    const times = await page
      .locator('input[type=time]')
      .evaluateAll((els) => els.map((e) => e.value));
    check(date === '2026-10-21', `${tag}: edit loads the saved date (${date})`);
    check(
      times[0] === '13:12' && times[1] === '',
      `${tag}: edit loads saved times (${times.join(' / ')})`,
    );
    await shot('form-edit');

    // ---- record hand: three columns, shortcuts ----
    await page.goto(`${BASE}/sessions/${ids.open}/record`);
    await page.getByText('Hand #2').first().waitFor();
    await page.waitForTimeout(400);
    await noOverflow(page, `${tag} record`, width);
    check(
      (await page.getByRole('button', { name: 'Phím tắt (?)' }).count()) === 1,
      `${tag}: record has the shortcuts button`,
    );
    const cols = await page.evaluate(() => {
      const q = (s) => document.querySelector(s)?.getBoundingClientRect().left ?? -1;
      return [q('[aria-label="Bài mình 1"], [aria-label="Bài 1"]'), q('button[aria-label="Hủy"]')];
    });
    await shot('record');
    await page.keyboard.press('?');
    await page.waitForTimeout(150);
    check(await page.getByRole('dialog').isVisible(), `${tag}: ? opens the shortcut list`);
    await shot('record-shortcuts');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);

    // typing in a text field never fires an action
    const thought = page.getByLabel('Một câu suy nghĩ');
    if ((await thought.count()) > 0) {
      await thought.fill('');
      await thought.pressSequentially('fcxbroaz');
      check(
        (await thought.inputValue()) === 'fcxbroaz',
        `${tag}: letters typed in "Một câu suy nghĩ" stay text`,
      );
    }
    void cols;

    // saved hand, edit screen
    await page.goto(`${BASE}/hands/${ids.first}/edit`);
    await page.waitForTimeout(600);
    await noOverflow(page, `${tag} edit hand`, width);
    await shot('hand-edit');
    await context.close();
  }

  // ---- card typing at 1440 (own pass: needs an open card slot) ----
  {
    const { context, page } = await open(1440, 900);
    await page.goto(`${BASE}/sessions/${ids.open}/record`);
    await page.getByText('Hand #2').first().waitFor();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Mình 1' }).click();
    await page.waitForTimeout(250);
    await page.keyboard.type('Ah');
    await page.keyboard.type('Kd');
    await page.waitForTimeout(200);
    const first = await page.getByRole('button', { name: 'Mình 1' }).innerText();
    const second = await page.getByRole('button', { name: 'Mình 2' }).innerText();
    check(/A/.test(first) && /K/.test(second), `cards typed: "${first.trim()}" "${second.trim()}"`);
    await page.screenshot({ path: `${OUT}/1440-record-typed-cards.png` });
    await context.close();
  }

  // ---- phone: what changed in shared components ----
  {
    const { context, page } = await open(375, 667);
    const shot = (name) => page.screenshot({ path: `${OUT}/375-${name}.png` });
    await page.goto(`${BASE}/`);
    await page.getByRole('heading', { name: 'Phiên', exact: true }).waitFor();
    await noOverflow(page, '375 home', 375);
    const fab = await page.getByRole('link', { name: /Phiên mới/ }).boundingBox();
    const bar = await page.getByRole('navigation', { name: 'Điều hướng chính' }).boundingBox();
    check(
      fab != null && bar != null && fab.y + fab.height <= bar.y,
      '375: "Phiên mới" floats above the tab bar',
    );
    await shot('home');
    await page.getByRole('button', { name: 'Thua', exact: true }).click();
    check(
      (await page.getByRole('button', { name: 'Xóa lọc' }).count()) === 1,
      '375: "Xóa lọc" chip while filtering',
    );
    await shot('home-filtered');
    await page.goto(`${BASE}/sessions/${ids.open}/edit`);
    await page.getByRole('heading', { name: 'Sửa phiên' }).first().waitFor();
    await page.waitForTimeout(400);
    await noOverflow(page, '375 edit session', 375);
    await shot('form-edit');
    await page.goto(`${BASE}/sessions/${ids.open}/record`);
    await page.getByText('Hand #2').first().waitFor();
    await page.waitForTimeout(400);
    await noOverflow(page, '375 record', 375);
    check(
      (await page.getByRole('button', { name: 'Phím tắt (?)' }).count()) === 0,
      '375: no shortcuts button on a phone',
    );
    await shot('record');
    await context.close();
  }

  await browser.close();
  const real = errors.filter((e) => !/favicon|ERR_|Failed to load resource/.test(e));
  check(real.length === 0, `no page errors (${real.slice(0, 3).join(' | ')})`);
}

try {
  await main();
} catch (e) {
  console.error(e);
  failures.push(String(e));
} finally {
  for (const id of users) await admin.auth.admin.deleteUser(id);
}
if (failures.length) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exit(1);
}

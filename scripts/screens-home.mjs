/**
 * Screenshots for task 5.1d-1 (home = session list) at 375 x 667 and 1440 x 900, by Playwright.
 *
 *   pnpm --filter web build && HOLDNOTE_SCREENS=1 pnpm --filter web start -p 3100   (other terminal)
 *   node scripts/screens-home.mjs
 *
 * Creates two throwaway users (Supabase secret key): one with sessions, one empty. Signs in with
 * the session cookie and deletes both users at the end. Pictures land in screens/5.1d-1/ (ignored
 * by git).
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
const OUT = process.env.SCREENS_DIR ?? 'screens/5.1d-1';
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

async function makeUser(label) {
  const email = `screens-${label}-${randomUUID().slice(0, 8)}@example.com`;
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

async function seed(userId) {
  const cash = (over) => ({
    user_id: userId,
    kind: 'cash',
    mode: 'live',
    currency: 'VND',
    venue: 'Chill',
    stake_label: '25/50',
    sb: 25,
    bb: 50,
    seats: 9,
    buyin: 10000,
    ...over,
  });
  const rows = [
    cash({
      date: '2026-10-14',
      start_at: iso('2026-10-14', '19:00'),
      end_at: iso('2026-10-14', '22:30'),
      cashout: 12500,
      summary: { notes: 'Bàn loose, nhiều người call 3bet' },
    }),
    cash({
      date: '2026-10-03',
      start_at: iso('2026-10-03', '20:00'),
      end_at: iso('2026-10-03', '22:00'),
      cashout: 6000,
    }),
    cash({
      date: '2026-09-27',
      venue: 'Saigon Club',
      stake_label: '20/50',
      start_at: iso('2026-09-27', '19:00'),
      end_at: iso('2026-09-27', '23:30'),
      cashout: 9000,
    }),
    {
      user_id: userId,
      kind: 'mtt',
      mode: 'online',
      currency: 'VND',
      venue: 'GGPoker',
      date: '2026-09-20',
      buyin: 500000,
      start_at: iso('2026-09-20', '14:00'),
      end_at: iso('2026-09-20', '19:00'),
      mtt: {
        name: 'Sunday Million',
        type: 'regular',
        reentries: 0,
        place: 12,
        entries: 180,
        prize: 3000000,
      },
    },
  ];
  const { data: sessions, error } = await admin.from('sessions').insert(rows).select('id, date');
  if (error) throw error;
  const byDate = Object.fromEntries(sessions.map((s) => [s.date, s.id]));
  const hands = [];
  const add = (sessionId, n, flaggedCount) => {
    for (let i = 1; i <= n; i++) {
      hands.push({
        user_id: userId,
        session_id: sessionId,
        num: i,
        hero_cards: ['Ah', 'Kd'],
        result: i % 2 ? 100 : -50,
        flagged: i <= flaggedCount,
      });
    }
  };
  add(byDate['2026-10-14'], 12, 2);
  add(byDate['2026-10-03'], 8, 1);
  add(byDate['2026-09-27'], 20, 0);
  const { error: handError } = await admin.from('hands').insert(hands);
  if (handError) throw handError;
}

async function addOpen(userId) {
  const { data, error } = await admin
    .from('sessions')
    .insert({
      user_id: userId,
      kind: 'cash',
      mode: 'live',
      currency: 'VND',
      venue: 'Chill',
      stake_label: '25/50',
      sb: 25,
      bb: 50,
      seats: 9,
      buyin: 10000,
      date: '2026-10-21',
      start_at: new Date(Date.now() - 50 * 60_000).toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  const { error: handError } = await admin.from('hands').insert(
    [1, 2, 3].map((num) => ({
      user_id: userId,
      session_id: data.id,
      num,
      hero_cards: ['Qs', 'Qd'],
      result: num === 2 ? -150 : 250,
      flagged: num === 3,
    })),
  );
  if (handError) throw handError;
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
  const full = await makeUser('full');
  const empty = await makeUser('empty');
  await seed(full.id);

  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const errors = [];

  async function open(user, width, height) {
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
    const page = await open(full, 375, 667);
    const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
    await page.goto(`${BASE}/`);
    await page.getByRole('heading', { name: 'Phiên', exact: true }).waitFor();
    check(
      (await page.evaluate(() => document.documentElement.scrollWidth)) <= 375,
      'phone: no horizontal scroll',
    );
    check(
      (await page.getByText('Tháng 10').count()) + (await page.getByText(/tháng 10/i).count()) > 0,
      'phone: month heading',
    );
    await shot('phone-1-unfiltered');

    await page.getByRole('button', { name: 'Giải thích' }).first().click();
    await page.waitForTimeout(150);
    check((await page.getByRole('tooltip').count()) === 1, 'phone: tap opens one tip');
    await shot('phone-2-infotip');
    await page.getByRole('button', { name: 'Giải thích' }).nth(1).click();
    await page.waitForTimeout(150);
    check((await page.getByRole('tooltip').count()) === 1, 'phone: only one tip stays open');
    await page.mouse.click(190, 330);
    await page.waitForTimeout(150);
    check((await page.getByRole('tooltip').count()) === 0, 'phone: tap outside closes the tip');

    await page.getByRole('button', { name: 'Cash', exact: true }).click();
    await page.getByRole('button', { name: 'Thua', exact: true }).click();
    await page
      .getByRole('button', { name: /^Tháng/ })
      .first()
      .click();
    await page.waitForTimeout(150);
    await shot('phone-3-month-menu');
    await page.getByRole('group', { name: 'Tháng' }).getByRole('button').nth(1).click();
    await page.waitForTimeout(150);
    check(
      page.url().includes('kind=cash') && page.url().includes('loss=1'),
      'phone: filter in URL',
    );
    check(await page.getByRole('button', { name: 'Xóa lọc' }).isVisible(), 'phone: clear shown');
    await shot('phone-4-filtered');
    await page.reload();
    check(
      (await page
        .getByRole('button', { name: 'Thua', exact: true })
        .getAttribute('aria-pressed')) === 'true',
      'phone: filter survives reload',
    );
    await page.getByRole('button', { name: 'Xóa lọc' }).click();
    await page.getByRole('searchbox', { name: 'Tìm theo địa điểm, ghi chú' }).fill('doi thu');
    await page.waitForTimeout(150);
    await shot('phone-5-search-no-match');

    await addOpen(full.id);
    await page.goto(`${BASE}/`);
    await page.getByText('Đang chơi').first().waitFor();
    await shot('phone-6-open-session');
    check(
      (
        await page
          .getByRole('link', { name: /Đang chơi/ })
          .first()
          .getAttribute('href')
      )?.endsWith('/record') ?? false,
      'phone: open session links to Ghi hand',
    );
    await page.context().close();
  }
  {
    const page = await open(empty, 375, 667);
    await page.goto(`${BASE}/`);
    await page.getByRole('heading', { name: 'Chưa có phiên nào' }).waitFor();
    await page.screenshot({ path: `${OUT}/phone-7-empty.png` });
    await page.context().close();
  }

  // ---------------- desktop ----------------
  {
    const page = await open(full, 1440, 900);
    const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
    await page.goto(`${BASE}/`);
    await page.getByRole('columnheader', { name: /Ngày/ }).waitFor();
    check(
      await page.getByRole('navigation', { name: 'Điều hướng chính' }).first().isVisible(),
      'desktop: side nav',
    );
    await shot('desktop-1-open-session');

    await page.getByRole('button', { name: /^Net/ }).first().click();
    await page.waitForTimeout(150);
    check(
      (await page.getByRole('columnheader', { name: /Net/ }).getAttribute('aria-sort')) ===
        'descending',
      'desktop: sort by net',
    );
    await page.getByRole('button', { name: 'Cash', exact: true }).first().click();
    await page.getByRole('button', { name: 'Thua', exact: true }).first().click();
    await page
      .getByRole('button', { name: /^Tháng/ })
      .first()
      .click();
    await page.getByRole('group', { name: 'Tháng' }).getByRole('button').nth(1).click();
    await page.waitForTimeout(150);
    await shot('desktop-2-filtered');

    await page.getByRole('button', { name: 'Xóa lọc' }).first().click();
    await admin.from('sessions').delete().eq('user_id', full.id).is('end_at', null);
    await page.goto(`${BASE}/`);
    await page.getByRole('columnheader', { name: /Ngày/ }).waitFor();
    await shot('desktop-3-unfiltered');
    await page.context().close();
  }
  {
    const page = await open(empty, 1440, 900);
    await page.goto(`${BASE}/`);
    await page.getByRole('heading', { name: 'Chưa có phiên nào' }).waitFor();
    await page.screenshot({ path: `${OUT}/desktop-4-empty.png` });
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

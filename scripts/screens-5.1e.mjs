/**
 * Screenshots and checks for task 5.1e (review block of the hand screen) at 375px, by Playwright.
 *
 *   pnpm --filter web build && HOLDNOTE_SCREENS=1 pnpm --filter web start -p 3100   (other terminal)
 *   node scripts/screens-5.1e.mjs        (SCREENS_LIVE_AI=0 skips the one real rebuttal call)
 *
 * Throwaway user with five hands: no review, AI only, AI + own, rebuttal kept, rebuttal revised.
 * Pictures land in screens/5.1e/ (ignored by git).
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
const OUT = process.env.SCREENS_DIR ?? 'screens/5.1e';
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
  const { data: session, error } = await admin
    .from('sessions')
    .insert({
      user_id: userId,
      kind: 'cash',
      mode: 'live',
      currency: 'CHIP',
      venue: 'Chill',
      stake_label: '25/50',
      sb: 25,
      bb: 50,
      seats: 9,
      buyin: 5000,
      date: '2026-10-21',
      start_at: ago(120),
      end_at: ago(10),
      cashout: 7000,
    })
    .select('id')
    .single();
  if (error) throw error;

  const hand = (num) => ({
    user_id: userId,
    session_id: session.id,
    num,
    hero_cards: ['Ad', 'Qd'],
    board: ['Qc', '7s', '2h', 'Ah', 'Qh'],
    hero_pos: 'MP',
    villain_pos: 'BTN',
    hero_stack: 5000,
    villain_stack: 5000,
    outcome: 'win',
    result: 2250,
    flagged: true,
    thought: 'Đối thủ bet river lớn, mình nghĩ họ bluff.',
    actions: [
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
    ],
  });
  const { data: hands, error: handError } = await admin
    .from('hands')
    .insert([hand(1), hand(2), hand(3), hand(4), hand(5)])
    .select('id, num');
  if (handError) throw handError;
  const id = (n) => hands.find((h) => h.num === n).id;

  const aiRow = (handId, over = {}) => ({
    user_id: userId,
    hand_id: handId,
    source: 'ai',
    prompt_version: 'v1',
    model: 'test',
    range_text:
      'Đối thủ call open ở BTN với range rộng: Ax, broadway, đôi nhỏ; bet lớn river thường là two pair trở lên.',
    math_text: 'River: cần call 30bb vào pot 52bb, pot odds 37%.',
    line_text:
      'Turn check-call hợp lý. River với full house nên check-raise lên khoảng 2.5x để lấy value.',
    error_tags: ['missed_value'],
    ev_verdict: 'mistake',
    lesson:
      '1. Có full house ở river, đừng chỉ call: raise để lấy value. 2. Đối thủ bet lớn river vẫn trả tiền cho bài mạnh.',
    accepted: false,
    is_current: true,
    ...over,
  });
  const insert = async (table, row) => {
    const { data, error: e } = await admin.from(table).insert(row).select('id').single();
    if (e) throw e;
    return data.id;
  };

  // 2: AI review only. 3: AI + own review, hand edited after the AI review.
  await insert('reviews', aiRow(id(2)));
  await insert('reviews', aiRow(id(3)));
  await insert('reviews', {
    user_id: userId,
    hand_id: id(3),
    source: 'manual',
    ev_verdict: 'correct',
    error_tags: ['none'],
    lesson: 'Mình call là đủ, đối thủ hiếm khi bluff.',
    is_current: true,
  });
  await admin
    .from('hands')
    .update({ thought: 'Đối thủ bet river lớn, mình nghĩ họ bluff. (đã sửa)' })
    .eq('id', id(3));

  // 4: rebuttal, AI kept its conclusion (the free one of this analysis).
  const kept = await insert('reviews', aiRow(id(4)));
  await insert('review_rebuttals', {
    user_id: userId,
    hand_id: id(4),
    thread_id: kept,
    review_id: kept,
    reason: 'Mình sợ đối thủ có AQ hoặc 77, raise thì chỉ bài tốt hơn mới call.',
    outcome: 'kept',
    reply:
      'Mình vẫn giữ kết luận. Với Q-full, chỉ QQ, 77 và A7 thắng bạn; còn AK, AJ, two pair và Ax đều call raise. Chỉ call ở river là bỏ lỡ value.',
    free: true,
  });

  // 5: rebuttal, AI revised: the old review goes to history, the new one is current.
  const old = await insert('reviews', aiRow(id(5), { is_current: false }));
  const fresh = await insert(
    'reviews',
    aiRow(id(5), {
      error_tags: ['none'],
      ev_verdict: 'correct',
      line_text:
        'Turn check-call, river call. Với đối thủ chỉ bet lớn khi có bài rất mạnh, call là đủ.',
      lesson:
        '1. Đối thủ chặt bet lớn river: range gồm nhiều bài thắng full house hơn bạn nghĩ. 2. Raise chỉ khi bài yếu hơn còn call được.',
    }),
  );
  await insert('review_rebuttals', {
    user_id: userId,
    hand_id: id(5),
    thread_id: old,
    review_id: old,
    new_review_id: fresh,
    reason:
      'Đối thủ này rất chặt, bet river lớn thì chỉ có QQ, 77 hoặc A7, mình raise là tự thua thêm.',
    outcome: 'revised',
    reply:
      'Đồng ý. Với một đối thủ chặt như ghi chú, range bet lớn ở river nặng về bài mạnh, raise chỉ bị bài tốt hơn call. Call là đúng, mình sửa kết luận.',
    free: true,
  });
  return { none: id(1), ai: id(2), both: id(3), kept: id(4), revised: id(5) };
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
  const count = (loc) => loc.count();
  const open = async (handId, what) => {
    await page.goto(`${BASE}/hands/${handId}`);
    await page.getByRole('heading', { name: 'AI phân tích' }).waitFor();
    check(
      (await page.evaluate(() => document.documentElement.scrollWidth)) <= 375,
      `${what}: no horizontal scroll`,
    );
    check((await count(page.getByText(/Prompt (v1|v2|cũ)/))) === 0, `${what}: no prompt label`);
  };
  // Full page: the fixed bottom tabs would land mid-picture, so they are hidden for the shot.
  const shot = async (name) => {
    await page.addStyleTag({ content: 'nav[aria-label="Điều hướng chính"]{display:none}' });
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  };
  const doneSwitch = () => page.getByRole('switch', { name: 'Tôi đã xem lại' });

  // ---- 1. no review ----
  await open(ids.none, 'none');
  check(
    (await count(page.getByRole('button', { name: 'AI review', exact: true }))) === 1,
    'none: AI review button',
  );
  check(
    (await count(page.getByText('Chưa review', { exact: true }))) === 1,
    'none: own card says Chưa review',
  );
  check(
    (await count(page.getByRole('button', { name: 'Tự review hand này' }))) === 1,
    'none: "Tự review hand này"',
  );
  await shot('1-no-review');
  await page.getByRole('button', { name: 'Tự review hand này' }).click();
  await page.getByRole('textbox', { name: 'Bài học' }).waitFor();
  check((await count(doneSwitch())) === 1, 'none: the form has "Tôi đã xem lại"');

  // ---- 2. AI review only ----
  await open(ids.ai, 'ai');
  check((await count(doneSwitch())) >= 1, 'ai: "Tôi đã xem lại" switch');
  check(
    (await count(page.getByRole('button', { name: 'Chạy lại AI review' }))) === 0,
    'ai: unchanged hand, no re-run button',
  );
  check((await count(page.getByText(/miễn phí/))) === 1, 'ai: first rebuttal said to be free');
  check((await count(page.getByText('Có AI phân tích'))) >= 1, 'ai: label "Có AI phân tích"');
  await shot('2-ai-review');

  // ---- 3. AI + own review, hand edited after the AI review ----
  await open(ids.both, 'both');
  check(
    (await count(page.getByRole('button', { name: 'Chạy lại AI review' }))) === 1,
    'both: re-run is a button after the edit',
  );
  check(
    (await count(page.getByText('Đã lưu', { exact: true }))) === 1,
    'both: own card says Đã lưu',
  );
  check((await count(page.getByText('EV: Đúng'))) === 1, 'both: collapsed own review shows the EV');
  check((await count(page.getByText('AI: Sai · Bạn: Đúng'))) === 1, 'both: divergence line');
  await shot('3-ai-and-own');

  // ---- 4. after a rebuttal, conclusion kept ----
  await open(ids.kept, 'kept');
  check(
    (await count(page.getByText('Giữ kết luận', { exact: true }))) === 1,
    'kept: AI answer says Giữ kết luận',
  );
  check(
    (await count(page.getByText(/Tính 1 lượt, còn \d+ lượt/))) === 1,
    'kept: the next rebuttal costs a turn',
  );
  await shot('4-rebuttal-kept');

  // ---- 5. after a rebuttal, conclusion revised ----
  await open(ids.revised, 'revised');
  check(
    (await count(page.getByText('Đã sửa kết luận'))) === 1,
    'revised: AI answer says Đã sửa kết luận',
  );
  check(
    (await count(page.getByText('Không lỗi'))) >= 1,
    'revised: AI fields show the new conclusion',
  );
  await shot('5-rebuttal-revised');

  // ---- 6. one real rebuttal through /api/review ----
  if (process.env.SCREENS_LIVE_AI !== '0') {
    await open(ids.ai, 'live');
    await page.getByRole('button', { name: 'Phản biện', exact: true }).click();
    await page
      .getByRole('textbox', { name: 'Vì sao bạn không đồng ý với review này?' })
      .fill(
        'Đối thủ rất chặt, bet river lớn chỉ có QQ, 77 hoặc A7; raise thì chỉ bài tốt hơn call.',
      );
    await page.getByRole('button', { name: 'Gửi phản biện' }).click();
    await page
      .getByText(/Giữ kết luận|Đã sửa kết luận|Không trừ lượt/)
      .first()
      .waitFor({ timeout: 120_000 });
    const { data: rows } = await admin
      .from('review_rebuttals')
      .select('outcome, reply, free')
      .eq('hand_id', ids.ai);
    check(
      rows?.length === 1 && rows[0].reply.length > 0 && rows[0].free,
      `live: answer saved (${JSON.stringify(rows)})`,
    );
    const { data: usage } = await admin
      .from('ai_usage')
      .select('kind, failed')
      .eq('user_id', user.id);
    check(
      usage?.some((u) => u.kind === 'rebuttal_free' && !u.failed) === true,
      `live: logged as rebuttal_free (${JSON.stringify(usage)})`,
    );
    await shot(`6-live-rebuttal-${rows?.[0]?.outcome ?? 'none'}`);
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

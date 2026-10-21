// One-off (5.1d-3c): live sessions saved as VND with chip-sized blinds (20/50) were really chips of
// 1000 VND, and CHIP sessions have no rate yet. Dry run by default; `--apply` writes.
//   node scripts/fix-chip-units.mjs [--apply]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const { createClient } = require('@supabase/supabase-js');

const apply = process.argv.includes('--apply');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

const { data, error } = await sb
  .from('sessions')
  .select('id, kind, mode, currency, venue, date, sb, bb, buyin, cashout, chip_value')
  .order('date');
if (error) throw error;

const todo = data.filter(
  (s) =>
    s.chip_value == null &&
    (s.currency === 'CHIP' ||
      (s.currency === 'VND' && s.kind === 'cash' && s.mode === 'live' && s.bb < 1000)),
);
for (const s of todo) {
  console.log(
    `${s.id.slice(0, 8)}  ${s.date}  ${s.mode}  ${s.currency} -> CHIP, 1 chip = 1000 VND   blinds ${s.sb}/${s.bb}  buyin ${s.buyin}  cashout ${s.cashout}`,
  );
}
console.log(
  `${todo.length} of ${data.length} sessions${apply ? '' : ' (dry run, nothing written)'}`,
);

if (apply) {
  // Copy what is about to change (the sessions and their hands) to backups/ first; it is gitignored.
  const ids = todo.map((s) => s.id);
  const { data: fullSessions, error: sErr } = await sb.from('sessions').select('*').in('id', ids);
  if (sErr) throw sErr;
  const { data: fullHands, error: hErr } = await sb.from('hands').select('*').in('session_id', ids);
  if (hErr) throw hErr;
  mkdirSync('backups', { recursive: true });
  const file = `backups/chip-units-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(file, JSON.stringify({ sessions: fullSessions, hands: fullHands }, null, 2));
  console.log(`backup: ${file} (${fullSessions.length} sessions, ${fullHands.length} hands)`);
  for (const s of todo) {
    const r = await sb
      .from('sessions')
      .update({ currency: 'CHIP', chip_value: 1000, chip_currency: 'VND' })
      .eq('id', s.id);
    if (r.error) throw r.error;
  }
  console.log('done');
}

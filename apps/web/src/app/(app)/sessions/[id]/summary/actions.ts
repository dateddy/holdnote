'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  mergeMtt,
  parseSummaryForm,
  SUMMARY_TEXT_FIELDS,
  type SummaryErrors,
  type SummaryFormValues,
} from '@/lib/sessions/summary';

export type SaveSummaryState = {
  values: SummaryFormValues;
  errors: SummaryErrors;
  failed: boolean;
};

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * "Rules for next session" become the player's rules (spec 3.3, 3.4): the ones typed here are
 * kept or added, the ones removed from this session's summary are deleted. A rule already kept
 * keeps its `active` flag and position.
 */
async function syncRules(supabase: Client, sessionId: string, rules: string[]) {
  const { data: existing } = await supabase
    .from('user_rules')
    .select('id, text')
    .eq('source_session_id', sessionId);
  const old = existing ?? [];

  const drop = old.filter((r) => !rules.includes(r.text)).map((r) => r.id);
  if (drop.length) await supabase.from('user_rules').delete().in('id', drop);

  const fresh = rules.filter((text) => !old.some((r) => r.text === text));
  if (!fresh.length) return;
  const { data: last } = await supabase
    .from('user_rules')
    .select('sort')
    .order('sort', { ascending: false })
    .limit(1)
    .maybeSingle();
  const start = (last?.sort ?? -1) + 1;
  await supabase.from('user_rules').insert(
    fresh.map((text, i) => ({
      text,
      source_session_id: sessionId,
      active: true,
      sort: start + i,
    })),
  );
}

/** Save the debrief: result, state, summary; end the session if it was still open. */
export async function saveSummary(
  sessionId: string,
  prev: SaveSummaryState,
  formData: FormData,
): Promise<SaveSummaryState> {
  const values: SummaryFormValues = { ...prev.values, leaks: formData.getAll('leaks').map(String) };
  for (const field of SUMMARY_TEXT_FIELDS) {
    const raw = formData.get(field);
    values[field] = typeof raw === 'string' ? raw : '';
  }

  const supabase = await createClient();
  const { data: session } = await supabase
    .from('sessions')
    .select('id, kind, mtt, end_at')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session) return { values, errors: {}, failed: true };

  const kind = session.kind === 'mtt' ? 'mtt' : 'cash';
  const parsed = parseSummaryForm(values, kind);
  if (!parsed.ok) return { values, errors: parsed.errors, failed: false };
  const { value } = parsed;

  const { error } = await supabase
    .from('sessions')
    .update({
      self_state: value.self_state,
      summary: value.summary,
      ...(kind === 'cash'
        ? { cashout: value.cashout }
        : { mtt: mergeMtt(session.mtt, value.mttResult) }),
      ...(session.end_at ? {} : { end_at: new Date().toISOString() }),
    })
    .eq('id', sessionId);
  if (error) return { values, errors: {}, failed: true };

  await syncRules(supabase, sessionId, value.summary.rules);
  redirect(`/sessions/${sessionId}`);
}

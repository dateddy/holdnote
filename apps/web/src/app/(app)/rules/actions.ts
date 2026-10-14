'use server';

import { revalidatePath } from 'next/cache';
import { moveId, parseRuleText } from '@/lib/rules/rules';
import { createClient } from '@/lib/supabase/server';

/** All writes go through the user's client: RLS keeps them to the user's own rules. */

export async function addRule(formData: FormData) {
  const text = parseRuleText(formData.get('text'));
  if (!text) return;
  const supabase = await createClient();
  const { data: last } = await supabase
    .from('user_rules')
    .select('sort')
    .order('sort', { ascending: false })
    .limit(1)
    .maybeSingle();
  await supabase.from('user_rules').insert({ text, active: true, sort: (last?.sort ?? -1) + 1 });
  revalidatePath('/rules');
}

export async function updateRule(id: string, formData: FormData) {
  const text = parseRuleText(formData.get('text'));
  if (!text) return;
  const supabase = await createClient();
  // An edited rule is the player's own now: unlink it, so re-saving that session's summary
  // (which syncs rules by text) cannot delete it.
  await supabase.from('user_rules').update({ text, source_session_id: null }).eq('id', id);
  revalidatePath('/rules');
}

export async function setRuleActive(id: string, active: boolean) {
  const supabase = await createClient();
  await supabase.from('user_rules').update({ active }).eq('id', id);
  revalidatePath('/rules');
}

export async function deleteRule(id: string) {
  const supabase = await createClient();
  await supabase.from('user_rules').delete().eq('id', id);
  revalidatePath('/rules');
}

/** Move one step up or down; positions are renumbered 0..n so gaps and ties go away. */
export async function moveRule(id: string, dir: -1 | 1) {
  const supabase = await createClient();
  const { data } = await supabase.from('user_rules').select('id, sort').order('sort').order('id');
  const rows = data ?? [];
  const order = moveId(
    rows.map((r) => r.id),
    id,
    dir,
  );
  const changed = order
    .map((ruleId, sort) => ({ ruleId, sort }))
    .filter(({ ruleId, sort }) => rows.find((r) => r.id === ruleId)?.sort !== sort);
  await Promise.all(
    changed.map(({ ruleId, sort }) =>
      supabase.from('user_rules').update({ sort }).eq('id', ruleId),
    ),
  );
  revalidatePath('/rules');
}

'use server';

import { redirect } from 'next/navigation';
import {
  OPPONENT_FIELDS,
  parseOpponentForm,
  type OpponentErrors,
  type OpponentValues,
} from '@/lib/opponents/form';
import { createClient } from '@/lib/supabase/server';

export type OpponentState = { values: OpponentValues; errors: OpponentErrors; failed: boolean };

/** Create (id null) or update an opponent. RLS limits it to the user's own rows. */
export async function saveOpponent(
  id: string | null,
  prev: OpponentState,
  formData: FormData,
): Promise<OpponentState> {
  const values = { ...prev.values };
  for (const field of OPPONENT_FIELDS) {
    const raw = formData.get(field);
    values[field] = typeof raw === 'string' ? raw : '';
  }
  const parsed = parseOpponentForm(values);
  if (!parsed.ok) return { values, errors: parsed.errors, failed: false };

  const supabase = await createClient();
  const row = { ...parsed.row, updated_at: new Date().toISOString() };
  const { error } = id
    ? await supabase.from('opponents').update(row).eq('id', id)
    : await supabase.from('opponents').insert(row);
  if (error) return { values, errors: {}, failed: true };
  redirect('/opponents');
}

/** Hands that pointed at this opponent keep their data; only the link is cleared (FK set null). */
export async function deleteOpponent(id: string) {
  const supabase = await createClient();
  await supabase.from('opponents').delete().eq('id', id);
  redirect('/opponents');
}

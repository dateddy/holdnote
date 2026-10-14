'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  parseSessionForm,
  SESSION_FIELDS,
  type FormErrors,
  type SessionFormValues,
} from '@/lib/sessions/form';

export type CreateSessionState = {
  values: SessionFormValues;
  errors: FormErrors;
  failed: boolean;
};

export async function createSession(
  prev: CreateSessionState,
  formData: FormData,
): Promise<CreateSessionState> {
  const values = { ...prev.values };
  for (const field of SESSION_FIELDS) {
    const raw = formData.get(field);
    values[field] = typeof raw === 'string' ? raw : '';
  }

  const parsed = parseSessionForm(values);
  if (!parsed.ok) return { values, errors: parsed.errors, failed: false };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sessions')
    .insert(parsed.insert)
    .select('id')
    .single();
  if (error || !data) return { values, errors: {}, failed: true };

  redirect(`/sessions/${data.id}/before`);
}

/** "Vào bàn": the session starts now. Idempotent, so a double tap keeps the first time. */
export async function enterTable(sessionId: string) {
  const supabase = await createClient();
  await supabase
    .from('sessions')
    .update({ start_at: new Date().toISOString() })
    .eq('id', sessionId)
    .is('start_at', null);
  redirect(`/sessions/${sessionId}/record`);
}

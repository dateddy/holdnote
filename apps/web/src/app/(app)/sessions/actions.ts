'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { blindLevelsToJson, readBlindLevels } from 'poker-core';
import type { Json } from '@/lib/supabase/database.types';
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

/**
 * Replaces the blind structure of an MTT session (also mid-session). The rest of `sessions.mtt`
 * stays as it is; an empty list removes the structure. Rows that do not pass `readBlindLevels` are dropped.
 */
export async function saveBlindStructure(
  sessionId: string,
  rows: unknown,
): Promise<{ ok: boolean }> {
  if (!Array.isArray(rows)) return { ok: false };
  const levels = readBlindLevels(rows);

  const supabase = await createClient();
  const { data: session } = await supabase
    .from('sessions')
    .select('kind, mtt')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session || session.kind !== 'mtt') return { ok: false };

  const current =
    session.mtt && typeof session.mtt === 'object' && !Array.isArray(session.mtt)
      ? session.mtt
      : {};
  const rest = Object.fromEntries(Object.entries(current).filter(([k]) => k !== 'blind_levels'));
  const mtt = levels.length > 0 ? { ...rest, blind_levels: blindLevelsToJson(levels) } : rest;

  const { error } = await supabase
    .from('sessions')
    .update({ mtt: mtt as unknown as Json })
    .eq('id', sessionId);
  if (error) return { ok: false };

  revalidatePath(`/sessions/${sessionId}`, 'layout');
  return { ok: true };
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

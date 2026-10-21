'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { readBlindLevels } from 'poker-core';
import type { Json } from '@/lib/supabase/database.types';
import { withBlindLevels } from '@/lib/sessions/structure';
import { createClient } from '@/lib/supabase/server';
import { fromIso } from '@/lib/sessions/end-time';
import {
  mergeMttUpdate,
  parseSessionForm,
  SESSION_FIELDS,
  type FormErrors,
  type SessionFormValues,
} from '@/lib/sessions/form';

export type CreateSessionState = {
  values: SessionFormValues;
  errors: FormErrors;
  failed: boolean;
  /** Edit only: the end time is not after the start time. */
  timeError?: boolean;
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

  const mtt = withBlindLevels(session.mtt, levels);

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

/**
 * "Sửa phiên": same fields as creating, plus the date and the start and end times. Kind never
 * changes. MTT result fields (prize, place...) are kept; the blind structure is whatever the form sent.
 */
export async function updateSession(
  sessionId: string,
  prev: CreateSessionState,
  formData: FormData,
): Promise<CreateSessionState> {
  const values = { ...prev.values };
  for (const field of SESSION_FIELDS) {
    const raw = formData.get(field);
    values[field] = typeof raw === 'string' ? raw : '';
  }

  const supabase = await createClient();
  const { data: session } = await supabase
    .from('sessions')
    .select('kind, mtt')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session) return { values, errors: {}, failed: true };
  values.kind = session.kind;

  const parsed = parseSessionForm(values);
  if (!parsed.ok) return { values, errors: parsed.errors, failed: false };

  const time = (name: string): string | null => {
    const raw = formData.get(name);
    return typeof raw === 'string' ? fromIso(raw) : null;
  };
  const startAt = time('start_at');
  const endAt = time('end_at');
  if (startAt && endAt && Date.parse(endAt) <= Date.parse(startAt)) {
    return { values, errors: {}, failed: false, timeError: true };
  }

  const { mtt, ...row } = parsed.insert;
  const { error } = await supabase
    .from('sessions')
    .update({
      ...row,
      mtt: mergeMttUpdate(session.mtt, mtt) as unknown as Json,
      start_at: startAt,
      end_at: endAt,
    })
    .eq('id', sessionId);
  if (error) return { values, errors: {}, failed: true };

  revalidatePath('/', 'layout');
  redirect(`/sessions/${sessionId}`);
}

/** Deletes the session; its hands and reviews go with it (foreign keys cascade). */
export async function deleteSession(sessionId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.from('sessions').delete().eq('id', sessionId);
  if (error) return { ok: false };
  revalidatePath('/', 'layout');
  return { ok: true };
}

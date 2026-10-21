'use server';

import { redirect } from 'next/navigation';
import { resolveEndAt } from '@/lib/sessions/end-time';
import { createClient } from '@/lib/supabase/server';
import {
  END_FIELDS,
  emptySummaryForm,
  mergeMtt,
  parseEndForm,
  type SummaryErrors,
  type SummaryFormValues,
} from '@/lib/sessions/summary';

export type EndSessionState = {
  values: SummaryFormValues;
  errors: SummaryErrors;
  failed: boolean;
};

/** "Kết thúc phiên" (DEC-044): save the result and state and close the session. The debrief comes later. */
export async function endSession(
  sessionId: string,
  prev: EndSessionState,
  formData: FormData,
): Promise<EndSessionState> {
  const values: SummaryFormValues = { ...emptySummaryForm(), ...prev.values };
  for (const field of END_FIELDS) {
    const raw = formData.get(field);
    values[field] = typeof raw === 'string' ? raw : '';
  }

  const supabase = await createClient();
  const { data: session } = await supabase
    .from('sessions')
    .select('id, kind, mtt, start_at, end_at')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session) return { values, errors: {}, failed: true };

  const kind = session.kind === 'mtt' ? 'mtt' : 'cash';
  const parsed = parseEndForm(values, kind);
  if (!parsed.ok) return { values, errors: parsed.errors, failed: false };
  const { value } = parsed;

  const { error } = await supabase
    .from('sessions')
    .update({
      self_state: value.self_state,
      ...(kind === 'cash'
        ? { cashout: value.cashout }
        : { mtt: mergeMtt(session.mtt, value.mttResult) }),
      ...(session.end_at
        ? {}
        : {
            end_at: resolveEndAt(
              typeof formData.get('end_at') === 'string'
                ? (formData.get('end_at') as string)
                : null,
              session.start_at,
              new Date().toISOString(),
            ),
          }),
    })
    .eq('id', sessionId);
  if (error) return { values, errors: {}, failed: true };

  redirect(`/sessions/${sessionId}`);
}

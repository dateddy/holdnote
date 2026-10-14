'use server';

import { redirect } from 'next/navigation';
import { setLocale } from '@/i18n/actions';
import { isLocale } from '@/i18n/locales';
import { CURRENCIES, isOneOf, KINDS, MODES } from '@/lib/sessions/form';
import { createClient } from '@/lib/supabase/server';

async function userClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect('/login');
  return { supabase, userId };
}

/** Step 1: language and money unit. */
export async function saveBasics(formData: FormData) {
  const locale = formData.get('locale');
  const currency = formData.get('currency');
  const { supabase, userId } = await userClient();
  // setLocale also sets the cookie the app reads before the profile.
  if (typeof locale === 'string' && isLocale(locale)) await setLocale(locale);
  if (isOneOf(CURRENCIES, currency)) {
    await supabase.from('profiles').update({ currency }).eq('id', userId);
  }
  redirect('/onboarding?step=2');
}

/** Step 2: what the player mostly plays; pre-fills the first session. */
export async function savePlay(formData: FormData) {
  const mode = formData.get('mode');
  const kind = formData.get('kind');
  const { supabase, userId } = await userClient();
  await supabase
    .from('profiles')
    .update({
      play_mode: isOneOf(MODES, mode) ? mode : null,
      play_kind: isOneOf(KINDS, kind) ? kind : null,
    })
    .eq('id', userId);
  redirect('/onboarding?step=3');
}

/** Finish or skip: onboarding is not shown again. */
export async function finishOnboarding() {
  const { supabase, userId } = await userClient();
  await supabase
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', userId);
  redirect('/');
}

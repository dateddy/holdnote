'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { isLocale, LOCALE_COOKIE } from './locales';

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Switch language: remembered in a cookie, and on the profile when signed in. */
export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, { path: '/', maxAge: ONE_YEAR, sameSite: 'lax' });

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) {
    await supabase.from('profiles').update({ locale }).eq('id', data.claims.sub);
  }
  revalidatePath('/', 'layout');
}

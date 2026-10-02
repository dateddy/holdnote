import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/** Locale saved on the signed-in user's profile, or null when signed out. Once per request. */
export const getProfileLocale = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return null;
  const { data } = await supabase.from('profiles').select('locale').single();
  return data?.locale ?? null;
});

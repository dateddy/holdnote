'use server';

import { createClient } from '@/lib/supabase/server';

/** ⚑ on or off for one hand (the R key and the flag button in the hand table). */
export async function setHandFlag(handId: string, flagged: boolean): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.from('hands').update({ flagged }).eq('id', handId);
  return { ok: !error };
}

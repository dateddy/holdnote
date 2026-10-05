import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { SUPABASE_URL } from './env';

/**
 * Supabase client with the secret key: bypasses RLS. Server routes only, for what a user must
 * never do themselves (write `ai_usage`, touch Vault, change `plan`). Never import it from a
 * client component. Always check the signed-in user first and pass their id explicitly.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('Missing SUPABASE_SECRET_KEY. See .env.example.');
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

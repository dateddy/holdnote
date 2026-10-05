import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loadUsage } from '@/lib/ai/quota';
import { aiStatus } from '@/lib/ai/status';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

const putSchema = z.object({
  api_key: z.string().trim().min(10).max(300),
  /** OpenRouter model id such as `vendor/model-name:variant`. Empty = default model. */
  model: z
    .string()
    .trim()
    .max(100)
    .regex(/^[\w.:/+-]*$/)
    .optional(),
});

async function currentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
}

/** Cheap authenticated call to learn whether OpenRouter accepts the key. */
async function keyWorks(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Plan, reviews left, whether an own key is set. The key itself is never returned (DEC-026). */
export async function GET() {
  const userId = await currentUser();
  if (!userId) return fail('unauthorized', 401);
  return NextResponse.json(aiStatus(await loadUsage(createAdminClient(), userId)));
}

/** Save an own OpenRouter key in Vault and switch to the bring-your-own-key plan. */
export async function PUT(request: Request) {
  const userId = await currentUser();
  if (!userId) return fail('unauthorized', 401);

  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('bad_request', 400);
  const { api_key: apiKey, model } = parsed.data;

  if (!(await keyWorks(apiKey))) return fail('key_rejected', 400);

  const admin = createAdminClient();
  const set = await admin.rpc('set_user_api_key', {
    p_user: userId,
    p_key: apiKey,
    p_model: model || (null as never),
  });
  if (set.error) return fail('server_error', 500);
  const plan = await admin.from('profiles').update({ plan: 'byok' }).eq('id', userId);
  if (plan.error) return fail('server_error', 500);

  return NextResponse.json(aiStatus(await loadUsage(admin, userId)));
}

/** Remove the own key (Vault secret included) and go back to the free plan. */
export async function DELETE() {
  const userId = await currentUser();
  if (!userId) return fail('unauthorized', 401);

  const admin = createAdminClient();
  const del = await admin.rpc('delete_user_api_key', { p_user: userId });
  if (del.error) return fail('server_error', 500);
  const plan = await admin.from('profiles').update({ plan: 'free' }).eq('id', userId);
  if (plan.error) return fail('server_error', 500);

  return NextResponse.json(aiStatus(await loadUsage(admin, userId)));
}

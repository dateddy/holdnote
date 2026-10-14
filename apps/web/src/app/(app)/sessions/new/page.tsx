import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { isOneOf, KINDS, MODES, PREFILL_COLUMNS, prefillFrom } from '@/lib/sessions/form';
import { createClient } from '@/lib/supabase/server';
import { SessionForm } from './session-form';

export default async function NewSessionPage({ searchParams }: PageProps<'/sessions/new'>) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('currency, play_mode, play_kind')
    .single();
  // Default kind: what the player said they mostly play in onboarding (DEC-042).
  const kind = isOneOf(KINDS, params.kind)
    ? params.kind
    : isOneOf(KINDS, profile?.play_kind)
      ? profile.play_kind
      : 'cash';

  // Last session of the same kind pre-fills the form (spec 3.4).
  const { data: previous } = await supabase
    .from('sessions')
    .select(PREFILL_COLUMNS)
    .eq('kind', kind)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const base = prefillFrom(previous, profile?.currency ?? 'VND');
  const initial = {
    ...base,
    kind,
    // No earlier session to copy: use the onboarding answer for live/online.
    ...(!previous && isOneOf(MODES, profile?.play_mode) && { mode: profile.play_mode }),
  };
  const t = await getTranslations('sessions');

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t('newTitle')}</h1>
        <Link href="/" className="text-sm underline underline-offset-4">
          {(await getTranslations('common'))('back')}
        </Link>
      </header>
      {previous && <p className="text-sm opacity-70">{t('prefilled')}</p>}
      <SessionForm key={kind} initial={initial} />
    </main>
  );
}

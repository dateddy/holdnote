import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { isOneOf, KINDS, PREFILL_COLUMNS, prefillFrom } from '@/lib/sessions/form';
import { createClient } from '@/lib/supabase/server';
import { SessionForm } from './session-form';

export default async function NewSessionPage({ searchParams }: PageProps<'/sessions/new'>) {
  const params = await searchParams;
  const kind = isOneOf(KINDS, params.kind) ? params.kind : 'cash';

  const supabase = await createClient();
  const [{ data: profile }, { data: previous }] = await Promise.all([
    supabase.from('profiles').select('currency').single(),
    // Last session of the same kind pre-fills the form (spec 3.4).
    supabase
      .from('sessions')
      .select(PREFILL_COLUMNS)
      .eq('kind', kind)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const initial = { ...prefillFrom(previous, profile?.currency ?? 'VND'), kind };
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

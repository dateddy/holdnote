import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { SyncStatus } from '@/components/hand/sync-status';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Temporary session screen until the real home (task 4.4).
export default async function SessionPage({ params }: PageProps<'/sessions/[id]'>) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: session } = await supabase.from('sessions').select('*').eq('id', id).maybeSingle();
  if (!session) notFound();

  const [t, tHand, locale] = await Promise.all([
    getTranslations('sessions'),
    getTranslations('hand'),
    getLocale(),
  ]);
  const kind = t(session.kind === 'mtt' ? 'mtt' : 'cash');
  const startedAt = session.start_at
    ? new Date(session.start_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t('activeTitle')}</h1>
        <Link href="/" className="text-sm underline underline-offset-4">
          {(await getTranslations('common'))('back')}
        </Link>
      </header>
      <section className="space-y-1 rounded-md border border-current/20 p-4">
        <p className="font-medium">{t('title', { kind })}</p>
        <p className="text-sm opacity-70">
          {[session.venue, session.stake_label].filter(Boolean).join(' · ')}
        </p>
        <p className="text-sm">
          {startedAt ? t('startedAt', { time: startedAt }) : t('notStarted')}
        </p>
      </section>
      <SyncStatus />
      {startedAt ? (
        <Link
          href={`/sessions/${id}/record`}
          className="flex h-14 items-center justify-center rounded-md bg-foreground text-lg font-medium text-background"
        >
          {t('recordHand')}
        </Link>
      ) : (
        <Link
          href={`/sessions/${id}/before`}
          className="flex h-14 items-center justify-center rounded-md bg-foreground text-lg font-medium text-background"
        >
          {t('goBefore')}
        </Link>
      )}
      <Link
        href={`/sessions/${id}/hands`}
        className="flex h-12 items-center justify-center rounded-md border border-current/20"
      >
        {tHand('handsList')}
      </Link>
    </main>
  );
}

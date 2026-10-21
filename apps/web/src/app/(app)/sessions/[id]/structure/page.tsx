import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { StructureForm } from '@/components/session/structure-form';
import { TopBar } from '@/components/ui/top-bar';
import { isOneOf, ANTE_MODES } from '@/lib/sessions/form';
import { sessionLevels } from '@/lib/hands/level';
import { createClient } from '@/lib/supabase/server';

/** Blind structure of an MTT session, editable at any time (spec 5). */
export default async function StructurePage({
  params,
  searchParams,
}: PageProps<'/sessions/[id]/structure'>) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: session } = await supabase
    .from('sessions')
    .select('kind, mtt, ante_mode, start_at')
    .eq('id', id)
    .maybeSingle();
  if (!session) notFound();

  const t = await getTranslations('blinds');
  // Opened from the session page's menu: back goes there; from the table: back to the table.
  const back =
    query.from === 'session'
      ? { href: `/sessions/${id}`, label: (await getTranslations('common'))('back') }
      : {
          href: session.start_at ? `/sessions/${id}/record` : `/sessions/${id}/before`,
          label: t('back'),
        };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-6">
      <TopBar title={t('pageTitle')} back={back} />
      {session.kind === 'mtt' ? (
        <StructureForm
          sessionId={id}
          initial={sessionLevels(session)}
          defaultAnteMode={isOneOf(ANTE_MODES, session.ante_mode) ? session.ante_mode : 'none'}
        />
      ) : (
        <p className="text-sm text-muted">{t('mttOnly')}</p>
      )}
    </main>
  );
}

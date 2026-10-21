import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { TopBar } from '@/components/ui/top-bar';
import { editFormFrom, PREFILL_COLUMNS } from '@/lib/sessions/form';
import { createClient } from '@/lib/supabase/server';
import { SessionForm } from '../../new/session-form';

/** "Sửa phiên": the creation form on a saved session, plus its date and times. */
export default async function EditSessionPage({ params }: PageProps<'/sessions/[id]/edit'>) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: row } = await supabase
    .from('sessions')
    .select(`${PREFILL_COLUMNS}, date, start_at, end_at`)
    .eq('id', id)
    .maybeSingle();
  if (!row) notFound();
  const { data: profile } = await supabase.from('profiles').select('currency').single();

  const [t, tCommon] = await Promise.all([getTranslations('sessions'), getTranslations('common')]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <TopBar title={t('editTitle')} back={{ href: `/sessions/${id}`, label: tCommon('back') }} />
      <SessionForm
        initial={editFormFrom(row, row.currency)}
        edit={{ sessionId: id, startAt: row.start_at, endAt: row.end_at }}
        profileCurrency={profile?.currency ?? 'VND'}
      />
    </main>
  );
}

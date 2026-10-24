import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { PLAYER_TYPES } from '@/lib/opponents/form';
import { isOneOf } from '@/lib/sessions/form';
import { TopBar } from '@/components/ui/top-bar';
import { createClient } from '@/lib/supabase/server';

export default async function OpponentsPage() {
  const supabase = await createClient();
  const { data: opponents } = await supabase
    .from('opponents')
    .select('id, name, player_type, venue, notes')
    .order('name');
  const t = await getTranslations('opponents');

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-6">
      <TopBar title={t('title')} back={{ href: '/stats', label: t('parent') }} />
      <Link
        href="/opponents/new"
        className="flex h-12 items-center justify-center rounded-xl bg-accent font-medium text-accent-foreground"
      >
        {t('add')}
      </Link>
      {!opponents?.length ? (
        <p className="text-sm text-muted">{t('none')}</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {opponents.map((o) => (
            <li key={o.id}>
              <Link href={`/opponents/${o.id}`} className="flex flex-col gap-0.5 p-3">
                <span className="flex items-center justify-between gap-2">
                  <b>{o.name}</b>
                  {isOneOf(PLAYER_TYPES, o.player_type) && (
                    <span className="text-sm text-muted">{t(`type_${o.player_type}`)}</span>
                  )}
                </span>
                {o.venue && <span className="text-sm text-muted">{o.venue}</span>}
                {o.notes && <span className="line-clamp-2 text-sm">{o.notes}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

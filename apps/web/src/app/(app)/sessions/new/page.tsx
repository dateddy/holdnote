import { getTranslations } from 'next-intl/server';
import {
  defaultUnit,
  isOneOf,
  KINDS,
  MODES,
  PREFILL_COLUMNS,
  prefillFrom,
} from '@/lib/sessions/form';
import { TopBar } from '@/components/ui/top-bar';
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
  // No earlier session to copy: use the onboarding answer for live/online, and the unit that goes
  // with it (a live cash game is played in chips).
  const mode = !previous && isOneOf(MODES, profile?.play_mode) ? profile.play_mode : base.mode;
  const initial = {
    ...base,
    kind,
    mode,
    ...(!previous && { currency: defaultUnit(kind, mode, profile?.currency ?? 'VND') }),
  };
  const t = await getTranslations('sessions');

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6 lg:max-w-none">
      <TopBar
        title={t('newTitle')}
        back={{ href: '/', label: (await getTranslations('common'))('back') }}
      />
      {previous && <p className="text-sm text-muted">{t('prefilled')}</p>}
      <SessionForm key={kind} initial={initial} profileCurrency={profile?.currency ?? 'VND'} />
    </main>
  );
}

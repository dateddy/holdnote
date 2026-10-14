import { TopBar } from '@/components/ui/top-bar';
import { getTranslations } from 'next-intl/server';
import { OpponentForm } from '@/components/opponents/opponent-form';
import { emptyOpponentForm } from '@/lib/opponents/form';

export default async function NewOpponentPage({ searchParams }: PageProps<'/opponents/new'>) {
  const { venue } = await searchParams;
  const t = await getTranslations('opponents');
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-6">
      <TopBar title={t('newTitle')} back={{ href: '/opponents', label: t('back') }} />
      <OpponentForm
        id={null}
        initial={emptyOpponentForm(typeof venue === 'string' ? venue.slice(0, 100) : '')}
      />
    </main>
  );
}

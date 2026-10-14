import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { OpponentForm } from '@/components/opponents/opponent-form';
import { emptyOpponentForm } from '@/lib/opponents/form';

export default async function NewOpponentPage({ searchParams }: PageProps<'/opponents/new'>) {
  const { venue } = await searchParams;
  const t = await getTranslations('opponents');
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t('newTitle')}</h1>
        <Link href="/opponents" className="text-sm underline underline-offset-4">
          {t('back')}
        </Link>
      </header>
      <OpponentForm
        id={null}
        initial={emptyOpponentForm(typeof venue === 'string' ? venue.slice(0, 100) : '')}
      />
    </main>
  );
}

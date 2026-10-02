import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { LocaleSwitcher } from '@/i18n/locale-switcher';
import { createClient } from '@/lib/supabase/server';

// Temporary home until the real one (task 4.4).
export default async function Home() {
  const supabase = await createClient();
  const { data: profile } = await supabase.from('profiles').select('display_name').single();
  const t = await getTranslations();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t('common.appName')}</h1>
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-sm underline underline-offset-4">
            {t('common.signOut')}
          </button>
        </form>
      </header>
      <p>{t('home.greeting', { name: profile?.display_name ?? '' })}</p>
      <Link
        href="/sessions/new"
        className="flex h-14 items-center justify-center rounded-md bg-foreground text-lg font-medium text-background"
      >
        {t('home.startSession')}
      </Link>
      <LocaleSwitcher />
    </main>
  );
}

import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { AiKeyForm } from '@/components/settings/ai-key-form';
import { loadUsage } from '@/lib/ai/quota';
import { aiStatus } from '@/lib/ai/status';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// Only the AI section for now; the rest of Settings comes with task 5.3.
export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  const t = await getTranslations('settings');
  const status = userId ? aiStatus(await loadUsage(createAdminClient(), userId)) : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Link href="/" className="text-sm underline underline-offset-4">
          {t('home')}
        </Link>
      </header>

      <nav className="flex gap-4 text-sm">
        <Link href="/rules" className="underline underline-offset-4">
          {t('rulesLink')}
        </Link>
        <Link href="/opponents" className="underline underline-offset-4">
          {t('opponentsLink')}
        </Link>
      </nav>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('aiTitle')}</h2>
        {status?.plan === 'free' && (
          <>
            <p>{t('planFree')}</p>
            <p>{t('remaining', { remaining: status.remaining ?? 0, limit: status.limit ?? 0 })}</p>
            <p>
              {t('summaryRemaining', {
                remaining: status.summaryRemaining ?? 0,
                limit: status.summaryLimit ?? 0,
              })}
            </p>
            {status.budgetLocked && (
              <p role="alert" className="text-sm text-loss">
                {t('budgetLocked')}
              </p>
            )}
          </>
        )}
        {status?.plan === 'byok' && (
          <>
            <p>{t('planByok')}</p>
            <p className="text-sm">{t('byokNote')}</p>
          </>
        )}
        <p className="text-sm">{t('keyHelp')}</p>
        <AiKeyForm hasKey={status?.plan === 'byok'} model={status?.model ?? null} />
      </section>
    </main>
  );
}

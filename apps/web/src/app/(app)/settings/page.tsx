import { getTranslations } from 'next-intl/server';
import { buttonClass } from '@/components/ui/button';
import { LocaleSwitcher } from '@/i18n/locale-switcher';
import { AiKeyForm } from '@/components/settings/ai-key-form';
import { InstallApp } from '@/components/pwa/install-hint';
import { loadUsage } from '@/lib/ai/quota';
import { aiStatus } from '@/lib/ai/status';
import { createAdminClient } from '@/lib/supabase/admin';
import { TopBar } from '@/components/ui/top-bar';
import { createClient } from '@/lib/supabase/server';

// Only the AI section for now; the rest of Settings comes with task 5.3.
export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  const [t, tCommon] = await Promise.all([getTranslations('settings'), getTranslations('common')]);
  const status = userId ? aiStatus(await loadUsage(createAdminClient(), userId)) : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <TopBar title={t('title')} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('languageTitle')}</h2>
        <LocaleSwitcher />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('installTitle')}</h2>
        <InstallApp />
      </section>

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
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('accountTitle')}</h2>
        <form action="/auth/signout" method="post">
          <button type="submit" className={buttonClass({ variant: 'secondary' })}>
            {tCommon('signOut')}
          </button>
        </form>
      </section>
    </main>
  );
}

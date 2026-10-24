import { getTranslations } from 'next-intl/server';
import { safeNextPath } from '@/lib/auth/next-path';
import { LocaleSwitcher } from '@/i18n/locale-switcher';
import { LoginForm } from './login-form';

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === 'string' ? params.next : null);
  const authFailed = params.error === 'auth';
  const t = await getTranslations();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 p-6">
      <div className="flex justify-end">
        <LocaleSwitcher />
      </div>
      <div className="space-y-1 text-center">
        <h1 className="text-3xl font-semibold">{t('common.appName')}</h1>
        <p className="text-sm text-muted">{t('common.tagline')}</p>
      </div>
      {authFailed && (
        <p role="alert" className="rounded-xl bg-loss/10 p-3 text-sm text-loss">
          {t('login.authFailed')}
        </p>
      )}
      <LoginForm next={next} />
    </main>
  );
}

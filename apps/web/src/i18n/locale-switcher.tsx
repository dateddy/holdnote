'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { setLocale } from './actions';
import { LOCALES, type AppLocale } from './locales';

/** Each language is shown in its own name, never translated. */
const NAMES: Record<AppLocale, string> = { vi: 'Tiếng Việt', en: 'English' };

export function LocaleSwitcher() {
  const t = useTranslations('common');
  const current = useLocale();
  const [pending, startTransition] = useTransition();

  return (
    <div role="group" aria-label={t('language')} className="flex gap-1 text-sm">
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={locale === current}
          disabled={pending}
          onClick={() => startTransition(() => setLocale(locale))}
          className="rounded-md px-2 py-1 aria-pressed:bg-foreground aria-pressed:text-background disabled:opacity-50"
        >
          {NAMES[locale]}
        </button>
      ))}
    </div>
  );
}

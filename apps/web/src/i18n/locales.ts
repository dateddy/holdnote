/** Locales with translations. The profile also allows 'zh', added once its messages exist. */
export const LOCALES = ['vi', 'en'] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'vi';

/** Cookie holding the choice made before sign-in (login screen) or by a signed-out visitor. */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export function isLocale(value: string | null | undefined): value is AppLocale {
  return (LOCALES as readonly string[]).includes(value ?? '');
}

/** Languages from an Accept-Language header, best first. */
function fromAcceptLanguage(header: string): string[] {
  return header
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      return {
        lang: tag.trim().toLowerCase().split('-')[0] ?? '',
        q: q ? Number(q.split('=')[1]) : 1,
      };
    })
    .filter((x) => x.lang && !Number.isNaN(x.q))
    .sort((a, b) => b.q - a.q)
    .map((x) => x.lang);
}

/** Profile first (spec: language follows the profile), then cookie, then browser, then Vietnamese. */
export function resolveLocale(sources: {
  profile?: string | null;
  cookie?: string | null;
  acceptLanguage?: string | null;
}): AppLocale {
  if (isLocale(sources.profile)) return sources.profile;
  if (isLocale(sources.cookie)) return sources.cookie;
  const browser = fromAcceptLanguage(sources.acceptLanguage ?? '').find(isLocale);
  return browser ?? DEFAULT_LOCALE;
}

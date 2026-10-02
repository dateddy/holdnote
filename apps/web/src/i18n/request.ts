import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { LOCALE_COOKIE, resolveLocale } from './locales';
import { getProfileLocale } from './profile-locale';

// No locale in the URL: the profile decides, then the cookie, then the browser.
export default getRequestConfig(async () => {
  const [cookieStore, headerList, profile] = await Promise.all([
    cookies(),
    headers(),
    getProfileLocale(),
  ]);
  const locale = resolveLocale({
    profile,
    cookie: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerList.get('accept-language'),
  });
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

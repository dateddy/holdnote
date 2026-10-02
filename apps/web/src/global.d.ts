import type messages from '../messages/vi.json';
import type { AppLocale } from './i18n/locales';

// Type-checked translation keys and locales for next-intl.
declare module 'next-intl' {
  interface AppConfig {
    Locale: AppLocale;
    Messages: typeof messages;
  }
}

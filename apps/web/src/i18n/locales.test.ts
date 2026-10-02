import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import vi from '../../messages/vi.json';
import { DEFAULT_LOCALE, isLocale, resolveLocale } from './locales';

describe('resolveLocale', () => {
  it('prefers the profile locale', () => {
    expect(resolveLocale({ profile: 'en', cookie: 'vi', acceptLanguage: 'vi' })).toBe('en');
  });

  it('falls back to the cookie, then Accept-Language', () => {
    expect(resolveLocale({ cookie: 'en', acceptLanguage: 'vi' })).toBe('en');
    expect(resolveLocale({ acceptLanguage: 'en-US,en;q=0.9' })).toBe('en');
  });

  it('honours Accept-Language quality order', () => {
    expect(resolveLocale({ acceptLanguage: 'fr;q=0.9, en;q=0.5, vi;q=0.8' })).toBe('vi');
    expect(resolveLocale({ acceptLanguage: 'de, fr' })).toBe(DEFAULT_LOCALE);
  });

  it('skips locales without translations yet (zh)', () => {
    expect(resolveLocale({ profile: 'zh', cookie: 'en' })).toBe('en');
    expect(resolveLocale({ profile: 'zh' })).toBe('vi');
  });

  it('defaults to Vietnamese', () => {
    expect(resolveLocale({})).toBe('vi');
    expect(resolveLocale({ cookie: 'garbage', acceptLanguage: '' })).toBe('vi');
  });
});

describe('isLocale', () => {
  it('accepts only supported locales', () => {
    expect(isLocale('vi')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('zh')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe('messages', () => {
  const keys = (obj: object, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
    );

  it('vi and en have the same keys', () => {
    expect(keys(en).sort()).toEqual(keys(vi).sort());
  });

  it('has no empty strings', () => {
    for (const [name, msgs] of Object.entries({ vi, en })) {
      const empty = keys(msgs).filter(
        (k) =>
          k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], msgs) === '',
      );
      expect(empty, name).toEqual([]);
    }
  });
});

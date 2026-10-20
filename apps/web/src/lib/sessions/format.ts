/** Money in a session's own unit, e.g. `18,000 VND`, `0.02 USD`, `500 chips`. */
export function formatMoney(amount: number, currency: string, locale: string): string {
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount);
  return currency === 'CHIP' ? n : `${n} ${currency}`;
}

/** 500000 -> "500k", 1500000 -> "1.5M": buy-ins and blinds in a row of text. */
export function compactAmount(n: number): string {
  const trim = (x: number) => String(Math.round(x * 100) / 100);
  if (Math.abs(n) >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (Math.abs(n) >= 1000) return `${trim(n / 1000)}k`;
  return trim(n);
}

/** 2.5 -> "2h30". Empty without hours. */
export function formatDuration(hours: number | null): string {
  if (hours == null) return '';
  const total = Math.round(hours * 60);
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, '0')}`;
}

/** `YYYY-MM-DD` as `14/10` or `14/10/2026`. */
export function formatDay(date: string, withYear: boolean): string {
  const [y = '1970', m = '01', d = '01'] = date.split('-');
  // Always day/month: the Vietnamese locale's own separator ("14-10") reads like a range.
  return withYear ? `${d}/${m}/${y}` : `${d}/${m}`;
}

/** `YYYY-MM` as a heading, e.g. "October 2026". */
export function formatMonth(month: string, locale: string): string {
  const [y, m] = month.split('-').map(Number);
  const text = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, 1)));
  // Vietnamese writes the month in lower case ("tháng 10 năm 2026"); a heading starts with a capital.
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

/** `+12.5`, `-3`, `0`. */
export function signedNumber(n: number, locale: string, digits = 2): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits,
    signDisplay: 'exceptZero',
  }).format(n);
}

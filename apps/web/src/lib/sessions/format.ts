/** Money in a session's own unit, e.g. `18,000 VND`, `0.02 USD`, `500 chips`. */
export function formatMoney(amount: number, currency: string, locale: string): string {
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount);
  return currency === 'CHIP' ? n : `${n} ${currency}`;
}

/**
 * Parse a money or chip amount as players type it: `600`, `1k5`, `2k`, `1.5k`, `0.06`, `0,25`, `18.000`.
 *
 * A dot or comma followed by exactly three digits, after a non-zero integer part, is a thousands
 * separator (`18.000` = 18000, `1,500` = 1500). Otherwise it is the decimal mark (`0.250`, `1.50`).
 */
export function parseAmount(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;

  const s = input.trim().toLowerCase().replace(/\s+/g, '');
  const m = /^([+-]?)(.+)$/.exec(s);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  const body = m[2] ?? '';

  const k = /^(\d+(?:[.,]\d+)?)k(\d*)$/.exec(body);
  if (k) {
    const base = Number((k[1] ?? '').replace(',', '.')) * 1000;
    const frac = k[2] ? Number(`0.${k[2]}`) * 1000 : 0;
    return sign * (base + frac);
  }

  const n = parsePlainNumber(body);
  return n == null ? null : sign * n;
}

function parsePlainNumber(body: string): number | null {
  if (!/^\d[\d.,]*$/.test(body)) return null;

  const lastDot = body.lastIndexOf('.');
  const lastComma = body.lastIndexOf(',');
  let normalized: string;

  if (lastDot >= 0 && lastComma >= 0) {
    // Both present: the later one is the decimal mark, the other groups thousands.
    const [group, decimal] = lastDot > lastComma ? [',', '.'] : ['.', ','];
    normalized = body.split(group).join('').replace(decimal, '.');
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',';
    const parts = body.split(sep);
    const head = parts[0] ?? '';
    const isThousands =
      /^[1-9]\d{0,2}$/.test(head) &&
      parts.length >= 2 &&
      parts.slice(1).every((p) => p.length === 3);
    if (isThousands) normalized = parts.join('');
    else if (parts.length === 2) normalized = parts.join('.');
    else return null;
  } else {
    normalized = body;
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

/** Round to 2 decimals, half away from zero, matching `numeric(14,2)`. */
export function roundMoney(n: number): number {
  const abs = Math.abs(n);
  if (abs < 1e-9) return 0;
  // Shift via the exponent so 1.005 rounds to 1.01 instead of 1.00.
  const rounded = Number(`${Math.round(Number(`${abs}e2`))}e-2`);
  return n < 0 ? -rounded : rounded;
}

/** Money to big blinds, rounded to 2 decimals for display. */
export function toBb(amount: number, bb: number): number {
  return roundMoney(amount / bb);
}

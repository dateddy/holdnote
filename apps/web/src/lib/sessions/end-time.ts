/** End time typed by the player when closing a session (the reminder for sessions left open). */
export function resolveEndAt(raw: string | null, startAt: string | null, now: string): string {
  if (!raw) return now;
  const t = Date.parse(raw);
  if (!Number.isFinite(t) || t > Date.parse(now)) return now;
  if (startAt && t < Date.parse(startAt)) return now;
  return new Date(t).toISOString();
}

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO time → value of `<input type="datetime-local">` (local time, minute precision). */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Value of `<input type="datetime-local">` → ISO time; null when empty or invalid. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Any date string → ISO time; null when empty or invalid. */
export function fromIso(raw: string): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

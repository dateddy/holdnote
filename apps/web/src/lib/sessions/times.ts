const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` of a moment in the browser's time zone. */
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `HH:mm` of a moment in the browser's time zone. */
export function localTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local `YYYY-MM-DD` + `HH:mm` to a Date; null when either is empty or invalid. */
function at(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const d = new Date(`${date}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The date and the two times of the session form as ISO moments (browser time zone). An end time
 * earlier than the start time is after midnight, so it falls on the next day. Empty = null.
 */
export function composeTimes(
  date: string,
  startTime: string,
  endTime: string,
): { startAt: string | null; endAt: string | null } {
  const start = at(date, startTime);
  let end = at(date, endTime);
  if (start && end && end.getTime() < start.getTime()) {
    end = new Date(end.getTime());
    end.setDate(end.getDate() + 1);
  }
  return { startAt: start?.toISOString() ?? null, endAt: end?.toISOString() ?? null };
}

/**
 * What the server does with the two moments the form sent: both optional, an unreadable or
 * not-after-start end is an error. A missing start on a new session is "now".
 */
export function resolveTimes(
  startRaw: string,
  endRaw: string,
  now: string,
  { startRequired }: { startRequired: boolean },
): { startAt: string | null; endAt: string | null; error: boolean } {
  const iso = (raw: string) => {
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  };
  const start = iso(startRaw);
  const end = iso(endRaw);
  if (start === undefined || end === undefined) return { startAt: null, endAt: null, error: true };
  const startAt = start ?? (startRequired ? now : null);
  if (startAt && end && Date.parse(end) <= Date.parse(startAt)) {
    return { startAt, endAt: null, error: true };
  }
  return { startAt, endAt: end, error: false };
}

/**
 * What the edit form shows for a saved session: the date, start time and end time on the
 * browser's clock. The date is the local day of the start when there is one, so saving without
 * touching anything gives the same moments back. Nothing here reads the current time.
 */
export function editTimesFrom(row: {
  date: string;
  start_at: string | null;
  end_at: string | null;
}): { date: string; startTime: string; endTime: string } {
  const clock = (iso: string | null) => {
    const d = iso ? new Date(iso) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  };
  const start = clock(row.start_at);
  const end = clock(row.end_at);
  return {
    date: start ? localDate(start) : row.date,
    startTime: start ? localTime(start) : '',
    endTime: end ? localTime(end) : '',
  };
}

import { bbPerHour, sessionResult, stopLossBreached, type StatsSession } from 'poker-core';
import { languagePack } from './languages';

/** One reviewed hand, as the summary sees it. */
export type SummaryReviewLine = {
  num: number;
  verdict: string | null;
  tags: string[];
  lesson: string | null;
};

export type SummaryInput = {
  session: StatsSession;
  handCount: number;
  reviews: SummaryReviewLine[];
  locale: string;
};

const MAX_REVIEWS = 40;
const LESSON_MAX = 160;

const num = (n: number) => String(Math.round(n * 100) / 100);

function sessionLines(s: StatsSession, handCount: number, reviewed: number): string[] {
  const result = sessionResult(s);
  const lines = [
    s.kind === 'cash'
      ? `Game: cash, ${s.mode}, stake ${s.stakeLabel ?? 'unknown'}`
      : `Game: tournament (MTT), ${s.mode}`,
  ];

  if (s.kind === 'cash') {
    lines.push(
      result?.bb != null
        ? `Result: ${num(result.bb)} bb (${num(result.money)} ${s.currency})`
        : 'Result: not entered yet',
    );
    const rate = bbPerHour(s);
    if (rate != null) lines.push(`Rate: ${num(rate)} bb per hour`);
    if (s.stopLoss != null) {
      lines.push(
        `Stop-loss: ${num(s.stopLoss)} ${s.currency}; broken: ${stopLossBreached(s) ? 'yes' : 'no'}`,
      );
    }
  } else {
    const m = s.mtt;
    const cost = (s.buyin ?? 0) * (1 + (m?.reentries ?? 0));
    lines.push(
      `Buy-in: ${num(s.buyin ?? 0)} ${s.currency}, entries used: ${1 + (m?.reentries ?? 0)} (total ${num(cost)})`,
    );
    lines.push(
      result
        ? `Result: ${num(result.money)} ${s.currency} (prize ${num(m?.prize ?? 0)}, bounty ${num(m?.bounty ?? 0)})`
        : 'Result: not entered yet',
    );
    if (m?.place != null)
      lines.push(`Finished: ${m.place}${m.entries != null ? ` of ${m.entries}` : ''}`);
    if (m?.bustStage) lines.push(`Knocked out in stage: ${m.bustStage}`);
  }

  lines.push(`Hands recorded: ${handCount}; reviewed: ${reviewed}`);
  lines.push(`Self-reported state: ${s.selfState ?? 'not given'}`);
  return lines;
}

/**
 * The user message for the session summary. Language pack first and last (as in the hand review),
 * facts in between. Pure: everything comes in as arguments.
 */
export function buildSummaryContext(input: SummaryInput): string {
  const pack = languagePack(input.locale);
  const shown = input.reviews.slice(0, MAX_REVIEWS);

  const counts = new Map<string, number>();
  for (const r of input.reviews) {
    for (const t of r.tags) if (t !== 'none') counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const tagLine = [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${t} x${n}`)
    .join(', ');

  return [
    pack.instruction,
    // The instruction above was written for hand reviews and names a "lesson" field.
    'This task has no "lesson" field: apply the same language rules to "good", "leaks[].note" and "rules".',
    '',
    'SESSION',
    ...sessionLines(input.session, input.handCount, input.reviews.length).map((l) => `- ${l}`),
    '',
    'HAND REVIEWS',
    ...(shown.length
      ? shown.map(
          (r) =>
            `#${r.num} | ${r.verdict ?? 'no verdict'} | ${r.tags.join(', ') || 'no tags'}${r.lesson ? ` | ${r.lesson.replace(/\s+/g, ' ').slice(0, LESSON_MAX)}` : ''}`,
        )
      : ['(none)']),
    ...(input.reviews.length > shown.length
      ? [`(${input.reviews.length - shown.length} more not shown)`]
      : []),
    '',
    `TAG COUNTS: ${tagLine || 'none'}`,
    '',
    pack.reminder,
  ].join('\n');
}

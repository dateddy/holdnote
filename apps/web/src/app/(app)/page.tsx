import { redirect } from 'next/navigation';
import { InstallHint } from '@/components/pwa/install-hint';
import { SessionList } from '@/components/session/session-list';
import { buildListItems, parseListFilter, staleItems } from '@/lib/sessions/list';
import { STATS_COLUMNS } from '@/lib/sessions/summary';
import { createClient } from '@/lib/supabase/server';

const PAGE = 1000;

/** Reads every row of a query; one request returns at most 1000. */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

/** Home (spec 3.3): the session list with filters, totals and, on desktop, a sortable table. */
export default async function Home({ searchParams }: PageProps<'/'>) {
  const supabase = await createClient();

  const [{ data: profile }, sessions, hands, reviews] = await Promise.all([
    supabase.from('profiles').select('onboarded_at').single(),
    fetchAll((from, to) =>
      supabase
        .from('sessions')
        .select(`${STATS_COLUMNS}, summary`)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from('hands')
        .select('id, session_id, result, level_bb, flagged, created_at')
        .order('id')
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from('reviews')
        .select('hand_id')
        .eq('is_current', true)
        .eq('accepted', true)
        .order('id')
        .range(from, to),
    ),
  ]);

  // New accounts go through onboarding once; finishing or skipping sets onboarded_at (spec 3.2).
  if (profile && !profile.onboarded_at) redirect('/onboarding');

  const items = buildListItems(sessions, hands, new Set(reviews.map((r) => r.hand_id)));

  return (
    <>
      <SessionList
        items={items}
        initialFilter={parseListFilter(await searchParams)}
        stale={staleItems(items, new Date().toISOString())}
      />
      <div className="mx-auto w-full max-w-md px-6 pb-6">
        <InstallHint />
      </div>
    </>
  );
}

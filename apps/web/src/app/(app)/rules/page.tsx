import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { RULE_MAX } from '@/lib/rules/rules';
import { TopBar } from '@/components/ui/top-bar';
import { createClient } from '@/lib/supabase/server';
import { addRule, deleteRule, moveRule, setRuleActive, updateRule } from './actions';

const SMALL = 'h-9 rounded-md border border-line bg-surface px-2 text-sm disabled:opacity-30';

/** "Your rules" (spec 3.3, 3.11): shown before every session while active. */
export default async function RulesPage() {
  const supabase = await createClient();
  const { data: rules } = await supabase
    .from('user_rules')
    .select('id, text, active, source_session_id')
    .order('sort')
    .order('id');
  const t = await getTranslations('rules');
  const list = rules ?? [];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-6">
      <TopBar title={t('title')} back={{ href: '/', label: t('home') }} />
      <p className="text-sm text-muted">{t('intro')}</p>

      <form action={addRule} className="flex gap-2">
        <input
          name="text"
          required
          maxLength={RULE_MAX}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          className="h-12 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-base"
        />
        <button
          type="submit"
          className="h-12 rounded-md bg-accent px-4 font-medium text-accent-foreground"
        >
          {t('add')}
        </button>
      </form>

      {list.length === 0 ? (
        <p className="text-sm text-muted">{t('none')}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {list.map((r, i) => (
            <li
              key={r.id}
              className={`space-y-2 rounded-md border border-line bg-surface p-3 ${r.active ? '' : 'text-muted'}`}
            >
              <form action={updateRule.bind(null, r.id)} className="flex gap-2">
                <input
                  name="text"
                  defaultValue={r.text}
                  required
                  maxLength={RULE_MAX}
                  aria-label={t('ruleN', { n: i + 1 })}
                  className="h-10 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-base"
                />
                <button type="submit" className={SMALL}>
                  {t('save')}
                </button>
              </form>
              <div className="flex flex-wrap items-center gap-1.5">
                <form action={setRuleActive.bind(null, r.id, !r.active)}>
                  <button type="submit" aria-pressed={r.active} className={SMALL}>
                    {r.active ? t('turnOff') : t('turnOn')}
                  </button>
                </form>
                <form action={moveRule.bind(null, r.id, -1)}>
                  <button type="submit" disabled={i === 0} aria-label={t('up')} className={SMALL}>
                    ↑
                  </button>
                </form>
                <form action={moveRule.bind(null, r.id, 1)}>
                  <button
                    type="submit"
                    disabled={i === list.length - 1}
                    aria-label={t('down')}
                    className={SMALL}
                  >
                    ↓
                  </button>
                </form>
                <form action={deleteRule.bind(null, r.id)} className="ml-auto">
                  <button type="submit" className={`${SMALL} text-loss`}>
                    {t('delete')}
                  </button>
                </form>
              </div>
              {r.source_session_id && (
                <Link
                  href={`/sessions/${r.source_session_id}/summary`}
                  className="text-xs underline underline-offset-4 text-muted"
                >
                  {t('fromSession')}
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

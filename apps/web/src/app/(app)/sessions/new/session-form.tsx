'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useActionState, useState, useSyncExternalStore, type ReactNode } from 'react';
import { blindLevelsToJson, readBlindLevels, type BlindLevel } from 'poker-core';
import { BlindStructureEditor } from '@/components/session/blind-structure-editor';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ChipMenu } from '@/components/ui/chip-menu';
import { EntryLayout } from '@/components/ui/entry-layout';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Stepper } from '@/components/ui/stepper';
import { StickyBar, StickyBarSpacer } from '@/components/ui/sticky-bar';
import { Toggle } from '@/components/ui/toggle';
import {
  ANTE_MODES,
  CHIP_RATE_CURRENCIES,
  defaultUnit,
  KINDS,
  MODES,
  MTT_TYPES,
  sessionSummaryLine,
  type SessionField,
  type SessionFormValues,
} from '@/lib/sessions/form';
import { formatMoney } from '@/lib/sessions/format';
import { composeTimes, editTimesFrom, localDate, localTime } from '@/lib/sessions/times';
import { createSession, updateSession, type CreateSessionState } from '../actions';

const noSubscription = () => () => {};

/** Edit mode: the same form on a saved session; the kind is fixed. */
export type SessionEdit = { sessionId: string; startAt: string | null; endAt: string | null };

type Props = {
  initial: SessionFormValues;
  edit?: SessionEdit;
  /** Currency of the profile: what a session in money starts with, and the chip rate's currency. */
  profileCurrency: string;
};

export function SessionForm({ initial, edit, profileCurrency }: Props) {
  const t = useTranslations('sessions');
  const tb = useTranslations('blinds');
  const locale = useLocale();
  const router = useRouter();
  const [state, action, pending] = useActionState<CreateSessionState, FormData>(
    edit ? updateSession.bind(null, edit.sessionId) : createSession,
    { values: initial, errors: {}, failed: false },
  );

  const rateFallback = CHIP_RATE_CURRENCIES.find((c) => c === profileCurrency) ?? 'VND';
  // Dates and times are read on the player's clock, and only the browser knows it (the server
  // may be in another time zone). So the three fields stay empty until the page is in the browser,
  // for a new session (today, now) and for a saved one (what was saved) alike.
  const inBrowser = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const [saved] = useState(() =>
    edit ? editTimesFrom({ date: initial.date, start_at: edit.startAt, end_at: edit.endAt }) : null,
  );
  const [now] = useState(() => (edit || typeof window === 'undefined' ? null : new Date()));
  const [v, setV] = useState<SessionFormValues>(() => ({
    ...initial,
    date: saved?.date ?? (initial.date || (now ? localDate(now) : '')),
    chipCurrency: initial.chipCurrency || rateFallback,
  }));
  const set = (patch: Partial<SessionFormValues>) => setV((x) => ({ ...x, ...patch }));
  // Times of the day, in the browser's time zone; the date is `v.date`.
  const [startTime, setStartTime] = useState(() => saved?.startTime ?? (now ? localTime(now) : ''));
  const [endTime, setEndTime] = useState(() => saved?.endTime ?? '');
  // The unit follows Live / Online until the player picks one.
  const [unitPicked, setUnitPicked] = useState(Boolean(edit));

  const isMtt = v.kind === 'mtt';
  // Optional blind structure (MTT): sent as JSON, checked again by the server.
  const [levels, setLevels] = useState<BlindLevel[]>(() => {
    try {
      return readBlindLevels(JSON.parse(v.mttBlindLevels || '[]'));
    } catch {
      return [];
    }
  });
  // Players dealt in at the table, 2-10 (5.1c-5); each hand starts from it and then remembers its own.
  const seats = (() => {
    const n = Number(v.seats);
    return Number.isInteger(n) && n >= 2 && n <= 10 ? n : 9;
  })();
  const fromStructure = isMtt && levels.length > 0;
  const times = composeTimes(v.date, startTime, endTime);

  const err = (field: SessionField) => {
    const code = state.errors[field];
    return code ? t(`errors.${code}`) : null;
  };

  const text = (field: SessionField, label: string, numeric = false) => (
    <Field label={label} error={err(field)}>
      <Input
        value={v[field]}
        onChange={(e) => set({ [field]: e.target.value })}
        inputMode={numeric ? 'decimal' : undefined}
        autoComplete="off"
        aria-invalid={state.errors[field] ? true : undefined}
      />
    </Field>
  );

  const pickMode = (mode: string) => {
    set({
      mode,
      ...(!unitPicked && { currency: defaultUnit(v.kind, mode, profileCurrency) }),
    });
  };

  const summary = sessionSummaryLine(v, {
    kind: { cash: t('cash'), mtt: t('mtt') },
    mode: { live: t('live'), online: t('online') },
    chip: t('unitChip'),
    straddle: t('summaryStraddle'),
    ante: t('summaryAnte'),
    chipRate: (value) => t('summaryChipRate', { value }),
    formatMoney: (amount, currency) => formatMoney(amount, currency, locale),
  });

  const aside = (
    <>
      <div className="space-y-1 lg:rounded-xl lg:border lg:border-line lg:bg-surface lg:p-4">
        <p className="hidden text-xs font-medium tracking-[0.06em] text-muted uppercase lg:block">
          {t('summaryTitle')}
        </p>
        <p className="text-sm text-muted lg:text-base lg:text-foreground" aria-live="polite">
          {summary}
        </p>
      </div>
      {state.failed && (
        <p role="alert" className="text-center text-sm text-loss">
          {t('saveFailed')}
        </p>
      )}
      <StickyBarSpacer className="lg:hidden" />
      <StickyBar className="lg:static lg:border-0 lg:bg-transparent lg:pb-0">
        <div className="mx-auto w-full max-w-md p-3 lg:max-w-none lg:p-0">
          <Button type="submit" size="lg" disabled={pending}>
            {edit ? (pending ? t('saving') : t('save')) : pending ? t('creating') : t('create')}
          </Button>
        </div>
      </StickyBar>
    </>
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      {(
        [
          'kind',
          'mode',
          'currency',
          'chipValue',
          'chipCurrency',
          'venue',
          'date',
          'sb',
          'bb',
          'straddle',
          'anteMode',
          'ante',
          'buyin',
          'stopLoss',
          'mttName',
          'mttType',
          'mttReentry',
          'mttStartLevel',
          'mttStartStack',
        ] as const
      ).map((field) => (
        <input key={field} type="hidden" name={field} value={v[field]} suppressHydrationWarning />
      ))}
      <input type="hidden" name="seats" value={seats} />
      <input
        type="hidden"
        name="mttBlindLevels"
        value={JSON.stringify(blindLevelsToJson(levels))}
      />
      <input type="hidden" name="start_at" value={times.startAt ?? ''} suppressHydrationWarning />
      <input type="hidden" name="end_at" value={times.endAt ?? ''} suppressHydrationWarning />

      <EntryLayout aside={aside}>
        <div className="flex flex-col gap-6 lg:gap-3 xl:grid xl:grid-cols-2 xl:items-start">
          <div className="contents xl:flex xl:flex-col xl:gap-3">
            <Group title={t('groupKind')}>
              {edit ? (
                <p className="text-sm text-muted">
                  {t('kindLocked', { kind: v.kind === 'mtt' ? t('mtt') : t('cash') })}
                </p>
              ) : (
                <Segmented
                  label={t('kind')}
                  value={v.kind}
                  options={KINDS.map((k) => ({ value: k, label: t(k) }))}
                  onChange={(k) => router.replace(`/sessions/new?kind=${k}`)}
                />
              )}
              <Segmented
                label={t('mode')}
                value={v.mode}
                options={MODES.map((m) => ({ value: m, label: t(m) }))}
                onChange={pickMode}
              />
            </Group>

            <Group title={t('groupPlace')}>
              {text('venue', t('venue'))}
              <div className="flex flex-col gap-3 xl:grid xl:grid-cols-3 xl:items-start">
                <Field label={t('dateField')} error={err('date')}>
                  <Input
                    type="date"
                    value={inBrowser ? v.date : ''}
                    onChange={(e) => set({ date: e.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3 xl:col-span-2">
                  <Field label={t('startTime')}>
                    <Input
                      type="time"
                      value={inBrowser ? startTime : ''}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </Field>
                  <Field label={t('endTime')} hint={t('endTimeHint')}>
                    <Input
                      type="time"
                      value={inBrowser ? endTime : ''}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </Field>
                </div>
              </div>
              {state.timeError && (
                <p role="alert" className="text-sm text-loss">
                  {t('timeError')}
                </p>
              )}
            </Group>
          </div>
          <div className="contents xl:flex xl:flex-col xl:gap-3">
            <Group title={t('groupUnit')}>
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-48 flex-1">
                  <Segmented
                    label={t('currency')}
                    value={v.currency === 'CHIP' ? 'chip' : 'money'}
                    options={[
                      { value: 'chip', label: t('unitChip') },
                      { value: 'money', label: t('unitMoney') },
                    ]}
                    onChange={(u) => {
                      setUnitPicked(true);
                      set({
                        currency:
                          u === 'chip' ? 'CHIP' : defaultUnit('mtt', 'online', profileCurrency),
                      });
                    }}
                  />
                </div>
                {v.currency !== 'CHIP' && (
                  <ChipMenu
                    label={t('unitMoney')}
                    value={v.currency}
                    options={CHIP_RATE_CURRENCIES.map((c) => ({ value: c, label: c }))}
                    onChange={(c) => {
                      setUnitPicked(true);
                      set({ currency: c });
                    }}
                  />
                )}
              </div>
              {v.currency === 'CHIP' && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm whitespace-nowrap">{t('chipRateLead')}</span>
                    <Input
                      aria-label={t('chipRateLabel')}
                      value={v.chipValue}
                      onChange={(e) => set({ chipValue: e.target.value })}
                      inputMode="decimal"
                      autoComplete="off"
                      aria-invalid={state.errors.chipValue ? true : undefined}
                    />
                    <ChipMenu
                      label={t('chipRateCurrency')}
                      value={v.chipCurrency}
                      options={CHIP_RATE_CURRENCIES.map((c) => ({ value: c, label: c }))}
                      onChange={(c) => set({ chipCurrency: c })}
                    />
                  </div>
                  <p className="text-xs text-muted">{t('chipRateHint')}</p>
                  {err('chipValue') && (
                    <p role="alert" className="text-sm text-loss">
                      {err('chipValue')}
                    </p>
                  )}
                </div>
              )}

              {fromStructure ? (
                <p className="text-sm text-muted">{tb('fromStart')}</p>
              ) : (
                <>
                  {isMtt && <p className="text-base font-medium">{t('mttBlinds')}</p>}
                  <div className={`grid grid-cols-2 gap-3 ${isMtt ? '' : 'xl:grid-cols-3'}`}>
                    {text('sb', t('sb'), true)}
                    {text('bb', t('bb'), true)}
                    {!isMtt && (
                      <div className="col-span-2 xl:col-span-1">
                        {text('straddle', t('straddle'), true)}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm">{t('ante')}</p>
                    <div className="flex flex-wrap gap-2" role="group" aria-label={t('ante')}>
                      {ANTE_MODES.map((m) => (
                        <Chip key={m} on={v.anteMode === m} onClick={() => set({ anteMode: m })}>
                          {t(m === 'none' ? 'anteNone' : m === 'each' ? 'anteEach' : 'anteBb')}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  {v.anteMode !== 'none' && text('ante', t('anteAmount'), true)}
                </>
              )}
            </Group>

            <Group title={t('groupOther')}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>{t('seats')}</span>
                <Stepper
                  value={seats}
                  min={2}
                  max={10}
                  onChange={(n) => set({ seats: String(n) })}
                  text={t('seatsCount', { n: seats })}
                  minusLabel={t('seatsLess')}
                  plusLabel={t('seatsMore')}
                />
              </div>
              {text('buyin', t('buyin'), true)}
              {!isMtt && text('stopLoss', t('stopLoss'), true)}
              {isMtt && (
                <>
                  {text('mttName', t('mttName'))}
                  <div className="space-y-1">
                    <p className="text-sm">{t('mttType')}</p>
                    <div className="flex flex-wrap gap-2" role="group" aria-label={t('mttType')}>
                      {MTT_TYPES.map((m) => (
                        <Chip key={m} on={v.mttType === m} onClick={() => set({ mttType: m })}>
                          {t(`type_${m}`)}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>{t('mttReentry')}</span>
                    <Toggle
                      checked={v.mttReentry === 'on'}
                      aria-label={t('mttReentry')}
                      onClick={() => set({ mttReentry: v.mttReentry === 'on' ? '' : 'on' })}
                    />
                  </div>
                  {text('mttStartLevel', t('mttStartLevel'), true)}
                  {text('mttStartStack', t('mttStartStack'), true)}
                  <div className="space-y-2">
                    <p className="text-xs text-muted">
                      {tb('optional')}. {tb('hint')}
                    </p>
                    <BlindStructureEditor
                      value={levels}
                      onChange={setLevels}
                      defaultAnteMode={
                        v.anteMode === 'each' || v.anteMode === 'bb' ? v.anteMode : 'none'
                      }
                    />
                    {err('mttBlindLevels') && (
                      <p role="alert" className="text-sm text-loss">
                        {err('mttBlindLevels')}
                      </p>
                    )}
                  </div>
                </>
              )}
            </Group>
          </div>
        </div>
      </EntryLayout>
    </form>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <h2 className="text-base font-medium">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </Card>
  );
}

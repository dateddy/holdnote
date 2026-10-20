'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import {
  ANTE_MODES,
  CURRENCIES,
  MODES,
  MTT_TYPES,
  type SessionField,
  type SessionFormValues,
} from '@/lib/sessions/form';
import { createSession, type CreateSessionState } from '../actions';

import { INPUT_CLASS as INPUT } from '@/components/ui/input';
import { Stepper } from '@/components/ui/stepper';

export function SessionForm({ initial }: { initial: SessionFormValues }) {
  const t = useTranslations('sessions');
  const [state, action, pending] = useActionState<CreateSessionState, FormData>(createSession, {
    values: initial,
    errors: {},
    failed: false,
  });
  const v = state.values;
  const [anteMode, setAnteMode] = useState(v.anteMode);
  const isMtt = v.kind === 'mtt';
  // Players dealt in at the table, 2-10 (5.1c-5); each hand starts from it and then remembers its own.
  const [seats, setSeats] = useState(() => {
    const n = Number(v.seats);
    return Number.isInteger(n) && n >= 2 && n <= 10 ? n : 9;
  });

  const error = (field: SessionField) => {
    const code = state.errors[field];
    return code ? (
      <span role="alert" className="text-sm text-loss">
        {t(`errors.${code}`)}
      </span>
    ) : null;
  };

  const text = (field: SessionField, label: string, props: { numeric?: boolean } = {}) => (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        name={field}
        defaultValue={v[field]}
        inputMode={props.numeric ? 'decimal' : undefined}
        autoComplete="off"
        aria-invalid={state.errors[field] ? true : undefined}
        className={INPUT}
      />
      {error(field)}
    </label>
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="kind" value={v.kind} />
      {/* The browser knows the player's local date; the server only knows UTC. */}
      <input type="hidden" name="date" value={v.date || localDate()} suppressHydrationWarning />

      <Segment legend={t('kind')}>
        {(['cash', 'mtt'] as const).map((k) => (
          <Link
            key={k}
            href={`/sessions/new?kind=${k}`}
            replace
            aria-current={v.kind === k ? 'true' : undefined}
            className={chip(v.kind === k)}
          >
            {t(k)}
          </Link>
        ))}
      </Segment>

      <Radios name="mode" legend={t('mode')} options={MODES} current={v.mode} label={(m) => t(m)} />

      <Radios
        name="currency"
        legend={t('currency')}
        options={CURRENCIES}
        current={v.currency}
        label={(c) => c}
      />

      {text('venue', t('venue'))}

      {isMtt && (
        <>
          {text('mttName', t('mttName'))}
          <Radios
            name="mttType"
            legend={t('mttType')}
            options={MTT_TYPES}
            current={v.mttType}
            label={(m) => t(`type_${m}`)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="mttReentry" defaultChecked={v.mttReentry === 'on'} />
            {t('mttReentry')}
          </label>
          {text('mttStartLevel', t('mttStartLevel'), { numeric: true })}
          {text('mttStartStack', t('mttStartStack'), { numeric: true })}
        </>
      )}

      <fieldset className="flex flex-col gap-3">
        {isMtt && <legend className="mb-2 text-sm">{t('mttBlinds')}</legend>}
        <div className="grid grid-cols-2 gap-3">
          {text('sb', t('sb'), { numeric: true })}
          {text('bb', t('bb'), { numeric: true })}
        </div>
        {!isMtt && text('straddle', t('straddle'), { numeric: true })}
      </fieldset>

      <Segment legend={t('ante')}>
        {ANTE_MODES.map((m) => (
          <label key={m} className={chip(anteMode === m)}>
            <input
              type="radio"
              name="anteMode"
              value={m}
              checked={anteMode === m}
              onChange={() => setAnteMode(m)}
              className="sr-only"
            />
            {t(m === 'none' ? 'anteNone' : m === 'each' ? 'anteEach' : 'anteBb')}
          </label>
        ))}
      </Segment>
      {anteMode !== 'none' && text('ante', t('anteAmount'), { numeric: true })}

      <div className="flex items-center justify-between gap-3 text-sm">
        <span>{t('seats')}</span>
        <input type="hidden" name="seats" value={seats} />
        <Stepper
          value={seats}
          min={2}
          max={10}
          onChange={setSeats}
          text={t('seatsCount', { n: seats })}
          minusLabel={t('seatsLess')}
          plusLabel={t('seatsMore')}
        />
      </div>
      {text('buyin', t('buyin'), { numeric: true })}
      {!isMtt && text('stopLoss', t('stopLoss'), { numeric: true })}

      {state.failed && (
        <p role="alert" className="text-center text-sm text-loss">
          {t('saveFailed')}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-14 rounded-md bg-accent text-lg font-medium text-accent-foreground disabled:opacity-50"
      >
        {pending ? t('creating') : t('create')}
      </button>
    </form>
  );
}

const chip = (active: boolean) =>
  `flex h-11 flex-1 cursor-pointer items-center justify-center rounded-md border px-3 text-sm ${
    active ? 'border-accent bg-accent text-accent-foreground' : 'border-line bg-surface'
  } has-[:focus-visible]:outline-2`;

function Segment({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm">{legend}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Radios<T extends string>({
  name,
  legend,
  options,
  current,
  label,
}: {
  name: string;
  legend: string;
  options: readonly T[];
  current: string;
  label: (option: T) => string;
}) {
  const [value, setValue] = useState(current);
  return (
    <Segment legend={legend}>
      {options.map((o) => (
        <label key={o} className={chip(value === o)}>
          <input
            type="radio"
            name={name}
            value={o}
            checked={value === o}
            onChange={() => setValue(o)}
            className="sr-only"
          />
          {label(o)}
        </label>
      ))}
    </Segment>
  );
}

/** `YYYY-MM-DD` in the browser's time zone. */
function localDate() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

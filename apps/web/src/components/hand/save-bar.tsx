'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { StickyBar, StickyBarSpacer } from '@/components/ui/sticky-bar';

type Props = {
  /** Pot and hero stack, already formatted as "5.000 (100bb)". Null = unknown. */
  pot: string | null;
  stack: string | null;
  label: string;
  disabled: boolean;
  hint?: string;
  onSave: () => void;
  /** Stuck to the bottom of the screen (Ghi nhanh) or inline (edit form on the hand screen). */
  sticky: boolean;
};

/** The one save bar of the screen: pot and stack on the left, the save button on the right. */
export function SaveBar({ pot, stack, label, disabled, hint, onSave, sticky }: Props) {
  const t = useTranslations('record');
  const inner = (
    <div className="mx-auto flex max-w-md items-center gap-3 p-3">
      <dl className="min-w-0 flex-1 text-sm tabular-nums">
        <div className="flex gap-1">
          <dt className="text-muted">{t('potShort')}</dt>
          <dd className="truncate font-medium">{pot ?? '–'}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-muted">{t('stackShort')}</dt>
          <dd className="truncate font-medium">{stack ?? '–'}</dd>
        </div>
      </dl>
      <Button size="lg" full={false} className="min-w-32" disabled={disabled} onClick={onSave}>
        {label}
      </Button>
    </div>
  );
  if (!sticky) {
    return (
      <div className="space-y-1">
        {inner}
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
    );
  }
  return (
    <>
      <StickyBarSpacer />
      <StickyBar>
        {hint && <p className="px-3 pt-2 text-xs text-muted">{hint}</p>}
        {inner}
      </StickyBar>
    </>
  );
}

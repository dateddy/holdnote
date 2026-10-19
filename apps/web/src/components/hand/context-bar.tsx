'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

type Props = {
  num: number;
  /** "MP Mình · LJ Đối thủ · 18.000", already put together. */
  summary: string;
  onEditSetup: () => void;
};

/** One line under the title: which hand, who sits where, and the way back to the setup. */
export function ContextBar({ num, summary, onEditSetup }: Props) {
  const t = useTranslations('hand');
  const tr = useTranslations('record');
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-line pb-1">
      <p className="min-w-0 text-sm tabular-nums">
        <span className="font-medium">{t('title', { num })}</span>
        <span className="text-muted"> · {summary}</span>
      </p>
      <Button variant="ghost" full={false} className="shrink-0 text-sm" onClick={onEditSetup}>
        {tr('editSetup')}
      </Button>
    </div>
  );
}

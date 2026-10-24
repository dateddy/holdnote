'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { blindLevelsToJson, type BlindLevel, type LevelAnteMode } from 'poker-core';
import { Button } from '@/components/ui/button';
import { saveBlindStructure } from '@/app/(app)/sessions/actions';
import { BlindStructureEditor } from './blind-structure-editor';

/** Edit the blind structure of a running or finished MTT session. */
export function StructureForm({
  sessionId,
  initial,
  defaultAnteMode,
}: {
  sessionId: string;
  initial: BlindLevel[];
  defaultAnteMode: LevelAnteMode;
}) {
  const t = useTranslations('blinds');
  const [levels, setLevels] = useState(initial);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<'idle' | 'saved' | 'failed'>('idle');

  function save() {
    start(async () => {
      const r = await saveBlindStructure(sessionId, blindLevelsToJson(levels));
      setStatus(r.ok ? 'saved' : 'failed');
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <BlindStructureEditor
        value={levels}
        onChange={(next) => {
          setLevels(next);
          setStatus('idle');
        }}
        defaultAnteMode={defaultAnteMode}
      />
      {status === 'saved' && (
        <p role="status" className="rounded-xl bg-accent/15 p-3 text-sm">
          {t('saved')}
        </p>
      )}
      {status === 'failed' && (
        <p role="alert" className="text-center text-sm text-loss">
          {t('saveFailed')}
        </p>
      )}
      <Button size="lg" disabled={pending} onClick={save}>
        {pending ? t('saving') : t('save')}
      </Button>
    </div>
  );
}

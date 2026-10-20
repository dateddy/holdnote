'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { PosTag } from '@/components/ui/pos-tag';
import type { DraftOpponent } from '@/lib/hands/build';
import { hasName, matchNames } from '@/lib/hands/labels';
import type { OpponentOption } from '@/lib/hands/table';

type Props = {
  opponent: DraftOpponent;
  /** Everyone saved, same venue first. */
  options: OpponentOption[];
  onStack: (stack: string) => void;
  /** Empty id = detach. */
  onName: (id: string) => void;
  /** Make a new opponent of this venue and attach him to the seat; absent = cannot create (practice). */
  onCreate?: (name: string) => void;
};

/** Matches shown under the box; typing narrows them. */
const SHOWN = 5;

/** One picked opponent under the mini table: seat, stack, and a box that names him. */
export function OpponentRow({ opponent, options, onStack, onName, onCreate }: Props) {
  const t = useTranslations('record');
  const named = options.find((o) => o.id === opponent.opponentId);
  const [typed, setTyped] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const text = typed ?? named?.name ?? '';
  const query = typed ?? '';
  const matches = matchNames(options, query).slice(0, SHOWN);
  const canCreate = Boolean(onCreate) && query.trim() !== '' && !hasName(options, query);

  const done = () => {
    setTyped(null);
    setOpen(false);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <PosTag tone="villain" className="h-11 min-w-12 justify-center text-sm">
          {opponent.pos}
        </PosTag>
        <Input
          inputMode="decimal"
          autoComplete="off"
          aria-label={`${t('stackVillain')} ${opponent.pos}`}
          placeholder={t('stackVillain')}
          value={opponent.stack}
          onChange={(e) => onStack(e.target.value)}
        />
      </div>
      <Input
        autoComplete="off"
        aria-label={`${t('nameField')} ${opponent.pos}`}
        placeholder={t('namePlaceholder')}
        value={text}
        onFocus={() => setOpen(true)}
        // A tap on a suggestion lands after the blur: give it a moment before closing.
        onBlur={() => setTimeout(done, 150)}
        onChange={(e) => {
          setTyped(e.target.value);
          setOpen(true);
          if (named) onName('');
        }}
      />
      {open && (matches.length > 0 || canCreate) && (
        <div className="flex flex-wrap gap-1.5">
          {matches.map((o) => (
            <Chip
              key={o.id}
              on={o.id === opponent.opponentId}
              onClick={() => {
                onName(o.id);
                done();
              }}
            >
              {o.name}
            </Chip>
          ))}
          {canCreate && (
            <Chip
              on={false}
              onClick={() => {
                onCreate?.(query.trim());
                done();
              }}
            >
              {t('nameCreate', { name: query.trim() })}
            </Chip>
          )}
        </div>
      )}
    </div>
  );
}

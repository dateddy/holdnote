'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { PosTag } from '@/components/ui/pos-tag';
import type { DraftOpponent } from '@/lib/hands/build';
import type { OpponentOption } from '@/lib/hands/table';

type Props = {
  opponent: DraftOpponent;
  /** Everyone saved, same venue first. */
  options: OpponentOption[];
  onStack: (stack: string) => void;
  /** Empty id = detach. */
  onName: (id: string) => void;
};

/** More saved opponents than this: the list gets a search box. */
const SEARCH_FROM = 8;

/** One picked opponent under the mini table: seat, stack, and the saved opponent he is. */
export function OpponentRow({ opponent, options, onStack, onName }: Props) {
  const t = useTranslations('record');
  const [listing, setListing] = useState(false);
  const [query, setQuery] = useState('');
  const named = options.find((o) => o.id === opponent.opponentId);
  const shown = options.filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase()));

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
        <Button
          variant="secondary"
          full={false}
          className="max-w-32 shrink-0 truncate px-3 text-sm"
          aria-expanded={listing}
          onClick={() => setListing((v) => !v)}
        >
          {named?.name ?? t('nameLink')}
        </Button>
      </div>
      {listing && (
        <div className="space-y-1.5">
          {options.length > SEARCH_FROM && (
            <Input
              autoComplete="off"
              aria-label={t('searchName')}
              placeholder={t('searchName')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          <div className="flex flex-wrap gap-1.5">
            {shown.map((o) => (
              <Chip
                key={o.id}
                on={o.id === opponent.opponentId}
                onClick={() => {
                  onName(o.id === opponent.opponentId ? '' : o.id);
                  setListing(false);
                }}
              >
                {o.name}
              </Chip>
            ))}
            {options.length === 0 && <p className="text-sm text-muted">{t('noSavedOpponents')}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

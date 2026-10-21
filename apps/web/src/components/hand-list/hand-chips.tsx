'use client';

import { STREETS, type Street } from 'poker-core';
import { ActionTag } from '@/components/ui/action-tag';
import type { HandRow } from '@/lib/hands/session-hands';
import { useHandText } from './use-hand-text';

function Tags({
  row,
  street,
  showWho = true,
}: {
  row: HandRow;
  street: Street;
  showWho?: boolean;
}) {
  const x = useHandText();
  return (
    <>
      {row.chips[street].map((c) => (
        <ActionTag
          key={c.index}
          tone={c.actor}
          who={x.who(c, row)}
          showWho={showWho}
          what={x.what(c)}
          {...(c.amountBb !== undefined && { amount: `${c.amountBb}bb` })}
        />
      ))}
    </>
  );
}

/** The action chips of one street: green me, orange opponent, the number is the size in bb. */
export function StreetChips({ row, street }: { row: HandRow; street: Street }) {
  if (row.chips[street].length === 0) return <span className="text-muted">–</span>;
  return (
    <span className="flex flex-wrap gap-1">
      <Tags row={row} street={street} showWho={false} />
    </span>
  );
}

/** All streets of a hand on the phone: one line per street, so a wrapped street never loses its place. */
export function AllChips({ row }: { row: HandRow }) {
  const used = STREETS.filter((s) => row.chips[s].length > 0);
  if (used.length === 0) return null;
  return (
    <span className="flex flex-col gap-1">
      {used.map((street) => (
        <span key={street} className="flex flex-wrap items-center gap-1">
          <Tags row={row} street={street} />
        </span>
      ))}
    </span>
  );
}

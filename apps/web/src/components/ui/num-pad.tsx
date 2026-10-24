type Props = {
  onKey: (key: string) => void;
  onBackspace: () => void;
  backspaceLabel: string;
};

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6', 'k'],
  ['7', '8', '9', '.'],
] as const;

/** Number keys for chip amounts: 0-9, `.`, `k` (thousands) and delete. Four columns, four 44px rows. */
export function NumPad({ onKey, onBackspace, backspaceLabel }: Props) {
  const key = 'h-11 rounded-xl border border-line bg-surface text-lg tabular-nums';
  const press = (k: string) => (
    <button key={k} type="button" onClick={() => onKey(k)} className={key}>
      {k}
    </button>
  );
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {ROWS.flatMap((row, i) =>
        i === 0
          ? [
              ...row.map(press),
              <button
                key="back"
                type="button"
                onClick={onBackspace}
                aria-label={backspaceLabel}
                className={key}
              >
                ⌫
              </button>,
            ]
          : row.map(press),
      )}
      <button type="button" onClick={() => onKey('0')} className={`${key} col-span-4`}>
        0
      </button>
    </div>
  );
}

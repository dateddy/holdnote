const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'k'] as const;

type Props = {
  onKey: (key: string) => void;
  onBackspace: () => void;
  backspaceLabel: string;
};

/** Number keys for chip amounts: 0-9, `.`, `k` (thousands) and delete. */
export function NumPad({ onKey, onBackspace, backspaceLabel }: Props) {
  const key = 'h-11 rounded-md border border-line bg-surface text-lg tabular-nums';
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {KEYS.map((k) => (
        <button key={k} type="button" onClick={() => onKey(k)} className={key}>
          {k}
        </button>
      ))}
      <button
        type="button"
        onClick={onBackspace}
        aria-label={backspaceLabel}
        className={`${key} col-span-4`}
      >
        ⌫
      </button>
    </div>
  );
}

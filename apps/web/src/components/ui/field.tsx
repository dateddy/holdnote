import type { ReactNode } from 'react';

type Props = {
  label: string;
  /** Small grey line under the control. */
  hint?: string;
  /** Message in red under the control; also read out as an alert. */
  error?: string | null;
  children: ReactNode;
};

/** Label above one control (an `Input`), with an optional hint and error under it. */
export function Field({ label, hint, error, children }: Props) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
      {error && (
        <span role="alert" className="text-sm text-loss">
          {error}
        </span>
      )}
    </label>
  );
}

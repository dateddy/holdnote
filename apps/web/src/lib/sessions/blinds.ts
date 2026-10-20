import { parseAmount, type BlindLevel, type LevelAnteMode } from 'poker-core';

/** One row of the blind structure as typed in the editor. */
export type LevelFields = {
  level: string;
  sb: string;
  bb: string;
  ante: string;
  anteMode: string;
  minutes: string;
};

const MODES: readonly string[] = ['none', 'each', 'bb'];

/** Typed row -> structure row; null when anything is wrong (the editor then keeps the row open). */
export function levelFromFields(f: LevelFields): BlindLevel | null {
  const levelText = f.level.trim();
  if (!/^\d+$/.test(levelText)) return null;
  const level = Number(levelText);
  if (level <= 0) return null;

  const sb = parseAmount(f.sb);
  const bb = parseAmount(f.bb);
  if (sb == null || bb == null || sb < 0 || bb <= 0 || sb > bb) return null;

  let minutes: number | null = null;
  if (f.minutes.trim()) {
    const m = parseAmount(f.minutes);
    if (m == null || !Number.isInteger(m) || m <= 0) return null;
    minutes = m;
  }

  if (!MODES.includes(f.anteMode)) return null;
  const anteMode = f.anteMode as LevelAnteMode;
  if (anteMode === 'none') return { level, sb, bb, ante: 0, anteMode, minutes };

  const typed = f.ante.trim() ? parseAmount(f.ante) : null;
  if (f.ante.trim() && (typed == null || typed < 0)) return null;
  // A BB ante is the BB unless another amount is typed; a per-player ante needs its amount.
  const ante = anteMode === 'bb' ? (typed != null && typed > 0 ? typed : bb) : (typed ?? 0);
  if (ante <= 0) return null;
  return { level, sb, bb, ante, anteMode, minutes };
}

export function rowFields(l: BlindLevel): LevelFields {
  return {
    level: String(l.level),
    sb: String(l.sb),
    bb: String(l.bb),
    ante: l.ante > 0 ? String(l.ante) : '',
    anteMode: l.anteMode,
    minutes: l.minutes == null ? '' : String(l.minutes),
  };
}

/** The "add level" row: the last level copied one level up, to be edited. */
export function nextRowFields(levels: readonly BlindLevel[]): LevelFields {
  const last = [...levels].sort((a, b) => a.level - b.level).at(-1);
  if (!last) return { level: '1', sb: '', bb: '', ante: '', anteMode: 'none', minutes: '' };
  return { ...rowFields(last), level: String(last.level + 1) };
}

/** `Lv 8 · 300/600 (600) · 20 phút`; `minutesText` words the length (translated by the caller). */
export function levelRowText(l: BlindLevel, minutesText?: (n: number) => string): string {
  const blinds = `${l.sb}/${l.bb}${l.ante > 0 ? ` (${l.ante})` : ''}`;
  const length = l.minutes != null && minutesText ? ` · ${minutesText(l.minutes)}` : '';
  return `Lv ${l.level} · ${blinds}${length}`;
}

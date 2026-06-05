/**
 * Deterministic keyword scorer shared by theme selection (feature 007). The
 * explicit style direction dominates (STRONG_WEIGHT); purpose/audience only nudge
 * (WEAK_WEIGHT) so a chosen preset is never diluted by incidental words. On no
 * match or a tie, index 0 wins — callers pass a stably-ordered list so the
 * winner is reproducible (the `00`-prefixed safe default sorts first, DR-004).
 */

export const STRONG_WEIGHT = 3;
export const WEAK_WEIGHT = 1;

export interface Keyworded {
  readonly keywords: readonly string[];
}

export function scoreKeywords(keywords: readonly string[], strong: string, weak: string): number {
  return keywords.reduce((total, keyword) => {
    const needle = keyword.toLowerCase();
    return (
      total +
      (strong.includes(needle) ? STRONG_WEIGHT : 0) +
      (weak.includes(needle) ? WEAK_WEIGHT : 0)
    );
  }, 0);
}

/**
 * Returns the highest-scoring entry, or `entries[0]` on no match / tie. Returns
 * undefined only when `entries` is empty (callers handle the no-candidate axis).
 */
export function pickBest<T extends Keyworded>(
  entries: readonly T[],
  strong: string,
  weak: string
): T | undefined {
  if (entries.length === 0) {
    return undefined;
  }
  let best: T = entries[0]!;
  let bestScore = -1;
  for (const entry of entries) {
    const score = scoreKeywords(entry.keywords, strong, weak);
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return best;
}

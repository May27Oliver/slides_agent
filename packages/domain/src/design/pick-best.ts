/**
 * Deterministic keyword scorer shared by theme selection (feature 007). The
 * explicit style direction is *lexically dominant*: a candidate that matches the
 * style direction at all outranks any candidate that only matches purpose/audience,
 * no matter how many incidental purpose/audience words the latter hits. Strong
 * (styleDirection) matches are compared first; the weak (purpose/audience) count
 * only breaks ties among candidates with an equal strong count. On no match or a
 * tie, index 0 wins — callers pass a stably-ordered list so the winner is
 * reproducible (the `00`-prefixed safe default sorts first, DR-004).
 */

export interface Keyworded {
  readonly keywords: readonly string[];
}

export interface KeywordScore {
  readonly strong: number;
  readonly weak: number;
}

export function scoreKeywords(
  keywords: readonly string[],
  strong: string,
  weak: string
): KeywordScore {
  return keywords.reduce<KeywordScore>(
    (total, keyword) => {
      const needle = keyword.trim().toLowerCase();
      // Skip empty needles: String.includes("") is always true, so an empty
      // keyword would otherwise score a phantom match against every brief.
      if (needle.length === 0) {
        return total;
      }
      return {
        strong: total.strong + (matchesKeyword(strong, needle) ? 1 : 0),
        weak: total.weak + (matchesKeyword(weak, needle) ? 1 : 0)
      };
    },
    { strong: 0, weak: 0 }
  );
}

/**
 * Whole-token keyword match. A naive `includes` over-matches across word
 * boundaries — e.g. the EV palette keyword "ev" spuriously hits "dEVeloper" in a
 * tech brief. We require the keyword to sit on ASCII word boundaries; CJK has no
 * spaces, so a non-[a-z0-9] neighbour (a CJK character or a string edge) counts
 * as a boundary, preserving Chinese substring matches like "科技".
 */
function matchesKeyword(haystack: string, needle: string): boolean {
  let from = 0;
  for (;;) {
    const index = haystack.indexOf(needle, from);
    if (index < 0) {
      return false;
    }
    const before = index === 0 ? "" : haystack[index - 1]!;
    const after = index + needle.length >= haystack.length ? "" : haystack[index + needle.length]!;
    if (!isAsciiWordChar(before) && !isAsciiWordChar(after)) {
      return true;
    }
    from = index + 1;
  }
}

function isAsciiWordChar(char: string): boolean {
  return char.length > 0 && /[a-z0-9]/u.test(char);
}

/** Strong (styleDirection) count dominates; the weak count only breaks ties. */
function outranks(candidate: KeywordScore, incumbent: KeywordScore): boolean {
  if (candidate.strong !== incumbent.strong) {
    return candidate.strong > incumbent.strong;
  }
  return candidate.weak > incumbent.weak;
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
  let bestScore = scoreKeywords(best.keywords, strong, weak);
  for (let index = 1; index < entries.length; index += 1) {
    const entry = entries[index]!;
    const score = scoreKeywords(entry.keywords, strong, weak);
    if (outranks(score, bestScore)) {
      best = entry;
      bestScore = score;
    }
  }
  return best;
}

/**
 * 008 US6 — shared, source-of-truth parsing primitives for numeric facts.
 *
 * Both the chart-intent PLANNER (content-core, decides chartability) and the
 * series EXTRACTOR (rendering, builds the drawn series) parse values, units, and
 * periods through THESE functions, so "the planner said this is chartable" and
 * "the renderer can actually draw it" can never diverge (FR-017). Lives in
 * content-core (the lower layer) so rendering imports it, not the reverse.
 */

/**
 * Percentage part-to-whole tolerance: a set of percentages whose values sum
 * within [MIN, MAX] is treated as parts of a whole (→ pie). Shared by the
 * chart-intent planner (chartability) and the renderer (pie-vs-bar) so the two
 * never disagree (FR-017).
 */
export const PART_TO_WHOLE_MIN = 95;
export const PART_TO_WHOLE_MAX = 105;

/**
 * A conservatively parsed numeric value from a SourceFact string such as
 * `"$2.3M"`, `"45%"`, or `"1,200 users"`. `display` is the untouched original.
 */
export interface ParsedMetricValue {
  /** Original user-visible string, precision and symbols preserved. */
  display: string;
  /** Finite numeric magnitude used only for geometry/ratio math. */
  numericValue: number;
  /** Conservative unit/suffix token (e.g. "$", "%", "M", "users") or null. */
  unit: string | null;
  /** Leading symbol such as "$" or null. */
  prefix: string | null;
  /** Trailing token such as "%", "M", "YoY" or null. */
  suffix: string | null;
}

/**
 * Conservatively parses a SourceFact display string into a numeric value plus
 * unit hints, WITHOUT converting magnitudes or rewriting the display. Returns
 * null for anything that does not start with a number (after an optional
 * currency symbol) — e.g. "Q3 2026" or "顯著成長" — so callers fall back instead
 * of fabricating.
 */
export function parseMetricValue(value: string): ParsedMetricValue | null {
  const display = value.trim();
  if (display.length === 0) {
    return null;
  }

  const currencyMatch = /^([$€£¥])\s*/u.exec(display);
  const prefix = currencyMatch ? currencyMatch[1]! : null;
  const afterPrefix = currencyMatch ? display.slice(currencyMatch[0].length) : display;

  const numberMatch = /^(-?\d[\d,]*(?:\.\d+)?)/u.exec(afterPrefix);
  if (!numberMatch) {
    return null;
  }

  const numericValue = Number.parseFloat(numberMatch[1]!.replace(/,/gu, ""));
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  const remainder = afterPrefix.slice(numberMatch[0].length).trim();
  const suffix = parseSuffix(remainder);

  return {
    display,
    numericValue,
    unit: canonicalUnit(prefix, suffix),
    prefix,
    suffix
  };
}

/** Maximum trailing-unit word length we keep; longer tails are treated as prose. */
const MAX_SUFFIX_LENGTH = 12;

function parseSuffix(remainder: string): string | null {
  if (remainder.length === 0) {
    return null;
  }
  if (remainder.startsWith("%")) {
    return "%";
  }
  const magnitudeMatch = /^([KMBkmb])(?![A-Za-z])/u.exec(remainder);
  if (magnitudeMatch) {
    return magnitudeMatch[1]!.toUpperCase();
  }
  // A short trailing token is a real unit ("users", "小時"); long tails are prose
  // and would make every value its own unit, so we drop them (unit stays null).
  if (remainder.length <= MAX_SUFFIX_LENGTH && !/\s/u.test(remainder)) {
    return remainder;
  }
  return null;
}

function canonicalUnit(prefix: string | null, suffix: string | null): string | null {
  if (suffix === "%") {
    return "%";
  }
  const combined = `${prefix ?? ""}${suffix ?? ""}`;
  return combined.length > 0 ? combined : null;
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12
};

/**
 * Computes a numeric ordering key from a period token found in `value` +
 * `sourceText` (year, year+quarter, year+month, or a bare quarter). Returns
 * undefined when no reliable period is present — the caller then refuses to draw
 * a timeline rather than guessing an order.
 */
export function detectPeriodKey(value: string, sourceText = ""): number | undefined {
  const hay = `${value} ${sourceText}`;
  const year = /\b(19|20)\d{2}\b/u.exec(hay);
  const quarter = /\bQ([1-4])\b/iu.exec(hay);
  const month = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/iu.exec(hay);

  if (year) {
    const base = Number.parseInt(year[0]!, 10) * 100;
    if (quarter) {
      return base + Number.parseInt(quarter[1]!, 10) * 3;
    }
    if (month) {
      return base + MONTHS[month[1]!.toLowerCase()]!;
    }
    return base;
  }
  if (quarter) {
    return Number.parseInt(quarter[1]!, 10);
  }
  return undefined;
}

/**
 * Extracts a human-readable period token (`Q1 2026` / `2026` / `Jan 2026` /
 * `2026年3月`) for time-axis labels. Co-located with `detectPeriodKey` so the
 * label and the sort key recognise the same period formats (FR-017).
 */
export function periodLabel(text: string): string | null {
  const patterns = [
    /(?:19|20)\d{2}\s*年?\s*Q[1-4]/iu,
    /Q[1-4]\s*(?:19|20)\d{2}/iu,
    /(?:19|20)\d{2}\s*年\s*\d{1,2}\s*月/u,
    /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(?:19|20)\d{2}/iu,
    /(?:19|20)\d{2}\s*年/u,
    /(?:19|20)\d{2}/u,
    /Q[1-4]/iu
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      return match[0].replace(/\s+/gu, " ").trim();
    }
  }
  return null;
}

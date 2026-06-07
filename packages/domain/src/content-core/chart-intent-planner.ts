import type {
  ChartIntent,
  ChartIntentInput,
  ChartIntentPlannerResult,
  VisualizationType
} from "@/content-core/chart-intent.types";
import {
  detectPeriodKey,
  parseMetricValue,
  PART_TO_WHOLE_MAX,
  PART_TO_WHOLE_MIN
} from "@/content-core/metric-fact-parser";
import type { SourceFact } from "@/deck/deck.types";

/**
 * 008 US6 — generalizing, deterministic chart-intent planner.
 *
 * Decides WHICH facts become a chart from ARBITRARY content (decision C / FR-015):
 * it groups the deck's parsed `SourceFact`s by source section, then by shared
 * unit, and recommends a visualization per qualifying group. It shares the same
 * value/unit/period parsing as the series extractor (FR-017), so a group it
 * marks chartable is one the renderer can actually draw. It is conservative —
 * when a group has no sound comparison basis it produces NO intent rather than
 * forcing a misleading chart — and never fabricates or hardcodes sample values.
 */
export class ChartIntentPlanner {
  plan(input: ChartIntentInput): ChartIntentPlannerResult {
    const headingBySection = new Map(
      (input.sections ?? []).map((section) => [section.id, section.heading])
    );
    const intents: ChartIntent[] = [];
    let counter = 0;

    for (const [sectionId, facts] of groupBySection(input.sourceFacts)) {
      const numeric = facts
        .filter((fact) => fact.kind !== "date")
        .map(toNumericFact)
        .filter((entry): entry is NumericFact => entry !== null);
      if (numeric.length === 0) {
        continue;
      }

      const title = headingBySection.get(sectionId) ?? DEFAULT_TITLE;
      let emittedChart = false;

      for (const group of groupByUnit(numeric)) {
        if (group.length < 2 || !isChartable(group)) {
          continue;
        }
        counter += 1;
        intents.push(buildChartIntent(counter, title, group, input.chartEmphasis));
        emittedChart = true;
      }

      // A lone parseable *metric* (not a risk/constraint/decision) with no
      // comparison group → a single metric card highlight.
      if (!emittedChart && numeric.length === 1 && numeric[0]!.fact.kind === "metric") {
        counter += 1;
        intents.push(buildMetricIntent(counter, title, numeric[0]!, input.chartEmphasis));
      }
    }

    return { intents, fallbackNotes: [] };
  }
}

const DEFAULT_TITLE = "資料視覺";
/** Sentinel Map key for facts with no unit, so they share one bucket. */
const UNITLESS = Symbol("unitless");

interface NumericFact {
  fact: SourceFact;
  value: number;
  unit: string | null;
  hasPeriod: boolean;
}

function toNumericFact(fact: SourceFact): NumericFact | null {
  const parsed = parseMetricValue(fact.value);
  if (!parsed) {
    return null;
  }
  return {
    fact,
    value: parsed.numericValue,
    unit: parsed.unit,
    hasPeriod: detectPeriodKey(fact.value, fact.sourceText ?? "") !== undefined
  };
}

/** Preserves input order while bucketing facts by their source section. */
function groupBySection(facts: SourceFact[]): Map<string, SourceFact[]> {
  const groups = new Map<string, SourceFact[]>();
  for (const fact of facts) {
    const key = fact.sourceSectionId ?? "";
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(fact);
    } else {
      groups.set(key, [fact]);
    }
  }
  return groups;
}

/** Buckets numeric facts by canonical unit (null unit shares one "unitless" bucket). */
function groupByUnit(numeric: NumericFact[]): NumericFact[][] {
  const groups = new Map<string | symbol, NumericFact[]>();
  for (const entry of numeric) {
    const key = entry.unit ?? UNITLESS;
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }
  return [...groups.values()];
}

/**
 * A same-unit group of 2+ is chartable when it has a sound comparison basis:
 * an ordered time series, a percentage part-to-whole (sum ≈ 100), a same-unit
 * non-percentage comparison (e.g. revenue by region), or a same-line before/after
 * pair. Percentages that neither sum to ~100 nor share a line are refused (they
 * are usually unrelated metrics — never forced into a misleading chart).
 */
function isChartable(group: NumericFact[]): boolean {
  if (group.every((entry) => entry.hasPeriod)) {
    return true;
  }
  if (group[0]!.unit !== "%") {
    return true;
  }
  const sum = group.reduce((total, entry) => total + entry.value, 0);
  if (sum >= PART_TO_WHOLE_MIN && sum <= PART_TO_WHOLE_MAX) {
    return true;
  }
  return sharesOneLine(group);
}

function sharesOneLine(group: NumericFact[]): boolean {
  const first = group[0]!.fact.sourceText ?? "";
  return first.length > 0 && group.every((entry) => (entry.fact.sourceText ?? "") === first);
}

function recommendVisuals(group: NumericFact[]): VisualizationType[] {
  // Period-ordered → timeline (→ line). Everything else → comparison; the renderer
  // then picks pie (unit "%") vs bar (other units) from the series itself.
  return group.every((entry) => entry.hasPeriod) ? ["timeline"] : ["comparison"];
}

function buildChartIntent(
  index: number,
  title: string,
  group: NumericFact[],
  emphasis: string | undefined
): ChartIntent {
  const visuals = recommendVisuals(group);
  return {
    id: `chart-${index}`,
    title,
    sourceFacts: group.map((entry) => entry.fact),
    recommendedVisuals: visuals,
    rationale: withEmphasis(
      visuals[0] === "timeline"
        ? "同單位、可排序期間的數列適合用趨勢圖呈現。"
        : "同單位的多筆數值適合用比較圖呈現。",
      emphasis
    )
  };
}

function buildMetricIntent(
  index: number,
  title: string,
  entry: NumericFact,
  emphasis: string | undefined
): ChartIntent {
  return {
    id: `metric-${index}`,
    title,
    sourceFacts: [entry.fact],
    recommendedVisuals: ["metric_card"],
    rationale: withEmphasis("單一可解析數值適合用 metric card 突顯。", emphasis)
  };
}

function withEmphasis(rationale: string, emphasis: string | undefined): string {
  const trimmed = emphasis?.trim();
  return trimmed ? `${rationale} User chart emphasis considered: ${trimmed}` : rationale;
}

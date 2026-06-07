import type { ChartIntent } from "@/content-core/chart-intent.types";
import { detectPeriodKey, parseMetricValue, periodLabel } from "@/content-core/metric-fact-parser";
import type { SourceFact } from "@/deck/deck.types";
import type { ChartTreatment } from "@/design/design.types";
import type {
  ChartPoint,
  ChartRenderingNote,
  ChartSeries,
  ChartSeriesKind
} from "@/rendering/chart-rendering.types";

export interface ExtractChartSeriesInput {
  intent: ChartIntent;
  treatment: ChartTreatment;
}

/** Labels longer than this are truncated so an axis/legend stays readable. */
const MAX_LABEL_LENGTH = 32;
const MIN_TRUE_CHART_POINTS = 2;

/**
 * Extracts the minimal `ChartSeries` from a ChartIntent's source facts — and
 * ONLY those facts. Each point keeps its `sourceFactId` and verbatim
 * `displayValue`; values that cannot be parsed as numbers are dropped (never
 * fabricated). Unit incompatibility and insufficient points are surfaced as
 * warnings so the renderer can fall back instead of drawing a misleading chart.
 */
export function extractChartSeries(input: ExtractChartSeriesInput): ChartSeries {
  const { intent, treatment } = input;
  const warnings: ChartRenderingNote[] = [];

  const parsed = intent.sourceFacts.map((fact) => ({ fact, point: toChartPoint(fact) }));
  const points = parsed
    .map((entry) => entry.point)
    .filter((point): point is ChartPoint => point !== null);

  // Source fidelity (CR-001/CR-002): a fact that could not be parsed is silently
  // absent from the visual, so disclose it as a reviewable note rather than
  // letting a partial chart imply it covered every source fact.
  const droppedFactIds = parsed
    .filter((entry) => entry.point === null)
    .map((entry) => entry.fact.id);
  if (droppedFactIds.length > 0) {
    warnings.push({
      code: "value_parse_uncertain",
      message: `${droppedFactIds.length} 筆來源事實無法解析為數值，已略過未納入圖表。`,
      chartIntentId: intent.id,
      sourceFactIds: droppedFactIds
    });
  }

  const wantsSeries = treatment === "chart" || treatment === "timeline";
  if (wantsSeries && points.length < MIN_TRUE_CHART_POINTS) {
    warnings.push(
      note(
        "series_insufficient",
        intent,
        points,
        `Only ${points.length} parseable numeric point(s).`
      )
    );
  }

  const unit = sharedUnit(points);
  if (unit === MIXED_UNIT) {
    warnings.push(note("unit_mismatch", intent, points, "Source facts mix incompatible units."));
  }

  const wantsTime = treatment === "timeline";
  const timeRanked = wantsTime ? rankByTime(points) : null;
  if (wantsTime && timeRanked === null && points.length >= MIN_TRUE_CHART_POINTS) {
    warnings.push(
      note("time_sort_failed", intent, points, "Periods could not be reliably ordered.")
    );
  }

  const orderedPoints = timeRanked ?? points;
  const kind = determineKind(orderedPoints, timeRanked !== null);

  return {
    kind,
    title: intent.title,
    points: orderedPoints,
    unit: unit === MIXED_UNIT ? null : unit,
    sourceFactIds: orderedPoints.map((point) => point.sourceFactId),
    warnings
  };
}

function toChartPoint(fact: SourceFact): ChartPoint | null {
  const parsed = parseMetricValue(fact.value);
  if (!parsed) {
    return null;
  }
  const point: ChartPoint = {
    label: deriveLabel(fact),
    displayValue: parsed.display,
    value: parsed.numericValue,
    unit: parsed.unit,
    sourceFactId: fact.id,
    sourceText: fact.sourceText
  };
  const sortKey = detectPeriodKey(fact.value, fact.sourceText ?? "");
  if (sortKey !== undefined) {
    return { ...point, sortKey };
  }
  return point;
}

/**
 * Derives a clean axis/legend label from the fact's surrounding sentence — the
 * CATEGORY name ("行動裝置") or the PERIOD ("Q1 2026"), not the leftover sentence
 * fragment. An LLM-rewritten fact reads like "行動裝置占使用者工作階段的 52%。", so
 * naively stripping the value leaves "行動裝置占使用者工作階段的 。"; we instead take
 * the leading noun phrase up to a separator (colon, or a relation word like 占/為).
 */
function deriveLabel(fact: SourceFact): string {
  const raw = (fact.sourceText ?? "").trim();
  const value = fact.value.trim();
  if (raw.length === 0) {
    return truncate(value);
  }

  // A time fact reads cleanest as its period token.
  const period = periodLabel(raw);
  if (period) {
    return truncate(period);
  }

  const text = raw.replace(/^[\s\-*•・]+/u, "");

  // A colon is the high-confidence "label：value" separator.
  const colon = text.search(/[：:]/u);
  if (colon > 0) {
    return truncate(cleanLabel(text.slice(0, colon)));
  }

  // Otherwise drop the value, then keep the leading 2+ char noun phrase that
  // precedes a relation word (占/佔/為/達). The 2+ guard avoids splitting a
  // category that merely contains such a character (e.g. "行為…").
  const beforeValue =
    value.length > 0 && text.includes(value) ? text.slice(0, text.indexOf(value)) : text;
  const relation = /^(.{2,}?)(?:占|佔|為|達)/u.exec(beforeValue);
  const label = cleanLabel(relation ? relation[1]! : beforeValue);
  return truncate(label.length > 0 ? label : cleanLabel(text.replace(value, " ")));
}

function cleanLabel(value: string): string {
  return value
    .replace(/\s+/gu, " ")
    .replace(/[，,。.、；;\s]+$/u, "")
    .trim();
}

function truncate(value: string): string {
  return value.length > MAX_LABEL_LENGTH ? `${value.slice(0, MAX_LABEL_LENGTH - 1)}…` : value;
}

const MIXED_UNIT = Symbol("mixed-unit");

/** Returns the shared unit, null when all points are unitless, or MIXED_UNIT. */
function sharedUnit(points: ChartPoint[]): string | null | typeof MIXED_UNIT {
  if (points.length === 0) {
    return null;
  }
  const first = points[0]!.unit;
  return points.every((point) => point.unit === first) ? first : MIXED_UNIT;
}

/** Returns points sorted by time when EVERY point has a sort key, else null. */
function rankByTime(points: ChartPoint[]): ChartPoint[] | null {
  if (points.length < MIN_TRUE_CHART_POINTS) {
    return null;
  }
  if (!points.every((point) => typeof point.sortKey === "number")) {
    return null;
  }
  const keys = points.map((point) => point.sortKey as number);
  // Bare quarters (1–4) and dated periods (year×100+…, ≥ 1900) live on different
  // scales; mixing them would order "Q2" before "2026 Q1". Refuse to order so the
  // caller degrades to a bar with a time_sort_failed note instead of misleading.
  const hasBare = keys.some((key) => key < 1000);
  const hasDated = keys.some((key) => key >= 1000);
  if (hasBare && hasDated) {
    return null;
  }
  return [...points].sort((left, right) => (left.sortKey as number) - (right.sortKey as number));
}

function determineKind(points: ChartPoint[], isTime: boolean): ChartSeriesKind {
  if (points.length === 0) {
    return "none";
  }
  if (points.length === 1) {
    return "single";
  }
  return isTime ? "time" : "categorical";
}

function note(
  code: ChartRenderingNote["code"],
  intent: ChartIntent,
  points: ChartPoint[],
  message: string
): ChartRenderingNote {
  return {
    code,
    message,
    chartIntentId: intent.id,
    sourceFactIds: points.map((point) => point.sourceFactId)
  };
}

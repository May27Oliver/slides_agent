import type { ChartIntent } from "@/content-core/chart-intent.types";
import { PART_TO_WHOLE_MAX, PART_TO_WHOLE_MIN } from "@/content-core/metric-fact-parser";
import type { SlideDeck, SourceFact } from "@/deck/deck.types";
import type { ChartTreatment, ChartTreatmentPlan, DesignSystem } from "@/design/design.types";
import type { AccentHue, DesignStyleKit } from "@/design/design-style-kit.types";
import { resolveTreatmentForVisuals } from "@/design/chart-treatment-mapping";
import type {
  ChartRenderingNote,
  ChartSeries,
  ChartVisualKind,
  RenderedChart
} from "@/rendering/chart-rendering.types";
import { extractChartSeries } from "@/rendering/chart-series-extractor";
import {
  validateBarSeries,
  validateLineSeries,
  validatePieSeries
} from "@/rendering/chart-series-validator";
import {
  renderFactTable,
  renderFallbackText,
  renderMetricCard,
  renderMetricGroup,
  type TableRow
} from "@/rendering/chart-html-renderer";
import { renderBarChart, renderLineChart, renderPieChart } from "@/rendering/chart-svg-renderer";
import { escapeAttribute, escapeHtml } from "@/rendering/sanitize";

export interface RenderChartIntentInput {
  intent: ChartIntent;
  treatmentPlan?: ChartTreatmentPlan;
  styleKit: DesignStyleKit;
  designSystem: DesignSystem;
  /** Suppress the chart's figcaption title (e.g. when the slide title already conveys it). */
  hideTitle?: boolean;
}

/** Maximum table rows before truncation; extras are noted, never dropped silently. */
const TABLE_ROW_LIMIT = 8;

/**
 * Orchestrates a single ChartIntent into a sanitized, self-contained visual.
 *
 * Treatment comes from the design `ChartTreatmentPlan` when present, else from
 * the `VisualizationType → ChartTreatment` mapping. The concrete visual is then
 * chosen from the treatment PLUS series validation; whenever the data does not
 * meet a true-chart's minimum conditions the renderer falls back (metric group →
 * table → text) and records the reason — never a blank or misleading chart.
 */
export function renderChartIntent(input: RenderChartIntentInput): RenderedChart {
  const { intent } = input;
  const hues = input.styleKit.accentHues;
  const treatment: ChartTreatment =
    input.treatmentPlan?.treatment ?? resolveTreatmentForVisuals(intent.recommendedVisuals);
  const series = extractChartSeries({ intent, treatment });

  const rendered = selectVisual({ intent, treatment, series, hues });
  const notes = stamp(intent.id, [...series.warnings, ...rendered.notes]);

  return {
    visualKind: rendered.visualKind,
    html: wrap(intent, rendered.visualKind, rendered.sourceFactIds, rendered.html, input.hideTitle),
    sourceFactIds: rendered.sourceFactIds,
    notes
  };
}

interface VisualSelection {
  visualKind: ChartVisualKind;
  html: string;
  sourceFactIds: string[];
  notes: ChartRenderingNote[];
}

interface SelectVisualInput {
  intent: ChartIntent;
  treatment: ChartTreatment;
  series: ChartSeries;
  hues: readonly AccentHue[];
}

function selectVisual(input: SelectVisualInput): VisualSelection {
  switch (input.treatment) {
    case "chart":
      return selectComparison(input);
    case "timeline":
      return selectTimeline(input);
    case "metric_card":
      return selectMetric(input);
    case "table":
      return tableVisual(input.intent, input.series);
    case "fallback_text":
    case "review_note":
    default:
      return fallbackText(input.intent, input.series, "資料不足以成圖，改以文字呈現。");
  }
}

// comparison: pie when the series is a percentage part-to-whole, else bar; on
// invalid data fall back to a metric group, then a table, then text.
function selectComparison(input: SelectVisualInput): VisualSelection {
  const { series, hues } = input;
  const pie = validatePieSeries(series);
  // Pie/donut is only honest for a percentage PART-TO-WHOLE (slices summing to a
  // whole). A "%" series that is a before/after or unrelated set (e.g. 18% → 25%)
  // is NOT part-to-whole and must be a bar, not a misleading pie.
  if (pie.ok && isPartToWhole(series)) {
    return svgVisual("pie_donut", series, renderPieChart({ series, hues }));
  }
  const bar = validateBarSeries(series);
  if (bar.ok) {
    return svgVisual("bar", series, renderBarChart({ series, hues }));
  }
  // Pie validation is stricter than bar validation, so a pie-ok series would
  // already have returned via bar when it is not a part-to-whole percentage.
  return degradeComparison(input, [...bar.notes]);
}

/** True when the series is a percentage part-to-whole (slices sum to ≈100%). */
function isPartToWhole(series: ChartSeries): boolean {
  if (series.unit !== "%") {
    return false;
  }
  const sum = series.points.reduce((total, point) => total + point.value, 0);
  return sum >= PART_TO_WHOLE_MIN && sum <= PART_TO_WHOLE_MAX;
}

// timeline: line when reliably ordered, else bar, else table/text.
function selectTimeline(input: SelectVisualInput): VisualSelection {
  const { series, hues } = input;
  const line = validateLineSeries(series);
  if (line.ok) {
    return svgVisual("line", series, renderLineChart({ series, hues }));
  }
  const bar = validateBarSeries(series);
  if (bar.ok) {
    return withNotes(svgVisual("bar", series, renderBarChart({ series, hues })), line.notes);
  }
  return degradeComparison(input, [...line.notes, ...bar.notes]);
}

function degradeComparison(
  input: SelectVisualInput,
  carried: ChartRenderingNote[]
): VisualSelection {
  const { intent, series, hues } = input;
  if (series.points.length >= 2) {
    const group = renderMetricGroup({ points: series.points, hues });
    return withNotes(
      {
        visualKind: "metric_group",
        html: group,
        sourceFactIds: series.sourceFactIds,
        notes: [fallbackNote(intent, series.sourceFactIds, "改以並列 metric 群組呈現。")]
      },
      carried
    );
  }
  if (intent.sourceFacts.length > 0) {
    return withNotes(tableVisual(intent, series), carried);
  }
  return withNotes(fallbackText(intent, series, "資料不足以成圖，改以文字呈現。"), carried);
}

// metric_card: the first parseable metric, else fallback text.
function selectMetric(input: SelectVisualInput): VisualSelection {
  const { intent, series, hues } = input;
  const point = series.points[0];
  if (!point) {
    return fallbackText(intent, series, "資料不足以成圖，保留原文。");
  }
  const card = renderMetricCard({
    point,
    ...(hues.length > 0 ? { hue: hues[0]! } : {})
  });
  return {
    visualKind: "metric_card",
    html: card,
    sourceFactIds: [point.sourceFactId],
    notes: []
  };
}

function tableVisual(intent: ChartIntent, series: ChartSeries): VisualSelection {
  const facts = intent.sourceFacts;
  const shown = facts.slice(0, TABLE_ROW_LIMIT);
  const omittedCount = Math.max(facts.length - shown.length, 0);
  const rows: TableRow[] = shown.map((fact) => ({ label: rowLabel(fact), value: fact.value }));
  const notes: ChartRenderingNote[] =
    omittedCount > 0
      ? [
          {
            code: "table_truncated",
            message: `表格顯示前 ${shown.length} 列，省略 ${omittedCount} 列。`,
            chartIntentId: intent.id,
            sourceFactIds: facts.map((fact) => fact.id)
          }
        ]
      : [];
  return {
    visualKind: "table",
    html: renderFactTable({ rows, omittedCount }),
    sourceFactIds: shown.map((fact) => fact.id),
    notes: notes.length > 0 ? notes : [seriesNoteForTable(intent, series)]
  };
}

function fallbackText(intent: ChartIntent, series: ChartSeries, message: string): VisualSelection {
  return {
    visualKind: "fallback_text",
    html: renderFallbackText(fallbackBody(intent, message)),
    sourceFactIds: series.sourceFactIds,
    notes: [fallbackNote(intent, series.sourceFactIds, message)]
  };
}

function svgVisual(kind: ChartVisualKind, series: ChartSeries, html: string): VisualSelection {
  return { visualKind: kind, html, sourceFactIds: series.sourceFactIds, notes: [] };
}

function withNotes(selection: VisualSelection, extra: ChartRenderingNote[]): VisualSelection {
  return { ...selection, notes: [...selection.notes, ...extra] };
}

function rowLabel(fact: SourceFact): string {
  const text = (fact.sourceText ?? "").trim();
  return text.length > 0 ? text : fact.kind;
}

function fallbackBody(intent: ChartIntent, message: string): string {
  const context = intent.sourceFacts
    .map((fact) => fact.value)
    .filter(Boolean)
    .join("、");
  return context.length > 0 ? `${message}（${context}）` : message;
}

function fallbackNote(
  intent: ChartIntent,
  sourceFactIds: string[],
  message: string
): ChartRenderingNote {
  return { code: "fallback_used", message, chartIntentId: intent.id, sourceFactIds };
}

function seriesNoteForTable(intent: ChartIntent, series: ChartSeries): ChartRenderingNote {
  return {
    code: "series_extracted",
    message: "以表格呈現來源事實。",
    chartIntentId: intent.id,
    sourceFactIds: series.sourceFactIds
  };
}

function stamp(intentId: string, notes: ChartRenderingNote[]): ChartRenderingNote[] {
  return notes.map((note) => (note.chartIntentId ? note : { ...note, chartIntentId: intentId }));
}

function wrap(
  intent: ChartIntent,
  visualKind: ChartVisualKind,
  sourceFactIds: string[],
  fragment: string,
  hideTitle = false
): string {
  const caption = hideTitle
    ? ""
    : `<figcaption class="chart-title">${escapeHtml(intent.title)}</figcaption>`;
  return (
    `<figure class="chart chart-${escapeAttribute(visualKind)}" ` +
    `data-chart-intent-id="${escapeAttribute(intent.id)}" ` +
    `data-chart-visual="${escapeAttribute(visualKind)}" ` +
    `data-source-fact-ids="${escapeAttribute(sourceFactIds.join(" "))}">` +
    caption +
    fragment +
    `</figure>`
  );
}

export interface ChartReviewNotesInput {
  deck: SlideDeck;
  chartIntents: ChartIntent[];
  chartTreatmentPlans: ChartTreatmentPlan[];
  styleKit: DesignStyleKit;
  designSystem: DesignSystem;
}

/**
 * Note codes that warrant a human-facing review note (CR-002). `series_extracted`
 * is purely informational (a table simply showed the source facts) and is omitted.
 */
const REVIEWABLE_NOTE_CODES: ReadonlySet<ChartRenderingNote["code"]> = new Set([
  "series_insufficient",
  "unit_mismatch",
  "invalid_pie_total",
  "time_sort_failed",
  "table_truncated",
  "fallback_used",
  "value_parse_uncertain"
]);

/**
 * Collects human-readable review notes for every wired chart intent so the
 * fallback / extraction / truncation / uncertain-parse decisions taken during
 * rendering are visible in the deck's review report (CR-002 / FR-004). Pure, and
 * routed through the same renderChartIntent path so the surfaced notes can never
 * diverge from what was actually drawn.
 */
export function collectChartReviewNotes(input: ChartReviewNotesInput): string[] {
  if (input.chartIntents.length === 0) {
    return [];
  }
  const intentById = new Map(input.chartIntents.map((intent) => [intent.id, intent]));
  const planByIntentId = new Map(
    input.chartTreatmentPlans.map((plan) => [plan.chartIntentId, plan])
  );

  const notes: string[] = [];
  for (const slide of input.deck.slides) {
    for (const block of slide.contentBlocks) {
      if (block.kind !== "chart_placeholder" || !block.chartIntentId) {
        continue;
      }
      const intent = intentById.get(block.chartIntentId);
      if (!intent) {
        continue;
      }
      const plan = planByIntentId.get(intent.id);
      const rendered = renderChartIntent({
        intent,
        ...(plan ? { treatmentPlan: plan } : {}),
        styleKit: input.styleKit,
        designSystem: input.designSystem
      });
      for (const note of rendered.notes) {
        if (REVIEWABLE_NOTE_CODES.has(note.code)) {
          notes.push(`「${intent.title}」：${note.message}`);
        }
      }
    }
  }
  return notes;
}

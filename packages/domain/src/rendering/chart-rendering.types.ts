/**
 * 008 chart-rendering — shared domain language for turning planned ChartIntents
 * into self-contained inline SVG/HTML visuals.
 *
 * These types are the single vocabulary shared by the metric parser, the series
 * extractor/validator, the SVG/HTML renderers, and the renderChartIntent
 * orchestrator. They are pure data (no DOM, no SQL, no third-party chart lib).
 *
 * Source-fidelity rule: every numeric point keeps its original `displayValue`
 * and a `sourceFactId`. The engine never fabricates, interpolates, or rounds the
 * displayed value — it only parses a `numericValue` for geometry/ratio math.
 */

/** The concrete visual the renderer ultimately emits for a chart intent. */
export type ChartVisualKind =
  | "pie_donut"
  | "line"
  | "bar"
  | "metric_card"
  | "metric_group"
  | "table"
  | "fallback_text";

/** A single labelled data point with full lineage back to its source fact. */
export interface ChartPoint {
  label: string;
  /** Original display string, shown verbatim by the renderer. */
  displayValue: string;
  /** Finite numeric value for ratios/coordinates. */
  value: number;
  unit: string | null;
  sourceFactId: string;
  sourceText: string;
  /** Optional sort key for time series (numeric epoch-ish rank or string). */
  sortKey?: number | string;
}

export type ChartSeriesKind = "categorical" | "time" | "single" | "table" | "none";

/** The minimal structured series extracted from a ChartIntent's source facts. */
export interface ChartSeries {
  kind: ChartSeriesKind;
  title: string;
  points: ChartPoint[];
  /** Shared unit when the series is unit-compatible, else null. */
  unit: string | null;
  sourceFactIds: string[];
  warnings: ChartRenderingNote[];
}

/** A reviewable note explaining extraction/fallback/truncation decisions. */
export interface ChartRenderingNote {
  code:
    | "series_extracted"
    | "series_insufficient"
    | "unit_mismatch"
    | "invalid_pie_total"
    | "time_sort_failed"
    | "table_truncated"
    | "fallback_used"
    | "value_parse_uncertain";
  message: string;
  chartIntentId: string;
  sourceFactIds: string[];
}

/** The result of a series validator: whether a true chart can be drawn. */
export interface ValidationResult {
  ok: boolean;
  notes: ChartRenderingNote[];
}

/** A fully rendered, sanitized chart fragment plus its review notes. */
export interface RenderedChart {
  visualKind: ChartVisualKind;
  /** Sanitized inline SVG/HTML fragment. */
  html: string;
  sourceFactIds: string[];
  notes: ChartRenderingNote[];
  /**
   * True iff the renderer did NOT produce the intent's primary visual — i.e. a
   * `chart`/`timeline` intent that fell back to a non-chart visual (metric group,
   * table, or text), or any intent that degraded to `fallback_text`. Computed by
   * `renderChartIntent` (the canonical single source) from the resolved treatment
   * + the chosen visual + the `fallback_used` note.
   */
  fallback: boolean;
}

/**
 * 009: readonly per-chart result evidence, collected during the single deck
 * render pass (NOT a re-render). Distinct from `RenderedChart` (the fragment):
 * this drops the html and adds `slideId` + a `fallback` flag so the control panel
 * can honestly show which chart types were drawn and which truly degraded.
 *
 * `fallback === true` iff the renderer did NOT produce the intent's primary
 * visual: a `chart`/`timeline` intent that landed on a non-chart visual
 * (`metric_group`/`table`/`fallback_text`), or any intent that degraded to
 * `fallback_text`. A *planned* `table`/`metric_card` (and `table_truncated` /
 * `series_extracted` notes on it) is NOT a fallback. See `RenderedChart.fallback`.
 */
export interface RenderedChartSummary {
  slideId: string;
  chartIntentId: string;
  visualKind: ChartVisualKind;
  fallback: boolean;
  notes: Array<{ code: ChartRenderingNote["code"]; message: string }>;
}

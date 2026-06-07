import type {
  ChartRenderingNote,
  ChartSeries,
  ValidationResult
} from "@/rendering/chart-rendering.types";

const MIN_POINTS = 2;

/**
 * Validators decide whether a `ChartSeries` meets the minimum, source-faithful
 * conditions for each true chart. They never mutate the series; they return
 * `{ ok, notes }` so the orchestrator can fall back and surface the reason.
 *
 * The produced notes carry an empty `chartIntentId`; `renderChartIntent` stamps
 * the real intent id onto every note before returning (the series itself does
 * not carry the intent id).
 */

/** pie/donut: 2+ points, non-negative values, total > 0, unit-compatible. */
export function validatePieSeries(series: ChartSeries): ValidationResult {
  if (series.points.length < MIN_POINTS) {
    return fail(series, "series_insufficient", "Pie needs at least 2 points.");
  }
  if (hasUnitMismatch(series)) {
    return fail(series, "unit_mismatch", "Pie needs a single shared unit.");
  }
  if (series.points.some((point) => point.value < 0)) {
    return fail(series, "invalid_pie_total", "Pie cannot show negative values.");
  }
  const total = series.points.reduce((sum, point) => sum + point.value, 0);
  if (!(total > 0)) {
    return fail(series, "invalid_pie_total", "Pie total must be greater than zero.");
  }
  return { ok: true, notes: [] };
}

/** line: 2+ points, unit-compatible, reliably time-ordered (kind === "time"). */
export function validateLineSeries(series: ChartSeries): ValidationResult {
  if (series.points.length < MIN_POINTS) {
    return fail(series, "series_insufficient", "Line needs at least 2 points.");
  }
  if (hasUnitMismatch(series)) {
    return fail(series, "unit_mismatch", "Line needs a single shared unit.");
  }
  if (series.kind !== "time") {
    return fail(series, "time_sort_failed", "Line needs a reliably ordered x axis.");
  }
  return { ok: true, notes: [] };
}

/** bar: 2+ points with a single shared unit. */
export function validateBarSeries(series: ChartSeries): ValidationResult {
  if (series.points.length < MIN_POINTS) {
    return fail(series, "series_insufficient", "Bar needs at least 2 points.");
  }
  if (hasUnitMismatch(series)) {
    return fail(series, "unit_mismatch", "Bar needs a single shared unit.");
  }
  return { ok: true, notes: [] };
}

function hasUnitMismatch(series: ChartSeries): boolean {
  return series.warnings.some((warning) => warning.code === "unit_mismatch");
}

function fail(
  series: ChartSeries,
  code: ChartRenderingNote["code"],
  message: string
): ValidationResult {
  return {
    ok: false,
    notes: [{ code, message, chartIntentId: "", sourceFactIds: series.sourceFactIds }]
  };
}

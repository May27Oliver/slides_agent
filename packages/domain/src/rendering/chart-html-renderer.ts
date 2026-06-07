import type { AccentHue } from "@/design/design-style-kit.types";
import type { ChartPoint } from "@/rendering/chart-rendering.types";
import { escapeHtml, FALLBACK_HUE, safeHex } from "@/rendering/sanitize";

/**
 * 008 engine-owned HTML renderers for non-SVG visuals: metric card, metric
 * group, fact table, and fallback text. Every value is HTML-escaped; colours
 * come from the deck's accent hues. No client JS, no external resource.
 */

function hueBase(hue: AccentHue | undefined): string {
  return safeHex(hue?.base, FALLBACK_HUE);
}

export interface MetricCardInput {
  point: ChartPoint;
  hue?: AccentHue;
}

/** A single "big number + label + context" stat block. */
export function renderMetricCard(input: MetricCardInput): string {
  const { point } = input;
  const accent = hueBase(input.hue);
  const context =
    point.label && point.label !== point.displayValue ? point.label : point.sourceText;
  const contextHtml = context
    ? `<span class="chart-metric-context">${escapeHtml(context)}</span>`
    : "";
  return (
    `<div class="chart-metric" style="--chart-accent:${accent}">` +
    `<span class="chart-metric-value">${escapeHtml(point.displayValue)}</span>` +
    contextHtml +
    `</div>`
  );
}

export interface MetricGroupInput {
  points: ChartPoint[];
  hues: readonly AccentHue[];
}

/** Multiple metrics side-by-side (the safe fallback for mixed-unit comparison). */
export function renderMetricGroup(input: MetricGroupInput): string {
  const tiles = input.points
    .map((point, index) =>
      renderMetricCard({
        point,
        ...(input.hues.length > 0 ? { hue: input.hues[index % input.hues.length]! } : {})
      })
    )
    .join("");
  return `<div class="chart-metric-group">${tiles}</div>`;
}

export interface TableRow {
  label: string;
  value: string;
}

export interface FactTableInput {
  rows: TableRow[];
  omittedCount: number;
}

/** A themed HTML table; an omitted-rows caption is shown when rows were cut. */
export function renderFactTable(input: FactTableInput): string {
  const body = input.rows
    .map(
      (row) =>
        `<tr><th scope="row">${escapeHtml(row.label)}</th><td>${escapeHtml(row.value)}</td></tr>`
    )
    .join("");
  const caption =
    input.omittedCount > 0
      ? `<figcaption class="chart-table-note">顯示前 ${input.rows.length} 列，省略 ${input.omittedCount} 列</figcaption>`
      : "";
  return `<table class="chart-table"><tbody>${body}</tbody></table>${caption}`;
}

/** Plain, clearly-not-a-broken-chart fallback text. */
export function renderFallbackText(message: string): string {
  return `<p class="chart-fallback">${escapeHtml(message)}</p>`;
}

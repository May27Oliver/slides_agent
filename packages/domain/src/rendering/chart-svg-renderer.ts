import type { AccentHue } from "@/design/design-style-kit.types";
import type { ChartPoint, ChartSeries } from "@/rendering/chart-rendering.types";
import {
  escapeAttribute,
  escapeHtml,
  FALLBACK_HUE,
  safeHex,
  safeNumber,
  svgCoord
} from "@/rendering/sanitize";

/**
 * 008 engine-owned inline SVG chart renderers. Each returns a self-contained,
 * static `<svg>` (+ HTML legend where useful) — no client JS, no canvas, no
 * external resource, every value sanitized. Colours come from the deck's accent
 * hues so charts stay coherent with the active 007 style.
 */

export interface ChartSvgInput {
  series: ChartSeries;
  hues: readonly AccentHue[];
}

const VIEW_W = 400;
const VIEW_H = 248;
const RECT_VIEWBOX = `0 0 ${VIEW_W} ${VIEW_H}`;
const PAD_X = 32;
const PAD_TOP = 28;
const PAD_BOTTOM = 48;
/** Axis-slot labels are clipped tighter than legend labels so they never overflow. */
const AXIS_LABEL_MAX = 12;

function hueAt(hues: readonly AccentHue[], index: number): string {
  const hue = hues.length > 0 ? hues[index % hues.length] : undefined;
  return safeHex(hue?.base, FALLBACK_HUE);
}

/** Accessible <title> placed first inside the svg for screen readers. */
function svgTitle(series: ChartSeries): string {
  return `<title>${escapeHtml(series.title)}</title>`;
}

function openSvg(viewBox: string, label: string): string {
  return (
    `<svg class="chart-svg" viewBox="${viewBox}" ` +
    `role="img" aria-label="${escapeAttribute(label)}" preserveAspectRatio="xMidYMid meet">`
  );
}

// ---------------------------------------------------------------------------
// Bar chart — vertical bars off a zero baseline (so negative values draw
// downward rather than being clamped to a misleading zero-height bar), hue-
// cycled, value labels on the bar's outer end, categories along the bottom.
// ---------------------------------------------------------------------------
export function renderBarChart(input: ChartSvgInput): string {
  const { series, hues } = input;
  const innerW = VIEW_W - PAD_X * 2;
  const innerH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const chartBottom = PAD_TOP + innerH;
  const values = series.points.map((point) => safeNumber(point.value, 0));
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  // y of the value=0 axis; equals the chart bottom when every value is ≥ 0.
  const zeroY = PAD_TOP + (max / span) * innerH;
  const slot = innerW / series.points.length;
  const barWidth = Math.min(slot * 0.62, 56);

  const baseline = `<line x1="${svgCoord(PAD_X)}" y1="${svgCoord(zeroY)}" x2="${svgCoord(
    PAD_X + innerW
  )}" y2="${svgCoord(zeroY)}" class="chart-axis" />`;

  const bars = series.points
    .map((point, index) => {
      const value = safeNumber(point.value, 0);
      const valueY = PAD_TOP + ((max - value) / span) * innerH;
      const top = Math.min(valueY, zeroY);
      const height = Math.abs(zeroY - valueY);
      const x = PAD_X + slot * index + (slot - barWidth) / 2;
      const fill = hueAt(hues, index);
      // Value label sits on the bar's outer end, away from the zero axis.
      const labelY = value < 0 ? top + height + 16 : top - 7;
      // chart-bar grows from the zero axis on slide entrance; a negative bar
      // grows downward, so it anchors at its top edge instead of its bottom.
      const barClass = value < 0 ? "chart-bar chart-bar-neg" : "chart-bar";
      return (
        `<rect class="${barClass}" x="${svgCoord(x)}" y="${svgCoord(top)}" width="${svgCoord(barWidth)}" ` +
        `height="${svgCoord(height)}" rx="4" fill="${fill}" />` +
        text(x + barWidth / 2, labelY, point.displayValue, "chart-value") +
        text(x + barWidth / 2, chartBottom + 18, clip(point.label), "chart-label")
      );
    })
    .join("");

  return `${openSvg(RECT_VIEWBOX, series.title)}${svgTitle(series)}${baseline}${bars}</svg>`;
}

// ---------------------------------------------------------------------------
// Line chart — ordered time series, polyline + point dots + x labels.
// ---------------------------------------------------------------------------
export function renderLineChart(input: ChartSvgInput): string {
  const { series, hues } = input;
  const innerW = VIEW_W - PAD_X * 2;
  const innerH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const baseY = PAD_TOP + innerH;
  const values = series.points.map((point) => safeNumber(point.value, 0));
  const max = Math.max(...values, 0) || 1;
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const stroke = hueAt(hues, 0);

  const coords = series.points.map((point, index) => {
    const x = PAD_X + (innerW * index) / Math.max(series.points.length - 1, 1);
    const y = baseY - ((safeNumber(point.value, 0) - min) / span) * innerH;
    return { x, y, point };
  });

  const baseline = `<line x1="${svgCoord(PAD_X)}" y1="${svgCoord(baseY)}" x2="${svgCoord(
    PAD_X + innerW
  )}" y2="${svgCoord(baseY)}" class="chart-axis" />`;
  // pathLength="1" normalises the polyline so a single CSS stroke-dash keyframe
  // draws it on slide entrance regardless of its real length.
  const polyline = `<polyline class="chart-line" pathLength="1" fill="none" stroke="${stroke}" stroke-width="2.5" points="${coords
    .map((c) => `${svgCoord(c.x)},${svgCoord(c.y)}`)
    .join(" ")}" />`;
  const dots = coords
    .map(
      (c) =>
        `<circle class="chart-dot" cx="${svgCoord(c.x)}" cy="${svgCoord(c.y)}" r="3.5" fill="${stroke}" />` +
        text(c.x, c.y - 9, c.point.displayValue, "chart-value") +
        text(c.x, baseY + 18, clip(c.point.label), "chart-label")
    )
    .join("");

  return `${openSvg(RECT_VIEWBOX, series.title)}${svgTitle(series)}${baseline}${polyline}${dots}</svg>`;
}

// ---------------------------------------------------------------------------
// Pie / donut — drawn as concentric stroke arcs on ONE shared circle radius
// (`pathLength="1"` normalised) rather than filled wedges. This lets a single
// CSS stroke-dash keyframe sweep each slice into place on slide entrance, makes
// a 100% slice a clean full ring (no degenerate full-circle arc), and keeps the
// donut hole implicit (the empty centre of the ring).
// ---------------------------------------------------------------------------
// A SQUARE viewBox centred on the donut, so the ring fills the svg (the legend is
// separate HTML). A wide viewBox would draw the donut in the left third and leave
// the right two-thirds empty, defeating any CSS attempt to enlarge it.
const PIE_VIEW = 248;
const PIE_C = PIE_VIEW / 2;
const PIE_RADIUS = 100;
const PIE_HOLE_RADIUS = 52;
const PIE_MID_RADIUS = (PIE_RADIUS + PIE_HOLE_RADIUS) / 2;
const PIE_STROKE_WIDTH = PIE_RADIUS - PIE_HOLE_RADIUS;

export function renderPieChart(input: ChartSvgInput): string {
  const { series, hues } = input;
  const total =
    series.points.reduce((sum, point) => sum + Math.max(safeNumber(point.value, 0), 0), 0) || 1;

  let startFraction = 0;
  const slices = series.points
    .map((point, index) => {
      const fraction = Math.max(safeNumber(point.value, 0), 0) / total;
      const arc = round4(fraction);
      // Rotate each arc to its start angle, less 90° so 0% begins at 12 o'clock.
      const startDeg = round4(startFraction * 360 - 90);
      const sliceStart = round4(startFraction);
      startFraction += fraction;
      // dasharray "{arc} 1" (pathLength 1) shows exactly one arc of this fraction.
      return (
        `<circle class="chart-pie-slice" cx="${svgCoord(PIE_C)}" cy="${svgCoord(PIE_C)}" ` +
        `r="${svgCoord(PIE_MID_RADIUS)}" fill="none" stroke="${hueAt(hues, index)}" ` +
        `stroke-width="${svgCoord(PIE_STROKE_WIDTH)}" pathLength="1" ` +
        `stroke-dasharray="${arc} 1" stroke-dashoffset="0" ` +
        `transform="rotate(${startDeg} ${svgCoord(PIE_C)} ${svgCoord(PIE_C)})" ` +
        `style="--frac:${arc};--slice-start:${sliceStart}" />`
      );
    })
    .join("");

  const svg = `${openSvg(`0 0 ${PIE_VIEW} ${PIE_VIEW}`, series.title)}${svgTitle(series)}${slices}</svg>`;
  const legend = renderLegend(series.points, total, hues);
  return `<div class="chart-pie">${svg}${legend}</div>`;
}

/** Rounds to 4 dp to keep the emitted SVG compact and stable. */
function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function renderLegend(points: ChartPoint[], total: number, hues: readonly AccentHue[]): string {
  const items = points
    .map((point, index) => {
      const value = Math.max(safeNumber(point.value, 0), 0);
      const pct = ((value / total) * 100).toFixed(1);
      // If the value is already a percentage, it IS the proportion — appending
      // "· 52.0%" next to "52%" is redundant, so only add the share for non-% units.
      const share = point.displayValue.includes("%") ? "" : ` · ${pct}%`;
      return (
        `<li class="chart-legend-item"><span class="chart-swatch" style="background:${hueAt(
          hues,
          index
        )}"></span>` +
        `<span class="chart-legend-label">${escapeHtml(point.label)}</span>` +
        `<span class="chart-legend-value">${escapeHtml(point.displayValue)}${escapeHtml(share)}</span></li>`
      );
    })
    .join("");
  return `<ul class="chart-legend">${items}</ul>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function text(x: number, y: number, value: string, className: string): string {
  return `<text x="${svgCoord(x)}" y="${svgCoord(y)}" class="${className}" text-anchor="middle">${escapeHtml(
    value
  )}</text>`;
}

/** Keeps axis labels short so they do not overflow their slot. */
function clip(value: string): string {
  return value.length > AXIS_LABEL_MAX ? `${value.slice(0, AXIS_LABEL_MAX - 1)}…` : value;
}

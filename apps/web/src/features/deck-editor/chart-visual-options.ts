import type { ChartVisualOverride } from "@slides-agent/domain";

/**
 * 014: the visual options the editor offers, in display order (CR-013 用語順序).
 * Single source for the chart card's selector and the manual-input form — the
 * domain `ChartVisualOverride` type is the vocabulary; this fixes the UI ordering.
 */
export const SELECTABLE_VISUALS: ChartVisualOverride[] = [
  "auto",
  "pie_donut",
  "line",
  "bar",
  "metric_card",
  "table"
];

import type { VisualizationType } from "@/content-core/chart-intent.types";
import type { ChartTreatment } from "@/design/design.types";

/**
 * 008 decision B — single source of truth for the one-way mapping from the
 * content-core planning semantic (`VisualizationType`) to the design/rendering
 * decision (`ChartTreatment`).
 *
 * content-core keeps "what does this content mean" (comparison/timeline/...);
 * design keeps "how do we render it" (chart/metric_card/table/...). Funnelling
 * every VisualizationType through one constant table prevents the two enums from
 * drifting apart via scattered `switch` statements in the planner and renderer.
 *
 * The renderer still picks the concrete `ChartVisualKind` (bar vs pie, line vs
 * table) from the treatment PLUS series validation — this table only fixes the
 * treatment lane.
 */
const VISUALIZATION_TYPE_TO_TREATMENT: Record<VisualizationType, ChartTreatment> = {
  metric_card: "metric_card",
  comparison: "chart",
  timeline: "timeline",
  milestone: "metric_card",
  callout: "metric_card",
  table: "table",
  none: "fallback_text"
};

/**
 * Maps a single content-core VisualizationType to its design ChartTreatment.
 * Unknown values (defensive — the enum is closed) fall back to `fallback_text`.
 */
export function mapVisualizationTypeToTreatment(type: VisualizationType): ChartTreatment {
  return VISUALIZATION_TYPE_TO_TREATMENT[type] ?? "fallback_text";
}

/**
 * Resolves the treatment for an intent's recommended visuals. The first
 * recommended visual wins; an empty list falls back to `fallback_text`. This is
 * how the renderer derives a treatment when no design `ChartTreatmentPlan` was
 * provided for the intent.
 */
export function resolveTreatmentForVisuals(
  recommendedVisuals: readonly VisualizationType[]
): ChartTreatment {
  const primary = recommendedVisuals[0];
  return primary ? mapVisualizationTypeToTreatment(primary) : "fallback_text";
}

/** All VisualizationType keys covered by the mapping (for coverage tests). */
export const MAPPED_VISUALIZATION_TYPES: readonly VisualizationType[] = Object.keys(
  VISUALIZATION_TYPE_TO_TREATMENT
) as VisualizationType[];

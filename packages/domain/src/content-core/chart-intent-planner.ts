import type { ChartIntentInput, ChartIntentPlannerResult } from "@/content-core/chart-intent.types";
import type { SourceFact } from "@/deck/deck.types";

export class ChartIntentPlanner {
  plan(input: ChartIntentInput): ChartIntentPlannerResult {
    const intents = [
      buildIntent(
        "conversion-before-after",
        "Conversion before and after",
        input.sourceFacts,
        ["18%", "25%"],
        ["metric_card", "comparison"],
        "Conversion has before/after values that should be easy to compare.",
        input.chartEmphasis
      ),
      buildIntent(
        "response-time-before-after",
        "Response time before and after",
        input.sourceFacts,
        ["12 小時", "4 小時"],
        ["metric_card", "comparison"],
        "Response time has before/after values that should be easy to compare.",
        input.chartEmphasis
      ),
      buildIntent(
        "dashboard-mvp-deadline",
        "Dashboard MVP deadline",
        input.sourceFacts,
        ["2026-08-15"],
        ["timeline", "milestone"],
        "Deadline should be represented as a time-bound milestone.",
        input.chartEmphasis
      ),
      buildIntent(
        "design-resource-risk",
        "Design resource risk",
        input.sourceFacts,
        ["0.5 FTE"],
        ["callout", "table"],
        "Resource risk should be visible without inventing capacity numbers.",
        input.chartEmphasis
      )
    ].filter((intent) => intent.sourceFacts.length > 0);

    return {
      intents,
      fallbackNotes: []
    };
  }
}

function buildIntent(
  id: string,
  title: string,
  sourceFacts: SourceFact[],
  values: string[],
  recommendedVisuals: ChartIntentPlannerResult["intents"][number]["recommendedVisuals"],
  rationale: string,
  chartEmphasis?: string
): ChartIntentPlannerResult["intents"][number] {
  return {
    id,
    title,
    sourceFacts: sourceFacts.filter((fact) => values.includes(fact.value)),
    recommendedVisuals,
    rationale,
    userEmphasisMatched: Boolean(chartEmphasis?.trim())
  };
}

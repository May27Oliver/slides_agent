import type { ChartIntentInput, ChartIntentPlannerResult } from "@/content-core/chart-intent";

export class ChartIntentPlanner {
  plan(_input: ChartIntentInput): ChartIntentPlannerResult {
    throw new Error("ChartIntentPlanner.plan is not implemented yet.");
  }
}

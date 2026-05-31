import type { DesignPlanningInput, DesignPlanningResult } from "@/design/types";

export interface DesignPlanner {
  plan(input: DesignPlanningInput): DesignPlanningResult;
}

export class UiUxProMaxDesignPlanner implements DesignPlanner {
  plan(_input: DesignPlanningInput): DesignPlanningResult {
    throw new Error("UiUxProMaxDesignPlanner.plan is not implemented yet.");
  }
}

import type { DesignPlanningInput, DesignPlanningResult } from "@/design/design.types";

export interface DesignPlanner {
  plan(input: DesignPlanningInput): Promise<DesignPlanningResult>;
}

export interface DesignPlanningGenerationPort {
  generateDesignPlanningResult(input: DesignPlanningInput): Promise<DesignPlanningResult>;
}

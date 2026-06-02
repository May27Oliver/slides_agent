import type { SlideDeck } from "@/deck/deck.types";
import type { DesignPlanningResult } from "@/design/types";

export interface HtmlGenerationPort {
  generateHtml(input: {
    deck: SlideDeck;
    designPlanningResult: DesignPlanningResult;
    prompt: string;
  }): Promise<string>;

  repairHtml?(input: {
    deck: SlideDeck;
    designPlanningResult: DesignPlanningResult;
    invalidHtml: string;
    validationIssues: string[];
  }): Promise<string>;
}

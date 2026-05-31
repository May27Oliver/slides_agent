import type { ChartIntent } from "@/content-core/chart-intent";
import type { SourceContent, SlideDeck } from "@/deck/types";

export interface ContentCorePlannerInput {
  sourceContent: SourceContent;
  purpose: string;
  audience: string;
  chartIntents: ChartIntent[];
}

export interface PlannedContentCore {
  deck: Omit<SlideDeck, "designSystem" | "reviewReport">;
  assumptions: string[];
  omittedOrCompressedContent: string[];
  uncertainClaims: string[];
}

export class ContentCorePlanner {
  plan(_input: ContentCorePlannerInput): PlannedContentCore {
    throw new Error("ContentCorePlanner.plan is not implemented yet.");
  }
}

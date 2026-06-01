import { ChartIntentPlanner } from "@/content-core/chart-intent-planner";
import { extractSourceFacts } from "@/content-core/source-fact-extractor";
import { segmentSourceContent } from "@/content-core/semantic-segmentation-validator";
import { planSemanticSlideTitles } from "@/content-core/semantic-title-planner";
import type { Slide, SlideDeck } from "@/deck/types";
import { defaultDesignSystem } from "@/design/default-design-system";
import { buildReviewReport } from "@/review/review-report-builder";

export interface DeckBrief {
  purpose: string;
  audience: string;
  styleDirection?: string;
  chartEmphasis?: string;
  segmentationGuidance?: string;
  language?: string;
  tone?: string;
}

export interface SlideDeckPlannerInput {
  sourceContent: string;
  deckBrief: DeckBrief;
}

export function planSlideDeck(input: SlideDeckPlannerInput): SlideDeck {
  const segmentation = segmentSourceContent({ sourceContent: input.sourceContent });
  const sections = segmentation.sections;
  const facts = extractSourceFacts(input.sourceContent, sections);
  const titles = planSemanticSlideTitles(sections);
  const chartIntents = new ChartIntentPlanner().plan({
    sourceFacts: facts,
    ...(input.deckBrief.chartEmphasis ? { chartEmphasis: input.deckBrief.chartEmphasis } : {})
  });
  const slides = titles.map<Slide>((title, index) => {
    const section = sections.find((candidate) => candidate.id === title.sourceSectionId);

    return {
      id: `slide_${String(index + 1).padStart(3, "0")}`,
      type: index === 0 ? "metrics" : "content",
      title: title.title,
      message: section?.heading ?? "Planning detail",
      layout: index === 0 ? "metrics-summary" : "content-summary",
      contentBlocks: [
        {
          kind: "bullets",
          content: {
            items: section?.text.split("\n") ?? []
          }
        }
      ],
      sourceTrace: facts
        .filter((fact) => fact.sourceSectionId === section?.id)
        .map((fact) => fact.id)
    };
  });

  return {
    id: "deck_local_001",
    title: documentTitle(input.sourceContent) ?? slides[0]?.title ?? "Generated slide deck",
    purpose: input.deckBrief.purpose,
    audience: input.deckBrief.audience,
    designSystem: defaultDesignSystem(input.deckBrief.styleDirection),
    slides,
    reviewReport: buildReviewReport({
      assumptions: ["Slide titles are deterministic summaries of source sections."],
      omittedOrCompressedContent: [],
      uncertainClaims: [],
      chartingDecisions: chartIntents.intents.map((intent) => ({
        chartIntentId: intent.id,
        decision: `Use ${intent.recommendedVisuals.join(" or ")} for ${intent.title}.`,
        sourceFacts: intent.sourceFacts.map((fact) => fact.value),
        rationale: intent.rationale
      })),
      humanReviewNotes: ["Review generated slide grouping before presentation use."]
    })
  };
}

function documentTitle(sourceContent: string): string | undefined {
  const firstHeading = sourceContent
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => /^#\s+/u.test(line));

  return firstHeading?.replace(/^#\s+/u, "");
}

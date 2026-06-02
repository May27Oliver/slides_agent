import { ChartIntentPlanner } from "@/content-core/chart-intent-planner";
import { extractSourceFacts } from "@/content-core/source-fact-extractor";
import type { SegmentationValidation } from "@/content-core/semantic-segmentation.types";
import { segmentSourceContent } from "@/content-core/semantic-segmentation-validator";
import { compileDeckPlanProposal } from "@/deck/deck-compiler";
import { createDeckPlanProposal } from "@/deck/deck-planner";
import type { SlideDeck } from "@/deck/deck.types";
import type { SlideDeckPlannerInput } from "@/deck/deck-generation.types";
import { buildReviewReport, buildSegmentationReviewNotes } from "@/review/review-report-builder";

export function planSlideDeck(input: SlideDeckPlannerInput): SlideDeck {
  const segmentation = input.sourceSections
    ? {
        sections: input.sourceSections,
        validation: input.segmentationValidation ?? validExternalSegmentation()
      }
    : segmentSourceContent({ sourceContent: input.sourceContent });
  const sections = segmentation.sections;
  const facts = extractSourceFacts(input.sourceContent, sections);
  const chartIntents = new ChartIntentPlanner().plan({
    sourceFacts: facts,
    ...(input.deckBrief.chartEmphasis ? { chartEmphasis: input.deckBrief.chartEmphasis } : {})
  });
  const proposal = createDeckPlanProposal({
    sourceSections: sections,
    sourceFacts: facts,
    chartIntents: chartIntents.intents,
    deckBrief: input.deckBrief
  });
  const reviewReport = buildReviewReport({
    assumptions: [
      "Slide titles and deck grouping are deterministic summaries of source sections.",
      ...proposal.planningNotes
    ],
    omittedOrCompressedContent: [],
    uncertainClaims: [],
    chartingDecisions: chartIntents.intents.map((intent) => ({
      chartIntentId: intent.id,
      decision: `Use ${intent.recommendedVisuals.join(" or ")} for ${intent.title}.`,
      sourceFacts: intent.sourceFacts.map((fact) => fact.value),
      rationale: intent.rationale
    })),
    humanReviewNotes: [
      "Review generated slide grouping before presentation use.",
      ...buildSegmentationReviewNotes(segmentation.validation)
    ]
  });
  const compiled = compileDeckPlanProposal({
    proposal: {
      ...proposal,
      title: documentTitle(input.sourceContent) ?? proposal.title
    },
    sourceSections: sections,
    sourceFacts: facts,
    chartIntents: chartIntents.intents,
    deckBrief: input.deckBrief,
    reviewReport
  });

  if (!compiled.ok) {
    throw new Error(`Deck plan proposal failed validation: ${compiled.issues.join("; ")}`);
  }

  return compiled.slideDeck;
}

function documentTitle(sourceContent: string): string | undefined {
  const firstHeading = sourceContent
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => /^#\s+/u.test(line));

  return firstHeading?.replace(/^#\s+/u, "");
}

function validExternalSegmentation(): SegmentationValidation {
  return {
    schemaValid: true,
    quoteGroundingValid: true,
    sourceOrderValid: true,
    importantContentCoverageValid: true,
    fallbackUsed: false,
    issues: []
  };
}

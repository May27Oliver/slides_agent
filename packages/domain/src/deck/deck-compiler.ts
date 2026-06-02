import type { DeckSlideProposal, Slide } from "@/deck/deck.types";
import type {
  DeckReferenceIndex,
  CompileDeckPlanProposalInput,
  CompileDeckPlanProposalResult
} from "@/deck/deck-compiler.types";
import { buildReviewReport } from "@/review/review-report-builder";

export function compileDeckPlanProposal(
  input: CompileDeckPlanProposalInput
): CompileDeckPlanProposalResult {
  const issues = validateProposalReferences(input);
  if (issues.length > 0) {
    return {
      ok: false,
      fallbackRequired: true,
      issues
    };
  }

  return {
    ok: true,
    slideDeck: {
      id: "deck_local_001",
      title: input.proposal.title,
      ...(input.proposal.subtitle ? { subtitle: input.proposal.subtitle } : {}),
      purpose: input.deckBrief.purpose,
      audience: input.deckBrief.audience,
      slides: input.proposal.slides.map((slide): Slide => {
        const sourceTrace = stableSourceTrace(input, [
          ...slide.sourceSectionIds,
          ...slide.sourceFactIds,
          ...slide.chartIntentIds,
          ...slide.outline.flatMap((item) => item.sourceTrace)
        ]);

        return {
          id: slide.id,
          slideKind: slide.slideKind,
          type: slideTypeFor(slide.slideKind, slide.chartIntentIds.length > 0),
          title: slide.title,
          message: slide.message,
          outline: slide.outline,
          layout: layoutFor(slide.slideKind),
          layoutIntent: slide.layoutIntent,
          contentBlocks: [
            {
              kind: "bullets",
              content: {
                items: slide.outline.map((item) => item.text)
              }
            }
          ],
          sourceTrace,
          speakerNotesDraft: slide.speakerNotesDraft
        };
      }),
      reviewReport:
        input.reviewReport ??
        buildReviewReport({
          assumptions: input.proposal.planningNotes,
          omittedOrCompressedContent: [],
          uncertainClaims: [],
          chartingDecisions: [],
          humanReviewNotes: input.proposal.slides.flatMap((slide) => slide.reviewNotes)
        })
    }
  };
}

function validateProposalReferences(input: CompileDeckPlanProposalInput): string[] {
  const issues = new Set<string>();
  const references = buildReferenceIndex(input);

  for (const slide of input.proposal.slides) {
    addSlideShapeIssues(issues, slide);
    addUnknownReferenceIssues(
      issues,
      slide.sourceSectionIds,
      references.sourceSectionIds,
      "Unknown source section reference"
    );
    addUnknownReferenceIssues(
      issues,
      slide.sourceFactIds,
      references.sourceFactIds,
      "Unknown source fact reference"
    );
    addUnknownReferenceIssues(
      issues,
      slide.chartIntentIds,
      references.chartIntentIds,
      "Unknown chart intent reference"
    );
    addOutlineReferenceIssues(issues, slide, references.traceIds);
  }

  return [...issues];
}

function buildReferenceIndex(input: CompileDeckPlanProposalInput): DeckReferenceIndex {
  const sourceSectionIds = new Set(input.sourceSections.map((section) => section.id));
  const sourceFactIds = new Set(input.sourceFacts.map((fact) => fact.id));
  const chartIntentIds = new Set(input.chartIntents.map((intent) => intent.id));

  return {
    sourceSectionIds,
    sourceFactIds,
    chartIntentIds,
    traceIds: new Set([...sourceSectionIds, ...sourceFactIds, ...chartIntentIds])
  };
}

function addSlideShapeIssues(issues: Set<string>, slide: DeckSlideProposal): void {
  if (slide.slideKind === "content" && slide.sourceSectionIds.length === 0) {
    issues.add(`Content slide requires at least one source section: ${slide.id}`);
  }

  if (slide.outline.length === 0) {
    issues.add(`Slide outline is empty: ${slide.id}`);
  }
}

function addUnknownReferenceIssues(
  issues: Set<string>,
  ids: string[],
  validIds: Set<string>,
  message: string
): void {
  for (const id of ids) {
    if (!validIds.has(id)) {
      issues.add(`${message}: ${id}`);
    }
  }
}

function addOutlineReferenceIssues(
  issues: Set<string>,
  slide: DeckSlideProposal,
  traceIds: Set<string>
): void {
  for (const item of slide.outline) {
    if (item.sourceTrace.length === 0) {
      issues.add(`Outline item requires source trace: ${slide.id}`);
    }

    addUnknownReferenceIssues(
      issues,
      item.sourceTrace,
      traceIds,
      "Unknown outline source trace reference"
    );
  }
}

function stableSourceTrace(input: CompileDeckPlanProposalInput, ids: string[]): string[] {
  const rank = new Map<string, number>();
  for (const [index, section] of input.sourceSections.entries()) {
    rank.set(section.id, index);
  }
  for (const [index, fact] of input.sourceFacts.entries()) {
    rank.set(fact.id, input.sourceSections.length + index);
  }
  for (const [index, intent] of input.chartIntents.entries()) {
    rank.set(intent.id, input.sourceSections.length + input.sourceFacts.length + index);
  }

  return [...new Set(ids)].sort(
    (left, right) => (rank.get(left) ?? 9999) - (rank.get(right) ?? 9999)
  );
}

function slideTypeFor(slideKind: Slide["slideKind"], hasChartIntent: boolean): Slide["type"] {
  if (slideKind === "opening") {
    return "title";
  }
  if (slideKind === "closing") {
    return "action";
  }
  return hasChartIntent ? "metrics" : "content";
}

function layoutFor(slideKind: Slide["slideKind"]): string {
  if (slideKind === "opening") {
    return "title-summary";
  }
  if (slideKind === "closing") {
    return "action-summary";
  }
  return "content-summary";
}

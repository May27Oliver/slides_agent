import type { Deck } from "@/deck-persistence/deck.types";
import type { PreviewJobRequest, PreviewResult } from "@/preview-job/preview-job.types";

export interface CreateDeckFromPreviewInput {
  accountId: string;
  request: PreviewJobRequest;
  result: PreviewResult;
  sourceJobId: string;
}

/**
 * Pure mapping from a successful preview-job result to a persistable Deck (with
 * its first `generation` revision). Title comes from the structured slide deck;
 * html/summary are read defensively from the preview artifact so a shape change
 * degrades gracefully rather than throwing during persistence.
 */
export function createDeckFromPreviewResult(input: CreateDeckFromPreviewInput): Deck {
  const { accountId, request, result, sourceJobId } = input;
  const artifact = (result.previewArtifact ?? {}) as {
    html?: unknown;
    generationSummary?: unknown;
  };

  return {
    accountId,
    title: deckTitle(result.slideDeck),
    status: "ready",
    sourceContent: request.sourceContent,
    deckBrief: request.deckBrief,
    revision: {
      revision: 1,
      slideDeck: result.slideDeck,
      designPlan: result.designPlanningResult ?? null,
      html: typeof artifact.html === "string" ? artifact.html : null,
      generationSummary: artifact.generationSummary ?? null,
      // 010 (C1/FR-006a): persist the chart intents so an edit re-render can redraw
      // the same charts deterministically (no LLM re-derivation). Null when absent.
      chartIntents: result.chartIntents ?? null,
      origin: "generation",
      sourceJobId
    }
  };
}

function deckTitle(slideDeck: unknown): string {
  const title = (slideDeck as { title?: unknown } | null)?.title;
  return typeof title === "string" && title.trim() ? title.trim() : "Untitled deck";
}

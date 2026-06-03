import type {
  DeckOutlinePlanningPort,
  DeckOutlineRefinement,
  DeckOutlineRefinementInput
} from "@slides-agent/domain";
import type { LlmCompletionClient } from "@/adapters/llm/openai-responses.client";

export interface DeckOutlinePlanningAdapterOptions {
  client: LlmCompletionClient;
  model?: string;
}

export interface DeckOutlinePlanningPrompt {
  system: string;
  user: string;
}

export class DeckOutlinePlanningAdapter implements DeckOutlinePlanningPort {
  constructor(private readonly options: DeckOutlinePlanningAdapterOptions) {}

  async refineDeckOutline(input: DeckOutlineRefinementInput): Promise<DeckOutlineRefinement> {
    const prompt = buildDeckOutlinePlanningPrompt(input);
    const rawOutput = await this.options.client.complete({
      ...(this.options.model ? { model: this.options.model } : {}),
      operation: "deck_outline_planning",
      prompt: `${prompt.system}\n\n${prompt.user}`
    });

    return parseDeckOutlineRefinement(rawOutput);
  }
}

export function buildDeckOutlinePlanningPrompt(
  input: DeckOutlineRefinementInput
): DeckOutlinePlanningPrompt {
  return {
    system: [
      "You refine slide outlines for an HTML slide generation flow.",
      "For each slide, write a concise slide title, a one-line key message, and 2-4 bullet points.",
      "Bullets must be complete, readable phrases — never cut a sentence mid-way and never end with an ellipsis.",
      "Stay strictly grounded in SOURCE_SECTIONS: do not invent facts, numbers, owners, dates, or claims.",
      "Every number you write must already appear in SOURCE_SECTIONS.",
      "Preserve the exact slide ids and their order.",
      "Write title, message, and bullets in OUTPUT_LANGUAGE.",
      "Output JSON only, shaped as { \"slides\": [{ \"id\": string, \"title\": string, \"message\": string, \"bullets\": string[] }] }.",
      "Do not wrap the JSON in markdown fences or add commentary."
    ].join("\n"),
    user: [
      "DECK_CONTEXT",
      `purpose: ${input.deckBrief.purpose}`,
      `audience: ${input.deckBrief.audience}`,
      "",
      "OUTPUT_LANGUAGE",
      outputLanguage(input.deckBrief.language),
      "",
      "SLIDES",
      JSON.stringify(
        input.deck.slides.map((slide) => ({
          id: slide.id,
          slideKind: slide.slideKind,
          currentTitle: slide.title,
          currentMessage: slide.message,
          sourceTrace: slide.sourceTrace
        })),
        null,
        2
      ),
      "",
      "SOURCE_SECTIONS",
      JSON.stringify(
        input.sourceSections.map((section) => ({
          id: section.id,
          heading: section.heading,
          text: section.text
        })),
        null,
        2
      )
    ].join("\n")
  };
}

function outputLanguage(language?: string): string {
  return language?.trim() || "Follow the dominant language of SOURCE_SECTIONS.";
}

function parseDeckOutlineRefinement(rawOutput: string): DeckOutlineRefinement {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(rawOutput));
  } catch {
    throw new Error("LLM deck outline planning returned invalid JSON.");
  }

  if (!isDeckOutlineRefinement(parsed)) {
    throw new Error("LLM deck outline planning returned an unexpected shape.");
  }

  return parsed;
}

function isDeckOutlineRefinement(value: unknown): value is DeckOutlineRefinement {
  if (typeof value !== "object" || value === null || !("slides" in value)) {
    return false;
  }

  const { slides } = value as { slides: unknown };
  return (
    Array.isArray(slides) &&
    slides.every(
      (slide) =>
        typeof slide === "object" &&
        slide !== null &&
        typeof (slide as Record<string, unknown>).id === "string" &&
        typeof (slide as Record<string, unknown>).title === "string" &&
        typeof (slide as Record<string, unknown>).message === "string" &&
        Array.isArray((slide as Record<string, unknown>).bullets) &&
        ((slide as Record<string, unknown>).bullets as unknown[]).every(
          (bullet) => typeof bullet === "string"
        )
    )
  );
}

function stripJsonFence(rawOutput: string): string {
  return rawOutput
    .trim()
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "");
}

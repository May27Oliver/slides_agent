import type { SlideDeck } from "@/deck/deck.types";
import type { DesignPlanningResult } from "@/design/types";

export interface HtmlGenerationPromptInput {
  deck: SlideDeck;
  designPlanningResult: DesignPlanningResult;
}

export interface HtmlGenerationPrompt {
  system: string;
  user: string;
  responseContract: string;
}

export function buildHtmlGenerationPrompt(input: HtmlGenerationPromptInput): HtmlGenerationPrompt {
  return {
    system: [
      "Generate self-contained HTML slides from the provided SlideDeck and DesignPlanningResult.",
      "Use no external CSS, JavaScript, image, font, CDN, or backend dependency.",
      "Preserve slide count, slide order, title/message wording, outline meaning, chart numbers/units/context, and review boundaries.",
      "Consume DesignPlanningResult for design system tokens, slide pattern assignments, chart treatment plans, visual hierarchy plans, accessibility notes, and HTML generation constraints.",
      "Do not render speakerNotesDraft in presentation view.",
      "Include keyboard navigation for previous and next slide movement."
    ].join("\n"),
    user: JSON.stringify(
      {
        slideDeck: input.deck,
        designPlanningResult: input.designPlanningResult
      },
      null,
      2
    ),
    responseContract: [
      "Return only complete HTML.",
      "The HTML must include inline CSS and inline JavaScript only.",
      "The HTML must not include markdown fences, commentary, external URLs, or provider metadata."
    ].join("\n")
  };
}

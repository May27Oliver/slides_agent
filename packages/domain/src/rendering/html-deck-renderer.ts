import type { PreviewArtifact, SlideDeck } from "@/deck/deck.types";

export interface HtmlDeckRendererInput {
  deck: SlideDeck;
}

export interface HtmlDeckRenderer {
  render(input: HtmlDeckRendererInput): PreviewArtifact;
}

export class SelfContainedHtmlDeckRenderer implements HtmlDeckRenderer {
  render(_input: HtmlDeckRendererInput): PreviewArtifact {
    throw new Error("SelfContainedHtmlDeckRenderer.render is not implemented yet.");
  }
}

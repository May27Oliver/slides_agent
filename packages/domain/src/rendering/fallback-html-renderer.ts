import type { SlideDeck } from "@/deck/deck.types";
import type { DesignPlanningResult } from "@/design/types";
import { buildDeckCss } from "@/rendering/deck-css";
import { buildDeckNavigationScript } from "@/rendering/deck-navigation-script";

export interface FallbackHtmlRendererInput {
  deck: SlideDeck;
  designPlanningResult: DesignPlanningResult;
}

export function renderFallbackHtmlDeck(input: FallbackHtmlRendererInput): string {
  const css = buildDeckCss(input.designPlanningResult.designSystem);
  const script = buildDeckNavigationScript();

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(input.deck.title)}</title>
  <style>${css}</style>
</head>
<body>
  <main class="deck" aria-label="${escapeHtml(input.deck.title)}">
${input.deck.slides.map((slide) => renderSlide(input, slide.id)).join("\n")}
  </main>
  <script>${script}</script>
</body>
</html>`;
}

function renderSlide(input: FallbackHtmlRendererInput, slideId: string): string {
  const slide = input.deck.slides.find((candidate) => candidate.id === slideId);
  if (!slide) {
    return "";
  }

  const assignment = input.designPlanningResult.slidePatternAssignments.find(
    (candidate) => candidate.slideId === slide.id
  );
  const pattern = assignment?.primaryPattern ?? "content-summary";

  return `    <section class="slide pattern-${escapeAttribute(pattern)}" data-slide-id="${escapeAttribute(slide.id)}" data-pattern="${escapeAttribute(pattern)}">
      <h1>${escapeHtml(slide.title)}</h1>
      <p class="message">${escapeHtml(slide.message)}</p>
      <ul>
${slide.outline.map((item) => `        <li>${escapeHtml(item.text)}</li>`).join("\n")}
      </ul>
    </section>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/\s+/gu, "-");
}

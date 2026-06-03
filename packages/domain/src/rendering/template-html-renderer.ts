import type { Slide, SlideDeck } from "@/deck/deck.types";
import type { DesignPlanningResult } from "@/design/types";
import { resolveStyleKit } from "@/design/default-design-style-kit";
import type { DesignStyleKit } from "@/design/design-style-kit.types";
import { buildDeckRuntimeScript } from "@/rendering/deck-runtime-script";
import { buildDeckStyleCss } from "@/rendering/deck-style-css";
import { cleanDisplayText } from "@/shared/clean-display-text";

export interface TemplateDeckInput {
  deck: SlideDeck;
  designPlanningResult: DesignPlanningResult;
}

/**
 * Deterministic, reference-grade renderer. It is both the conservative fallback
 * for the LLM HTML path and the source of the house style: layered gradient
 * background, one shared title scale, hue-tinted cards, entrance motion with a
 * prefers-reduced-motion guard, and icon-only navigation with progress + dots.
 */
export function renderTemplateDeck(input: TemplateDeckInput): string {
  const styleKit = resolveStyleKit(input.designPlanningResult);
  const css = buildDeckStyleCss(styleKit, input.designPlanningResult.designSystem);
  const script = buildDeckRuntimeScript();
  const total = input.deck.slides.length;
  const fontLink = styleKit.fonts.googleFontsHref
    ? `\n  <link rel="preconnect" href="https://fonts.googleapis.com">\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n  <link href="${escapeAttribute(styleKit.fonts.googleFontsHref)}" rel="stylesheet">`
    : "";

  const slides = input.deck.slides
    .map((slide, index) => renderSlide(input, styleKit, slide, index, total))
    .join("\n");

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(cleanDisplayText(input.deck.title))}</title>${fontLink}
  <style>${css}</style>
</head>
<body>
  <main class="deck" aria-label="${escapeHtml(cleanDisplayText(input.deck.title))}">
    <div class="progress" id="progress"></div>
    <div class="sidedots" id="sidedots" aria-label="slide indicators"></div>
${slides}
    <div class="controls" role="navigation" aria-label="slide navigation">
      <button class="btn" type="button" id="prevBtn" aria-label="上一張投影片">${chevronLeftSvg()}</button>
      <button class="btn" type="button" id="nextBtn" aria-label="下一張投影片">${chevronRightSvg()}</button>
    </div>
  </main>
  <script>${script}</script>
</body>
</html>`;
}

function renderSlide(
  input: TemplateDeckInput,
  styleKit: DesignStyleKit,
  slide: Slide,
  index: number,
  total: number
): string {
  const assignment = input.designPlanningResult.slidePatternAssignments.find(
    (candidate) => candidate.slideId === slide.id
  );
  const pattern = assignment?.primaryPattern ?? "content-summary";
  const layout =
    styleKit.patternLayouts.find((entry) => entry.pattern === pattern)?.layout ?? "title-bullets";
  const isCover = layout === "cover";
  const titleTag = isCover ? "h1" : "h2";
  const classes = [
    "slide",
    `pattern-${escapeAttribute(pattern)}`,
    `layout-${escapeAttribute(layout)}`
  ];
  if (isCover) {
    classes.push("cover");
  }
  if (index === 0) {
    classes.push("active");
  }

  const eyebrow = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  const bullets = slide.outline
    .map(
      (item, itemIndex) =>
        `          <li class="bullet anim" style="--d:${itemIndex + 2}">${escapeHtml(cleanDisplayText(item.text))}</li>`
    )
    .join("\n");

  return `    <section class="${classes.join(" ")}" data-slide-id="${escapeAttribute(slide.id)}" data-pattern="${escapeAttribute(pattern)}" data-bg="${escapeAttribute(layout)}" aria-label="第 ${index + 1} 張：${escapeAttribute(cleanDisplayText(slide.title))}" tabindex="-1">
      <div class="slide-body">
        <span class="eyebrow anim" style="--d:0"><span class="dot"></span>${eyebrow}</span>
        <${titleTag} class="slide-title anim" style="--d:1">${escapeHtml(cleanDisplayText(slide.title))}</${titleTag}>
        <p class="message anim" style="--d:1">${escapeHtml(cleanDisplayText(slide.message))}</p>
        <ul class="bullets">
${bullets}
        </ul>
      </div>
    </section>`;
}

function chevronLeftSvg(): string {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
}

function chevronRightSvg(): string {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
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
  return escapeHtml(value).replace(/\s+/gu, " ").trim();
}

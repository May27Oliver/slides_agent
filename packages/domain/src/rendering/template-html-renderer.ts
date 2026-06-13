import type { ChartIntent } from "@/content-core/chart-intent.types";
import type { Slide, SlideDeck } from "@/deck/deck.types";
import type { ChartTreatmentPlan } from "@/design/design.types";
import type { DesignPlanningResult } from "@/design/types";
import { resolveStyleKit } from "@/design/default-design-style-kit";
import type { DesignStyleKit } from "@/design/design-style-kit.types";
import { renderChartIntent } from "@/rendering/chart-renderer";
import type { RenderedChartSummary } from "@/rendering/chart-rendering.types";
import { buildDeckRuntimeScript } from "@/rendering/deck-runtime-script";
import { buildDeckStyleCss } from "@/rendering/deck-style-css";
import { escapeAttribute, escapeHtml } from "@/rendering/sanitize";
import {
  buildOverrideFontsHref,
  collectOverrideFontFamilies,
  textStyleInlineStyle
} from "@/rendering/text-style-override";
import { cleanDisplayText } from "@/shared/clean-display-text";

export interface TemplateDeckInput {
  deck: SlideDeck;
  designPlanningResult: DesignPlanningResult;
  /**
   * 008: the planned chart intents (carry the source facts). When present, each
   * slide's `chart_placeholder` block is rendered as a real inline SVG/HTML
   * visual; when absent the renderer simply omits charts (backward compatible).
   */
  chartIntents?: ChartIntent[];
}

/**
 * 009: the deck render is the single source of truth for chart visuals. One pass
 * produces both the slide html and the per-chart result evidence
 * (`renderedCharts`), so the control-panel summary and the review notes can never
 * diverge from what was actually drawn.
 */
export interface RenderedTemplateDeck {
  html: string;
  renderedCharts: RenderedChartSummary[];
}

/** 016: the slides-region markup (the `<section class="slide">` blocks joined). */
export interface RenderedSlidesRegion {
  slidesHtml: string;
  renderedCharts: RenderedChartSummary[];
}

/**
 * 016 (FR-005): render ONLY the slide sections — the exact markup `renderTemplateDeck`
 * embeds in its document. The editor preview uses this for in-place updates (postMessage
 * patch) so a patched frame is byte-identical to a full render (no second renderer).
 */
export function renderSlidesRegion(input: TemplateDeckInput): RenderedSlidesRegion {
  const styleKit = resolveStyleKit(input.designPlanningResult);
  const total = input.deck.slides.length;
  const chartContext = buildChartContext(input);
  const rendered = input.deck.slides.map((slide, index) =>
    renderSlide(input, styleKit, slide, index, total, chartContext)
  );
  return {
    slidesHtml: rendered.map((slideRender) => slideRender.html).join("\n"),
    renderedCharts: rendered.flatMap((slideRender) => slideRender.charts)
  };
}

/**
 * Deterministic, reference-grade renderer. It is both the conservative fallback
 * for the LLM HTML path and the source of the house style: layered gradient
 * background, one shared title scale, hue-tinted cards, entrance motion with a
 * prefers-reduced-motion guard, and icon-only navigation with progress + dots.
 */
export function renderTemplateDeck(input: TemplateDeckInput): RenderedTemplateDeck {
  const styleKit = resolveStyleKit(input.designPlanningResult);
  const css = buildDeckStyleCss(styleKit, input.designPlanningResult.designSystem);
  const script = buildDeckRuntimeScript();
  const fontLink = styleKit.fonts.googleFontsHref
    ? `\n  <link rel="preconnect" href="https://fonts.googleapis.com">\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n  <link href="${escapeAttribute(styleKit.fonts.googleFontsHref)}" rel="stylesheet">`
    : "";
  // 015: load every font family used by per-field text-style overrides, so the
  // preview iframe AND the PPTX screenshot render the chosen face (not a fallback).
  const overrideFontsHref = buildOverrideFontsHref(collectOverrideFontFamilies(input.deck));
  const overrideFontLink = overrideFontsHref
    ? `\n  <link href="${escapeAttribute(overrideFontsHref)}" rel="stylesheet">`
    : "";

  // 016: compose the document FROM the shared slides-region renderer so the preview's
  // in-place patch markup and this full html can never drift (parity by construction).
  const { slidesHtml: slides, renderedCharts } = renderSlidesRegion(input);

  const html = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(cleanDisplayText(input.deck.title))}</title>${fontLink}${overrideFontLink}
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

  return { html, renderedCharts };
}

interface RenderedSlide {
  html: string;
  charts: RenderedChartSummary[];
}

function renderSlide(
  input: TemplateDeckInput,
  styleKit: DesignStyleKit,
  slide: Slide,
  index: number,
  total: number,
  chartContext: ChartRenderContext | null
): RenderedSlide {
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

  // 008 layout: a content slide with a chart switches to a chart-feature split
  // (chart on the media side, summary/insight bullets on the text side). The
  // per-value bullets that merely restate the chart's data are dropped — the
  // chart + legend already carry those numbers — so the text side stays a summary.
  const chartIntents = slideChartIntents(slide, chartContext);
  const useChartSplit = chartIntents.length > 0 && !isCover;
  if (useChartSplit) {
    classes.push("has-chart-split");
  }

  const chartValues = new Set(
    chartIntents.flatMap((intent) => intent.sourceFacts.map((fact) => fact.value))
  );
  const visibleOutline = useChartSplit
    ? slide.outline.filter((item) => !bulletEchoesChart(cleanDisplayText(item.text), chartValues))
    : slide.outline;
  // 015 (FR-009/FR-010): per-field text style overrides come from the ONE domain
  // helper; bullets bind by outline id (never by position), so filtering/reorder
  // can't misattach a style.
  const styles = slide.textStyleOverrides;
  const bullets = visibleOutline
    .map((item, itemIndex) => {
      const bulletStyle = appendStyle(
        `--d:${itemIndex + 2}`,
        textStyleInlineStyle(item.id ? styles?.outlineById?.[item.id] : undefined, "bullet")
      );
      return `          <li class="bullet anim" style="${bulletStyle}">${escapeHtml(cleanDisplayText(item.text))}</li>`;
    })
    .join("\n");
  const chartRender = chartContext
    ? renderChartFragments(input, styleKit, chartContext, chartIntents, useChartSplit, slide.id)
    : { html: "", charts: [] as RenderedChartSummary[] };
  const chartsHtml = chartRender.html;

  const messageHtml = escapeHtml(cleanDisplayText(slide.message));
  const titleStyle = appendStyle("--d:1", textStyleInlineStyle(styles?.title, "title"));
  const messageStyle = appendStyle("--d:1", textStyleInlineStyle(styles?.message, "message"));
  // In the chart-feature split the message becomes the prominent right-side
  // takeaway, so it is NOT also shown as a header subtitle (no duplication).
  const headerMessage = useChartSplit
    ? ""
    : `\n        <p class="message anim" style="${messageStyle}">${messageHtml}</p>`;
  const body = useChartSplit
    ? renderChartSplitBody(
        messageHtml,
        textStyleInlineStyle(styles?.message, "message"),
        bullets,
        visibleOutline.length > 0,
        chartsHtml
      )
    : renderStackedBody(bullets, chartsHtml);

  const html = `    <section class="${classes.join(" ")}" data-slide-id="${escapeAttribute(slide.id)}" data-pattern="${escapeAttribute(pattern)}" data-bg="${escapeAttribute(layout)}" aria-label="第 ${index + 1} 張：${escapeAttribute(cleanDisplayText(slide.title))}" tabindex="-1">
      <div class="slide-body">
        <span class="eyebrow anim" style="--d:0"><span class="dot"></span>${eyebrow}</span>
        <${titleTag} class="slide-title anim" style="${titleStyle}">${escapeHtml(cleanDisplayText(slide.title))}</${titleTag}>${headerMessage}
        ${body}
      </div>
    </section>`;

  return { html, charts: chartRender.charts };
}

/** Default layout: bullets, then any charts stacked full-width below. */
function renderStackedBody(bullets: string, chartsHtml: string): string {
  const charts = chartsHtml
    ? `\n        <div class="charts anim" style="--d:2">${chartsHtml}</div>`
    : "";
  return `<ul class="bullets">
${bullets}
        </ul>${charts}`;
}

/**
 * Chart-feature layout: chart on the media side; a weighty takeaway panel on the
 * text side — the slide message as a bold conclusion, with any surviving insight
 * bullets as supporting points — so the two sides carry comparable visual weight.
 */
function renderChartSplitBody(
  messageHtml: string,
  messageStyle: string,
  bullets: string,
  hasInsights: boolean,
  chartsHtml: string
): string {
  const points = hasInsights
    ? `
            <ul class="bullets chart-points">
${bullets}
            </ul>`
    : "";
  // 015: the takeaway IS the slide message, so the message override applies here too.
  const takeawayStyle = messageStyle ? ` style="${messageStyle}"` : "";
  return `<div class="chart-split anim" style="--d:2">
          <div class="chart-split-media"><div class="charts">${chartsHtml}</div></div>
          <div class="chart-split-text">
            <p class="chart-takeaway"${takeawayStyle}>${messageHtml}</p>${points}
          </div>
        </div>`;
}

/** Joins the base animation style with an optional override fragment. */
function appendStyle(base: string, override: string): string {
  return override ? `${base};${override}` : base;
}

/** True when a bullet merely restates one of the chart's data values. */
function bulletEchoesChart(text: string, chartValues: Set<string>): boolean {
  for (const value of chartValues) {
    if (value.length > 0 && text.includes(value)) {
      return true;
    }
  }
  return false;
}

/**
 * 008: per-deck lookup tables for chart rendering. Built once in
 * `renderTemplateDeck` (not per slide) so a many-slide deck does not rebuild the
 * same intent/plan maps for every slide. Null when no chart intents are wired,
 * keeping the renderer backward compatible.
 */
interface ChartRenderContext {
  intentById: Map<string, ChartIntent>;
  planByIntentId: Map<string, ChartTreatmentPlan>;
}

function buildChartContext(input: TemplateDeckInput): ChartRenderContext | null {
  const intents = input.chartIntents;
  if (!intents || intents.length === 0) {
    return null;
  }
  return {
    intentById: new Map(intents.map((intent) => [intent.id, intent])),
    planByIntentId: new Map(
      input.designPlanningResult.chartTreatmentPlans.map((plan) => [plan.chartIntentId, plan])
    )
  };
}

/** 008: the ChartIntents wired to a slide via its `chart_placeholder` blocks. */
function slideChartIntents(slide: Slide, context: ChartRenderContext | null): ChartIntent[] {
  if (!context) {
    return [];
  }
  const intents: ChartIntent[] = [];
  for (const block of slide.contentBlocks) {
    if (block.kind !== "chart_placeholder" || !block.chartIntentId) {
      continue;
    }
    const intent = context.intentById.get(block.chartIntentId);
    if (intent) {
      intents.push(intent);
    }
  }
  return intents;
}

/**
 * Renders the slide's chart intents to sanitized inline SVG/HTML fragments AND,
 * in the same pass, collects each chart's result evidence (009). The html and the
 * `RenderedChartSummary[]` come from the same `renderChartIntent` call, so the
 * deck html, `generationSummary.renderedCharts`, and the review notes cannot drift.
 */
function renderChartFragments(
  input: TemplateDeckInput,
  styleKit: DesignStyleKit,
  context: ChartRenderContext,
  intents: ChartIntent[],
  hideTitle: boolean,
  slideId: string
): { html: string; charts: RenderedChartSummary[] } {
  const fragments: string[] = [];
  const charts: RenderedChartSummary[] = [];
  for (const intent of intents) {
    const plan = context.planByIntentId.get(intent.id);
    const rendered = renderChartIntent({
      intent,
      ...(plan ? { treatmentPlan: plan } : {}),
      styleKit,
      designSystem: input.designPlanningResult.designSystem,
      hideTitle
    });
    if (rendered.html.length === 0) {
      continue;
    }
    fragments.push(rendered.html);
    charts.push({
      slideId,
      chartIntentId: intent.id,
      visualKind: rendered.visualKind,
      // `fallback` is decided once, canonically, by renderChartIntent (single
      // source) — a chart/timeline that didn't draw a real chart, or any degrade.
      fallback: rendered.fallback,
      notes: rendered.notes.map((note) => ({ code: note.code, message: note.message }))
    });
  }
  return { html: fragments.join(""), charts };
}

function chevronLeftSvg(): string {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
}

function chevronRightSvg(): string {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
}

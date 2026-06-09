import { describe, expect, it } from "vitest";
import { renderTemplateDeck } from "@/rendering/template-html-renderer";
import { validateGeneratedHtml } from "@/rendering/html-generation-validator";
import { renderingDeck, renderingDesignPlanningResult } from "./rendering-fixtures";

describe("reference-grade fallback renderer", () => {
  const { html } = renderTemplateDeck({
    deck: renderingDeck,
    designPlanningResult: renderingDesignPlanningResult
  });

  it("loads Google Fonts and applies a shared clamp title scale", () => {
    expect(html).toContain("fonts.googleapis.com");
    expect(html).toContain("--type-title: clamp(");
    expect(html).toContain("--type-cover: clamp(");
    expect(html).toContain('class="slide-title');
  });

  it("uses entrance motion guarded by prefers-reduced-motion", () => {
    expect(html).toContain("@keyframes rise");
    expect(html).toContain("transition:opacity var(--t-dur)");
    expect(html).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("allows a tall active slide to scroll inside the preview viewport", () => {
    expect(html).toContain("justify-content:flex-start;");
    expect(html).toContain("overflow-y:auto;");
    expect(html).toContain("overscroll-behavior:contain;");
    expect(html).toContain("margin:auto 0");
  });

  it("renders icon-only navigation with progress and side dots", () => {
    expect(html).toContain('id="prevBtn"');
    expect(html).toContain('id="nextBtn"');
    expect(html).toContain("<svg");
    expect(html).toContain('id="progress"');
    expect(html).toContain('id="sidedots"');
    expect(html).not.toContain("← 上一張");
  });

  it("keeps numbered action cards and navigation focus visually contained", () => {
    expect(html).toContain(
      ".layout-closing .bullet{counter-increment:step;padding-left:clamp(58px,4vw,74px)}"
    );
    expect(html).toContain("top:clamp(14px,1.8vw,22px);transform:none;");
    expect(html).toContain("--focus-ring:");
    expect(html).toContain(".btn:focus-visible{outline:0;");
  });

  it("strips markdown markers from titles, messages, and bullets", () => {
    const markdownDeck = {
      ...renderingDeck,
      title: "# 面試簡報",
      slides: [
        {
          ...renderingDeck.slides[0]!,
          title: "## 1. 自我介紹",
          message: "- 重點",
          outline: [
            {
              text: "- 第一條重點",
              emphasis: "main_point" as const,
              sourceTrace: ["section_intro"]
            }
          ]
        }
      ]
    };

    const { html: md } = renderTemplateDeck({
      deck: markdownDeck,
      designPlanningResult: renderingDesignPlanningResult
    });

    expect(md).toContain("1. 自我介紹");
    expect(md).toContain("第一條重點");
    expect(md).not.toContain("## 1. 自我介紹");
    expect(md).not.toContain("- 第一條重點");
  });

  it("still passes the self-contained + design + content validation gate", () => {
    const validation = validateGeneratedHtml({
      html,
      deck: renderingDeck,
      designPlanningResult: renderingDesignPlanningResult
    });

    expect(validation.selfContained).toBe(true);
    expect(validation.slideCountAndOrderPreserved).toBe(true);
    expect(validation.contentFidelityPreserved).toBe(true);
    expect(validation.designCompliancePreserved).toBe(true);
    expect(validation.speakerNotesHidden).toBe(true);
    expect(validation.keyboardNavigationPresent).toBe(true);
    expect(validation.status).toBe("pass");
  });
});

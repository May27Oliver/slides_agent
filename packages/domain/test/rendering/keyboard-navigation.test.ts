import { describe, expect, it } from "vitest";
import { renderTemplateDeck } from "@/rendering/template-html-renderer";
import { renderingDeck, renderingDesignPlanningResult } from "./rendering-fixtures";

describe("fallback HTML keyboard navigation", () => {
  it("includes self-contained previous and next keyboard navigation script", () => {
    const { html } = renderTemplateDeck({
      deck: renderingDeck,
      designPlanningResult: renderingDesignPlanningResult
    });

    expect(html).toContain('document.addEventListener("keydown"');
    expect(html).toContain("ArrowRight");
    expect(html).toContain("ArrowLeft");
    expect(html).toContain("PageDown");
    expect(html).toContain("PageUp");
    expect(html).not.toContain("<script src=");
  });

  it("includes an F-key fullscreen toggle", () => {
    const { html } = renderTemplateDeck({
      deck: renderingDeck,
      designPlanningResult: renderingDesignPlanningResult
    });

    expect(html).toContain('event.key === "f"');
    expect(html).toContain('event.key === "F"');
    expect(html).toContain("requestFullscreen");
    expect(html).toContain("exitFullscreen");
  });

  it("broadcasts user navigation to an embedding editor (014 preview→editor sync)", () => {
    const { html } = renderTemplateDeck({
      deck: renderingDeck,
      designPlanningResult: renderingDesignPlanningResult
    });

    // Only user-driven navigation broadcasts; programmatic show()s stay silent so an
    // iframe reload cannot yank the editor's selection back to slide 1.
    expect(html).toContain('"deck:slideChanged"');
    expect(html).toContain("window.parent !== window");
    expect(html).toContain("function next() { show(current + 1); broadcast(); }");
    expect(html).toContain("function prev() { show(current - 1); broadcast(); }");
    expect(html).toContain('data.type === "deck:goToSlide"');
    expect(html).not.toContain("show(data.index); broadcast()");
  });

  it("routes wheel input to the active slide scroll container", () => {
    const { html } = renderTemplateDeck({
      deck: renderingDeck,
      designPlanningResult: renderingDesignPlanningResult
    });

    expect(html).toContain('document.querySelector(".deck")');
    expect(html).toContain("scrollActiveSlide(event.deltaY)");
    expect(html).toContain("event.preventDefault()");
    expect(html).toContain("passive: false");
    expect(html).toContain("slides[current].scrollTop = 0");
  });
});

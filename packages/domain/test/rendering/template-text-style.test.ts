import { describe, expect, it } from "vitest";
import type { Slide, SlideDeck, SlideTextStyleOverrides } from "@/deck/deck.types";
import type { DesignPlanningResult } from "@/design/design.types";
import { renderTemplateDeck } from "@/rendering/template-html-renderer";
import { defaultDesignStyleKit } from "@/design/default-design-style-kit";
import { defaultDesignSystem } from "@/design/default-design-system";

function textSlide(overrides?: SlideTextStyleOverrides): Slide {
  return {
    id: "s1",
    slideKind: "content",
    type: "content",
    title: "標題文字",
    message: "訊息文字",
    outline: [
      { id: "b1", text: "第一條", emphasis: "evidence", sourceTrace: ["f1"] },
      { id: "b2", text: "第二條", emphasis: "evidence", sourceTrace: ["f2"] }
    ],
    layout: "content-summary",
    layoutIntent: { priority: "message_first", density: "medium", emphasis: "narrative" },
    contentBlocks: [],
    sourceTrace: ["f1"],
    speakerNotesDraft: "",
    ...(overrides ? { textStyleOverrides: overrides } : {})
  };
}

function deckOf(slide: Slide): SlideDeck {
  return {
    id: "d",
    title: "deck",
    purpose: "p",
    audience: "a",
    slides: [slide],
    reviewReport: {
      assumptions: [],
      omittedOrCompressedContent: [],
      uncertainClaims: [],
      chartingDecisions: [],
      humanReviewNotes: []
    }
  };
}

function planningResult(): DesignPlanningResult {
  return {
    designSystem: defaultDesignSystem(),
    slidePatternAssignments: [],
    chartTreatmentPlans: [],
    visualHierarchyPlans: [],
    accessibilityNotes: {
      minContrastRatio: 4.5,
      colorContrastNotes: [],
      readingOrderNotes: [],
      keyboardNavigationNotes: [],
      manualVerificationNotes: []
    },
    designReviewNotes: {
      styleDirectionInterpretation: [],
      visualDensityDecision: "",
      rejectedSuggestions: [],
      htmlGenerationConstraints: [],
      manualVerificationNotes: []
    },
    consistencyValidation: { ok: true, checkedSlideIds: [], issues: [], fallbackUsed: false },
    styleKit: defaultDesignStyleKit()
  };
}

function render(slide: Slide): string {
  return renderTemplateDeck({
    deck: deckOf(slide),
    designPlanningResult: planningResult(),
    chartIntents: []
  }).html;
}

/**
 * 015 US3 (FR-009, research R3): the renderer injects per-field inline overrides from
 * the ONE domain helper. Because the server save path and the client live preview run
 * this same renderer, asserting here covers both sides (parity by construction).
 */
describe("renderTemplateDeck text style overrides (015 US3)", () => {
  it("renders without overrides byte-identical to a deck without the field (regression)", () => {
    expect(render(textSlide())).toBe(render(textSlide(undefined)));
  });

  it("injects title size+color into the slide-title style", () => {
    const html = render(textSlide({ title: { sizeLevel: "XL", colorToken: "accent" } }));
    expect(html).toContain(
      '<h2 class="slide-title anim" style="--d:1;font-size:calc(var(--type-title) * 1.6);color:var(--accent)">標題文字</h2>'
    );
  });

  it("injects message color into the header message style", () => {
    const html = render(textSlide({ message: { colorToken: "text" } }));
    expect(html).toContain('<p class="message anim" style="--d:1;color:var(--text)">訊息文字</p>');
  });

  it("binds bullet overrides by outline id, not position", () => {
    const html = render(textSlide({ outlineById: { b2: { sizeLevel: "L" } } }));
    // b1 keeps the plain animation style; b2 carries the override.
    expect(html).toContain('<li class="bullet anim" style="--d:2">第一條</li>');
    expect(html).toContain(
      '<li class="bullet anim" style="--d:3;font-size:calc(var(--type-bullet) * 1.25)">第二條</li>'
    );
  });

  it("ignores override entries whose outline id does not exist", () => {
    const html = render(textSlide({ outlineById: { ghost: { sizeLevel: "XL" } } }));
    expect(html).not.toContain("font-size:calc(var(--type-bullet)");
  });
});

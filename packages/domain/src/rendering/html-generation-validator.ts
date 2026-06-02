import type { SlideDeck } from "@/deck/deck.types";
import type { DesignPlanningResult } from "@/design/types";
import type { HtmlGenerationValidation } from "@/rendering/html-generation.types";

export interface HtmlGenerationValidationInput {
  html: string;
  deck: SlideDeck;
  designPlanningResult: DesignPlanningResult;
}

export function validateGeneratedHtml(
  input: HtmlGenerationValidationInput
): HtmlGenerationValidation {
  const externalResourceIssues = validateSelfContained(input.html);
  const slideOrderIssues = validateSlideCountAndOrder(input);
  const contentIssues = validateContentFidelity(input);
  const designIssues = validateDesignCompliance(input);
  const speakerNotesHidden = validateSpeakerNotesHidden(input);
  const keyboardNavigationPresent = validateKeyboardNavigation(input.html);

  const selfContained = externalResourceIssues.length === 0;
  const slideCountAndOrderPreserved = slideOrderIssues.length === 0;
  const contentFidelityPreserved = contentIssues.length === 0;
  const designCompliancePreserved = designIssues.length === 0;

  const pass =
    selfContained &&
    slideCountAndOrderPreserved &&
    contentFidelityPreserved &&
    designCompliancePreserved &&
    speakerNotesHidden &&
    keyboardNavigationPresent;

  return {
    status: pass ? "pass" : "repair_required",
    selfContained,
    slideCountAndOrderPreserved,
    contentFidelityPreserved,
    designCompliancePreserved,
    speakerNotesHidden,
    keyboardNavigationPresent,
    externalResourceIssues,
    contentIssues: [...slideOrderIssues, ...contentIssues],
    designIssues,
    repairAttempted: false,
    fallbackUsed: false
  };
}

function validateSelfContained(html: string): string[] {
  if (/(https?:\/\/|\/\/|<link\b|<script[^>]+src=|<img[^>]+src=|href=["'][^"']+)/iu.test(html)) {
    return ["External resource reference found."];
  }

  return [];
}

function validateSlideCountAndOrder(input: HtmlGenerationValidationInput): string[] {
  const actualSlideIds = [...input.html.matchAll(/data-slide-id=["']([^"']+)["']/giu)].map(
    (match) => match[1]
  );
  const expectedSlideIds = input.deck.slides.map((slide) => slide.id);

  return actualSlideIds.join("|") === expectedSlideIds.join("|")
    ? []
    : [
        `Slide count/order mismatch. Expected ${expectedSlideIds.join(", ")}, found ${actualSlideIds.join(", ")}.`
      ];
}

function validateContentFidelity(input: HtmlGenerationValidationInput): string[] {
  const issues: string[] = [];

  for (const slide of input.deck.slides) {
    if (!input.html.includes(slide.title)) {
      issues.push(`Missing slide title in HTML: ${slide.id}`);
    }
    if (!input.html.includes(slide.message)) {
      issues.push(`Missing slide message in HTML: ${slide.id}`);
    }
    for (const item of slide.outline) {
      if (!input.html.includes(item.text)) {
        issues.push(`Missing slide outline item in HTML: ${slide.id}`);
      }
    }
  }

  if (/data-unsupported-fact=["']true["']/iu.test(input.html)) {
    issues.push("Unsupported fact marker found in HTML.");
  }

  return issues;
}

function validateDesignCompliance(input: HtmlGenerationValidationInput): string[] {
  const issues: string[] = [];

  for (const assignment of input.designPlanningResult.slidePatternAssignments) {
    const expected = `data-pattern="${assignment.primaryPattern}"`;
    const slideMarker = `data-slide-id="${assignment.slideId}"`;

    if (!input.html.includes(slideMarker) || !input.html.includes(expected)) {
      issues.push(
        `Missing design pattern assignment in HTML: ${assignment.slideId} -> ${assignment.primaryPattern}`
      );
    }
  }

  for (const hierarchy of input.designPlanningResult.visualHierarchyPlans) {
    if (!input.html.includes(hierarchy.primaryMessage)) {
      issues.push(`Missing primary visual hierarchy message in HTML: ${hierarchy.slideId}`);
    }
  }

  return issues;
}

function validateSpeakerNotesHidden(input: HtmlGenerationValidationInput): boolean {
  return input.deck.slides.every(
    (slide) => !slide.speakerNotesDraft || !input.html.includes(slide.speakerNotesDraft)
  );
}

function validateKeyboardNavigation(html: string): boolean {
  return html.includes("keydown") && html.includes("ArrowRight") && html.includes("ArrowLeft");
}

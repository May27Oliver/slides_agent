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

// Only the curated webfont CDNs are permitted; everything else external is
// blocked. Inline SVG namespaces (xmlns="http://...") and internal anchors
// (href="#...") are self-contained and never flagged. Exact hostnames only —
// never a substring match, so fonts.googleapis.com.evil.com is rejected.
const ALLOWED_FONT_HOSTS = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);
const EXTERNAL_URL_SOURCE = String.raw`(?:https?:)?//[^"')\s>]+`;

function validateSelfContained(html: string): string[] {
  // External or data-URI scripts are never allowed; all JavaScript must be inline.
  if (/<script\b[^>]*\bsrc\s*=\s*["']?\s*(?:(?:https?:)?\/\/|data:|javascript:)/iu.test(html)) {
    return ["External resource reference found."];
  }

  // Active-content schemes are never allowed in any attribute or url() context
  // (data: images stay allowed; only executable schemes are blocked here).
  if (/(?:\b(?:href|src)\s*=|url\()\s*["']?\s*(?:javascript|vbscript):/iu.test(html)) {
    return ["External resource reference found."];
  }

  const externalUrls = collectExternalResourceUrls(html);
  const hasDisallowed = externalUrls.some((url) => !isAllowedFontUrl(url));

  return hasDisallowed ? ["External resource reference found."] : [];
}

function isAllowedFontUrl(url: string): boolean {
  try {
    const normalized = url.startsWith("//") ? `https:${url}` : url;
    return ALLOWED_FONT_HOSTS.has(new URL(normalized).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function collectExternalResourceUrls(html: string): string[] {
  const patterns: RegExp[] = [
    new RegExp(String.raw`\b(?:href|src)\s*=\s*["']?\s*(${EXTERNAL_URL_SOURCE})`, "giu"),
    new RegExp(String.raw`@import\s+(?:url\()?\s*["']?\s*(${EXTERNAL_URL_SOURCE})`, "giu"),
    new RegExp(String.raw`\burl\(\s*["']?\s*(${EXTERNAL_URL_SOURCE})`, "giu")
  ];

  const urls: string[] = [];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      if (match[1]) {
        urls.push(match[1]);
      }
    }
  }
  return urls;
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
  const visibleText = visibleTextContent(input.html);

  for (const slide of input.deck.slides) {
    if (!containsNormalizedText(visibleText, slide.title)) {
      issues.push(`Missing slide title in HTML: ${slide.id}`);
    }
    if (!containsNormalizedText(visibleText, slide.message)) {
      issues.push(`Missing slide message in HTML: ${slide.id}`);
    }
    const outlineRequired = Math.max(1, Math.ceil(slide.outline.length / 2));
    const outlineMatched = slide.outline.filter((item) =>
      containsNormalizedText(visibleText, item.text)
    ).length;
    if (slide.outline.length > 0 && outlineMatched < outlineRequired) {
      issues.push(
        `Insufficient slide outline coverage in HTML: ${slide.id} (${outlineMatched}/${slide.outline.length})`
      );
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
    if (!slideHasPattern(input.html, assignment.slideId, assignment.primaryPattern)) {
      issues.push(
        `Missing design pattern assignment in HTML: ${assignment.slideId} -> ${assignment.primaryPattern}`
      );
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

function visibleTextContent(html: string): string {
  return normalizeText(
    decodeHtmlEntities(
      html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
        .replace(/<[^>]+>/gu, " ")
    )
  );
}

function containsNormalizedText(visibleText: string, expected: string): boolean {
  const normalizedExpected = normalizeText(expected);
  return normalizedExpected.length === 0 || visibleText.includes(normalizedExpected);
}

function slideHasPattern(html: string, slideId: string, pattern: string): boolean {
  return sectionAttributes(html).some(
    (attributes) =>
      attributeValue(attributes, "data-slide-id") === slideId &&
      attributeValue(attributes, "data-pattern") === pattern
  );
}

function sectionAttributes(html: string): string[] {
  return [...html.matchAll(/<section\b([^>]*)>/giu)].map((match) => match[1] ?? "");
}

function attributeValue(attributes: string, name: string): string | undefined {
  const escapedName = escapeRegExp(name);
  const match = attributes.match(new RegExp(`\\b${escapedName}\\s*=\\s*(['"])(.*?)\\1`, "iu"));
  return match?.[2];
}

function normalizeText(value: string): string {
  return decodeHtmlEntities(value).replace(/\s+/gu, " ").trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

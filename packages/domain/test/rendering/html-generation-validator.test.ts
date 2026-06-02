import { describe, expect, it } from "vitest";
import { validateGeneratedHtml } from "@/rendering/html-generation-validator";
import { renderingDeck, renderingDesignPlanningResult, validHtml } from "./rendering-fixtures";

describe("HTML generation validator", () => {
  it("rejects unsafe resources, reordered or drifted content, design drift, and rendered speaker notes", () => {
    const invalidHtml = validHtml
      .replace("<style>", '<link rel="stylesheet" href="https://cdn.example.com/deck.css"><style>')
      .replace('data-slide-id="slide_001"', 'data-slide-id="slide_999"')
      .replace("目標: conversion and response time", "Invented title")
      .replace('data-pattern="metric-comparison"', 'data-pattern="unrelated-editorial"')
      .replace("</section>", `${renderingDeck.slides[0]?.speakerNotesDraft}</section>`);

    const validation = validateGeneratedHtml({
      html: invalidHtml,
      deck: renderingDeck,
      designPlanningResult: renderingDesignPlanningResult
    });

    expect(validation.status).toBe("repair_required");
    expect(validation.selfContained).toBe(false);
    expect(validation.slideCountAndOrderPreserved).toBe(false);
    expect(validation.contentFidelityPreserved).toBe(false);
    expect(validation.designCompliancePreserved).toBe(false);
    expect(validation.speakerNotesHidden).toBe(false);
    expect(validation.externalResourceIssues).toContain("External resource reference found.");
    expect(validation.contentIssues).toContain("Missing slide title in HTML: slide_001");
    expect(validation.designIssues).toContain(
      "Missing design pattern assignment in HTML: slide_001 -> metric-comparison"
    );
  });
});

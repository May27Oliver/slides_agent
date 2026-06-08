import { describe, expect, it } from "vitest";
import { renderTemplateDeck } from "@/rendering/template-html-renderer";
import { renderingDeck, renderingDesignPlanningResult } from "./rendering-fixtures";

describe("fallback HTML speaker notes visibility", () => {
  it("does not render speakerNotesDraft in presentation view", () => {
    const { html } = renderTemplateDeck({
      deck: renderingDeck,
      designPlanningResult: renderingDesignPlanningResult
    });

    expect(html).toContain("目標: conversion and response time");
    expect(html).toContain("Onboarding conversion 從 18% 提升到 25%");
    expect(html).not.toContain(renderingDeck.slides[0]?.speakerNotesDraft);
    expect(html).not.toContain("speakerNotesDraft");
  });
});

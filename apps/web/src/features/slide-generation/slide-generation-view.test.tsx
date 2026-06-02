// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SlideGenerationFeature } from "@/features/slide-generation/SlideGenerationFeature";

const previewArtifact = {
  slideDeck: {
    title: "PM planning review",
    slides: [
      {
        id: "slide_001",
        title: "PM planning review",
        message: "Planning summary"
      }
    ],
    reviewReport: {
      assumptions: ["Use source order for the first slice."],
      omittedOrCompressedContent: [],
      uncertainClaims: [],
      chartingDecisions: [],
      humanReviewNotes: []
    }
  },
  designPlanningResult: {
    designSystem: {
      themeName: "llm-designed-operational-review",
      visualDensity: "high",
      chartStyle: "ui-ux-pro-max-dashboard"
    },
    slidePatternAssignments: [
      {
        slideId: "slide_001",
        primaryPattern: "title-summary"
      }
    ]
  },
  previewArtifact: {
    html: "<!doctype html><html><body>PM planning review</body></html>",
    htmlGenerationValidation: {
      status: "fallback_used",
      selfContained: true,
      repairAttempted: false,
      fallbackUsed: true
    },
    generationSummary: {
      slideCount: 1,
      sourceFactCount: 1,
      chartIntentCount: 0,
      uncertainClaimCount: 0
    }
  }
};

describe("slide generation view", () => {
  it("displays generated preview, design planning, HTML validation, and summary artifacts", () => {
    render(<SlideGenerationFeature initialPreview={previewArtifact} />);

    expect(screen.getByRole("heading", { name: "生成可預覽的 HTML 簡報" })).toBeTruthy();
    expect(screen.getByLabelText("原始內容")).toBeTruthy();
    expect(screen.getByLabelText("簡報用途")).toBeTruthy();
    expect(screen.getByLabelText("目標受眾")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "簡報預覽" })).toBeTruthy();
    expect(screen.getAllByText("PM planning review").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "設計規劃" })).toBeTruthy();
    expect(screen.getByText("llm-designed-operational-review")).toBeTruthy();
    expect(screen.getByText("title-summary")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "HTML 驗證" })).toBeTruthy();
    expect(screen.getByText("fallback_used")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "產生摘要" })).toBeTruthy();
    expect(screen.getByText("簡報頁數")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "審閱報告" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "簡報 JSON" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /下載 HTML/ })).toBeTruthy();
  });
});

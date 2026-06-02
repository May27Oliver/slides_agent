import { describe, expect, it } from "vitest";
import { SlidesController } from "../src/modules/slides/slides.controller";

const previewRequest = {
  sourceContent: "Onboarding conversion 從 18% 提升到 25%",
  deckBrief: {
    purpose: "PM planning review",
    audience: "Product and engineering leads",
    styleDirection: "高密度 PM planning deck",
    chartEmphasis: "Highlight KPI changes",
    language: "zh-TW"
  }
};

const previewResponse = {
  slideDeck: {
    id: "deck_local_001"
  },
  designPlanningResult: {
    designSystem: {
      themeName: "fallback"
    }
  },
  previewArtifact: {
    html: "<!doctype html><html><body></body></html>",
    htmlGenerationValidation: {
      status: "fallback_used",
      selfContained: true,
      slideCountAndOrderPreserved: true,
      contentFidelityPreserved: true,
      designCompliancePreserved: true,
      speakerNotesHidden: true,
      keyboardNavigationPresent: true,
      externalResourceIssues: [],
      contentIssues: [],
      designIssues: [],
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

describe("POST /api/slides/preview contract", () => {
  it("delegates validated preview generation and returns slide, design, HTML validation, and summary artifacts", async () => {
    const service = {
      generatePreview: async (request: typeof previewRequest) => {
        expect(request).toEqual(previewRequest);
        return previewResponse;
      }
    };
    const controller = new SlidesController(service);

    await expect(controller.preview(previewRequest)).resolves.toEqual(previewResponse);
  });

  it("rejects unsupported request fields through the runtime contract validator before service execution", async () => {
    const service = {
      generatePreview: async () => {
        throw new Error("service should not be called for invalid requests");
      }
    };
    const controller = new SlidesController(service);

    await expect(
      controller.preview({
        ...previewRequest,
        deckBrief: {
          ...previewRequest.deckBrief,
          tone: "friendly"
        }
      })
    ).rejects.toMatchObject({
      response: {
        code: "UNSUPPORTED_OPTION",
        fields: ["deckBrief.tone"]
      },
      status: 400
    });
  });
});

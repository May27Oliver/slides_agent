import { beforeEach, describe, expect, it, vi } from "vitest";

const generatePreviewDeck = vi.fn();
const segmentSourceContentWithRepair = vi.fn();

vi.mock("@slides-agent/domain", () => ({
  generatePreviewDeck,
  segmentSourceContentWithRepair,
  UiUxProMaxDesignPlanner: class {
    async plan() {
      return {
        designSystem: { themeName: "fallback" },
        consistencyValidation: { fallbackUsed: true }
      };
    }
  },
  LlmAssistedHtmlDeckGenerator: class {
    async generate() {
      return {
        html: "<!doctype html><html><body>slides</body></html>",
        htmlGenerationValidation: { fallbackUsed: true },
        generationSummary: {
          slideCount: 1,
          sourceFactCount: 1,
          chartIntentCount: 0,
          uncertainClaimCount: 0
        }
      };
    }
  }
}));

describe("SlidesService semantic segmentation wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    segmentSourceContentWithRepair.mockResolvedValue({
      sections: [
        {
          id: "segment_001",
          heading: "目標",
          text: "Onboarding conversion 從 18% 提升到 25%",
          segmentationSource: "llm"
        }
      ],
      validation: {
        schemaValid: true,
        quoteGroundingValid: true,
        sourceOrderValid: true,
        importantContentCoverageValid: true,
        fallbackUsed: false,
        issues: []
      }
    });
    generatePreviewDeck.mockReturnValue({
      slideDeck: {
        id: "deck_local_001",
        slides: [{ id: "slide_001", sourceTrace: ["segment_001"] }]
      },
      chartIntents: [],
      generationSummary: {
        slideCount: 1,
        sourceFactCount: 1,
        chartIntentCount: 0,
        uncertainClaimCount: 0
      }
    });
  });

  it("uses backend semantic segmentation before deck/design/html generation when ports are configured", async () => {
    const { SlidesService } = await import("../src/modules/slides/slides.service");
    const service = new SlidesService(
      undefined,
      undefined,
      { segment: async () => ({ segments: [], globalWarnings: [] }) },
      { repair: async () => ({ segments: [], globalWarnings: [] }) }
    );

    const result = await service.generatePreview({
      sourceContent: "Onboarding conversion 從 18% 提升到 25%",
      deckBrief: {
        purpose: "PM planning review",
        audience: "Product and engineering leads",
        styleDirection: "高密度 PM planning deck",
        chartEmphasis: "Highlight KPI changes",
        segmentationGuidance: "依照語意切段"
      }
    });

    expect(segmentSourceContentWithRepair).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceContent: "Onboarding conversion 從 18% 提升到 25%",
        purpose: "PM planning review",
        audience: "Product and engineering leads",
        segmentationGuidance: "依照語意切段"
      })
    );
    expect(generatePreviewDeck).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceSections: [
          {
            id: "segment_001",
            heading: "目標",
            text: "Onboarding conversion 從 18% 提升到 25%",
            segmentationSource: "llm"
          }
        ],
        segmentationValidation: expect.objectContaining({
          fallbackUsed: false
        })
      })
    );
    expect(result.slideDeck.slides[0]?.sourceTrace).toContain("segment_001");
  });

  it("maps upstream generation failures to sanitized HTTP errors", async () => {
    const { SlidesService } = await import("../src/modules/slides/slides.service");
    segmentSourceContentWithRepair.mockRejectedValue(
      new Error("OpenAI raw provider message with request internals")
    );
    const service = new SlidesService(
      undefined,
      undefined,
      { segment: async () => ({ segments: [], globalWarnings: [] }) },
      { repair: async () => ({ segments: [], globalWarnings: [] }) }
    );

    await expect(
      service.generatePreview({
        sourceContent: "Onboarding conversion 從 18% 提升到 25%",
        deckBrief: {
          purpose: "PM planning review",
          audience: "Product and engineering leads"
        }
      })
    ).rejects.toMatchObject({
      response: {
        message: "Preview generation failed",
        code: "PREVIEW_GENERATION_FAILED"
      },
      status: 502
    });
  });
});

import { describe, expect, it } from "vitest";
import { loadPendingModule } from "./support/pending-module";

interface PreviewRequestModule {
  validateGeneratePreviewRequest(input: unknown): PreviewRequestValidationResult;
}

type PreviewRequestValidationResult =
  | {
      ok: true;
      value: {
        sourceContent: string;
        deckBrief: Record<string, unknown>;
      };
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        fields: string[];
      };
    };

function expectOk(
  result: PreviewRequestValidationResult
): asserts result is Extract<PreviewRequestValidationResult, { ok: true }> {
  expect(result.ok).toBe(true);
}

async function loadPreviewRequestModule(): Promise<PreviewRequestModule> {
  return loadPendingModule<PreviewRequestModule>("@/preview-request");
}

describe("Generate preview request contract", () => {
  it("accepts pasted source content with purpose, audience, style direction, and chart emphasis", async () => {
    const { validateGeneratePreviewRequest } = await loadPreviewRequestModule();

    const result = validateGeneratePreviewRequest({
      sourceContent: "Q3 planning notes",
      deckBrief: {
        purpose: "PM planning review",
        audience: "Product and engineering leads",
        styleDirection: "高密度 PM planning deck",
        chartEmphasis: "Highlight KPI changes and schedule risks",
        segmentationGuidance: "Group by goals, decisions, risks, constraints, and next steps",
        language: "zh-TW"
      }
    });

    expectOk(result);
    expect(result.value).not.toHaveProperty("options");
  });

  it("rejects missing source content, purpose, or audience with machine-readable fields", async () => {
    const { validateGeneratePreviewRequest } = await loadPreviewRequestModule();

    const result = validateGeneratePreviewRequest({
      sourceContent: "   ",
      deckBrief: {
        purpose: "",
        audience: ""
      }
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "sourceContent, purpose, and audience are required",
        fields: ["sourceContent", "deckBrief.purpose", "deckBrief.audience"]
      }
    });
  });

  it("does not add backend-owned generation settings to the accepted request", async () => {
    const { validateGeneratePreviewRequest } = await loadPreviewRequestModule();

    const result = validateGeneratePreviewRequest({
      sourceContent: "Q3 planning notes",
      deckBrief: {
        purpose: "PM planning review",
        audience: "Product and engineering leads"
      }
    });

    expectOk(result);
    expect(result.value).not.toHaveProperty("options");
  });

  it("rejects the legacy options field because generation settings are backend-configured", async () => {
    const { validateGeneratePreviewRequest } = await loadPreviewRequestModule();

    const result = validateGeneratePreviewRequest({
      sourceContent: "Q3 planning notes",
      deckBrief: {
        purpose: "PM planning review",
        audience: "Product and engineering leads"
      },
      options: {
        generationEngine: "custom",
        designSkillEnabled: false
      }
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "UNSUPPORTED_OPTION",
        message: "Generation settings are backend-configured and cannot be set in request",
        fields: ["options"]
      }
    });
  });

  it("rejects tone because it has no generation consumer in this slice", async () => {
    const { validateGeneratePreviewRequest } = await loadPreviewRequestModule();

    const result = validateGeneratePreviewRequest({
      sourceContent: "Q3 planning notes",
      deckBrief: {
        purpose: "PM planning review",
        audience: "Product and engineering leads",
        tone: "direct"
      }
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "UNSUPPORTED_OPTION",
        message: "Unsupported deck brief fields are not accepted by this generation slice",
        fields: ["deckBrief.tone"]
      }
    });
  });
});

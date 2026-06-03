import { describe, expect, it } from "vitest";
import { loadLlmRuntimeConfig } from "../src/config/llm.config";

describe("LLM runtime config", () => {
  it("uses operation-specific models and keeps missing API key as local fallback mode", () => {
    const config = loadLlmRuntimeConfig(
      {
        LLM_PROVIDER: "openai",
        LLM_MODEL: "default-model",
        SEMANTIC_SEGMENTATION_MODEL: "segmentation-model",
        DESIGN_PLANNING_MODEL: "design-model",
        LLM_MAX_REPAIR_ATTEMPTS: "1"
      },
      { readDotEnv: false }
    );

    expect(config.provider).toBe("openai");
    expect(config.defaultModel).toBe("default-model");
    expect(config.semanticSegmentationModel).toBe("segmentation-model");
    expect(config.designPlanningModel).toBe("design-model");
    expect(config.hasOpenAiApiKey).toBe(false);
    expect(config.maxRepairAttempts).toBe(1);
  });

  it("rejects unsupported providers before any adapter call", () => {
    expect(() =>
      loadLlmRuntimeConfig({ LLM_PROVIDER: "unsupported" }, { readDotEnv: false })
    ).toThrow("Unsupported LLM_PROVIDER");
  });
});

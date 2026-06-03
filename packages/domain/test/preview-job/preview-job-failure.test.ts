import { describe, expect, it } from "vitest";
import { createGenerationFailure } from "../../src";

describe("preview job failure sanitization", () => {
  it("does not expose provider raw errors, prompts, API keys, model ids, or stack traces", () => {
    const failure = createGenerationFailure(
      new Error("OpenAI sk-secret raw prompt stack trace model=gpt-internal"),
      "design_planning"
    );

    expect(failure).toEqual({
      code: "PREVIEW_GENERATION_FAILED",
      message: "Preview generation failed.",
      failedStage: "design_planning",
      retryable: true,
      retryGuidance: "Create a new preview job."
    });
    expect(JSON.stringify(failure)).not.toMatch(/sk-secret|raw prompt|stack trace|gpt-internal/i);
  });
});

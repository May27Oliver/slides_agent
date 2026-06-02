import { describe, expect, it } from "vitest";
import { OpenAiResponsesClient } from "../src/adapters/llm/openai-responses.client";

describe("OpenAiResponsesClient", () => {
  it("passes an abort signal to the fetch implementation when a timeout is configured", async () => {
    let signal: AbortSignal | undefined;
    const client = new OpenAiResponsesClient({
      config: {
        provider: "openai",
        defaultModel: "test-model",
        openAiApiKey: "test-key",
        hasOpenAiApiKey: true,
        maxRepairAttempts: 1,
        requestTimeoutMs: 250
      },
      fetchImpl: async (_url, init) => {
        signal = init?.signal as AbortSignal | undefined;
        return new Response(JSON.stringify({ output_text: "ok" }), { status: 200 });
      }
    });

    await expect(
      client.complete({
        operation: "semantic_segmentation",
        prompt: "Return JSON."
      })
    ).resolves.toBe("ok");
    expect(signal).toBeInstanceOf(AbortSignal);
  });
});

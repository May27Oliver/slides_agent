import { describe, expect, it } from "vitest";
import { OpenAiResponsesClient } from "../src/adapters/llm/openai-responses.client";

describe("OpenAiResponsesClient", () => {
  it("does not pass an abort signal so LLM calls can wait for provider responses", async () => {
    let signal: AbortSignal | undefined;
    const logger = testLogger();
    const client = new OpenAiResponsesClient({
      config: {
        provider: "openai",
        defaultModel: "test-model",
        openAiApiKey: "test-key",
        hasOpenAiApiKey: true,
        maxRepairAttempts: 1
      },
      logger,
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
    expect(signal).toBeUndefined();
    expect(logger.messages).toEqual([
      "[OpenAiResponsesClient] operation=semantic_segmentation status=start model=test-model",
      expect.stringMatching(
        /^\[OpenAiResponsesClient\] operation=semantic_segmentation status=success duration_ms=\d+ output_chars=2$/
      )
    ]);
    expect(logger.messages.join("\n")).not.toContain("Return JSON.");
    expect(logger.messages.join("\n")).not.toContain("test-key");
  });

  it("logs safe failed-call diagnostics without raw provider details", async () => {
    const logger = testLogger();
    const client = new OpenAiResponsesClient({
      config: {
        provider: "openai",
        defaultModel: "test-model",
        openAiApiKey: "test-key",
        hasOpenAiApiKey: true,
        maxRepairAttempts: 1
      },
      logger,
      fetchImpl: async () =>
        new Response(
          JSON.stringify({ error: { message: "raw provider stack prompt sk-secret" } }),
          { status: 500 }
        )
    });

    await expect(
      client.complete({
        operation: "html_generation",
        prompt: "Generate HTML."
      })
    ).rejects.toThrow("status 500");

    expect(logger.messages).toEqual([
      "[OpenAiResponsesClient] operation=html_generation status=start model=test-model",
      expect.stringMatching(
        /^\[OpenAiResponsesClient\] operation=html_generation status=failed reason=provider_http_error http_status=500 duration_ms=\d+$/
      )
    ]);
    expect(logger.messages.join("\n")).not.toMatch(/raw provider|stack|prompt|sk-secret/i);
  });
});

function testLogger() {
  const messages: string[] = [];
  return {
    messages,
    log: (message: string) => messages.push(message),
    error: (message: string) => messages.push(message)
  };
}

import { describe, expect, it } from "vitest";
import { HtmlGenerationAdapter } from "../src/adapters/html-generation/html-generation.adapter";

describe("HTML generation adapter", () => {
  it("forwards backend-owned model configuration and prompt text without exposing provider fields", async () => {
    const calls: unknown[] = [];
    const adapter = new HtmlGenerationAdapter({
      model: "html-model",
      client: {
        complete: async (input) => {
          calls.push(input);
          return "<!doctype html><html><body>slides</body></html>";
        }
      }
    });

    const html = await adapter.generateHtml({
      deck: { id: "deck_001" } as never,
      designPlanningResult: { designSystem: { themeName: "design" } } as never,
      prompt: "Generate self-contained HTML from SlideDeck and DesignPlanningResult."
    });

    expect(html).toContain("<!doctype html>");
    expect(calls).toEqual([
      {
        model: "html-model",
        operation: "html_generation",
        prompt: "Generate self-contained HTML from SlideDeck and DesignPlanningResult."
      }
    ]);
    expect(JSON.stringify(calls)).not.toContain("provider");
  });

  it("builds bounded repair instructions from validation issues without changing slide semantics", async () => {
    const calls: Array<{ prompt: string; operation: string }> = [];
    const adapter = new HtmlGenerationAdapter({
      model: "html-model",
      client: {
        complete: async (input) => {
          calls.push({ prompt: input.prompt, operation: input.operation });
          return "<!doctype html><html><body>repaired</body></html>";
        }
      }
    });

    await adapter.repairHtml({
      deck: { id: "deck_001" } as never,
      designPlanningResult: { designSystem: { themeName: "design" } } as never,
      invalidHtml: '<html><script src="https://cdn.example/app.js"></script></html>',
      validationIssues: ["External script is not allowed."]
    });

    expect(calls[0]?.operation).toBe("html_repair");
    expect(calls[0]?.prompt).toContain("Repair HTML/contract/design compliance only.");
    expect(calls[0]?.prompt).toContain("Do not reinterpret source content.");
    expect(calls[0]?.prompt).toContain("External script is not allowed.");
  });

  it("does not read process.env as a secondary model source", async () => {
    const previousModel = process.env.HTML_GENERATION_MODEL;
    process.env.HTML_GENERATION_MODEL = "env-html-model";
    const calls: unknown[] = [];
    const adapter = new HtmlGenerationAdapter({
      client: {
        complete: async (input) => {
          calls.push(input);
          return "<!doctype html><html><body>slides</body></html>";
        }
      }
    });

    await adapter.generateHtml({
      deck: { id: "deck_001" } as never,
      designPlanningResult: { designSystem: { themeName: "design" } } as never,
      prompt: "Generate self-contained HTML."
    });

    expect(calls).toEqual([
      {
        operation: "html_generation",
        prompt: "Generate self-contained HTML."
      }
    ]);
    if (previousModel === undefined) {
      delete process.env.HTML_GENERATION_MODEL;
    } else {
      process.env.HTML_GENERATION_MODEL = previousModel;
    }
  });
});

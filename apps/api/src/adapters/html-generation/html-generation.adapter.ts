import type { HtmlGenerationPort } from "@slides-agent/domain";

type HtmlGenerationOperation = "html_generation" | "html_repair";

export interface HtmlGenerationClient {
  complete(input: {
    model?: string;
    operation: HtmlGenerationOperation;
    prompt: string;
  }): Promise<string>;
}

export interface HtmlGenerationAdapterOptions {
  client: HtmlGenerationClient;
  model?: string;
}

export class HtmlGenerationAdapter implements HtmlGenerationPort {
  constructor(private readonly options: HtmlGenerationAdapterOptions) {}

  async generateHtml(input: Parameters<HtmlGenerationPort["generateHtml"]>[0]): Promise<string> {
    return this.options.client.complete({
      ...modelOption(this.options.model),
      operation: "html_generation",
      prompt: input.prompt
    });
  }

  async repairHtml(
    input: Parameters<NonNullable<HtmlGenerationPort["repairHtml"]>>[0]
  ): Promise<string> {
    return this.options.client.complete({
      ...modelOption(this.options.model),
      operation: "html_repair",
      prompt: buildHtmlRepairPrompt(input)
    });
  }
}

function modelOption(configuredModel?: string): { model?: string } {
  return configuredModel ? { model: configuredModel } : {};
}

function buildHtmlRepairPrompt(
  input: Parameters<NonNullable<HtmlGenerationPort["repairHtml"]>>[0]
): string {
  return [
    "Repair HTML/contract/design compliance only.",
    "Do not reinterpret source content.",
    "Do not rewrite slide title, message, outline semantics, chart numbers, units, periods, denominators, or context.",
    "Do not add unsupported facts.",
    "Return one self-contained HTML document with no external CSS, JavaScript, image, font, CDN, or backend dependency.",
    "",
    "VALIDATION_ISSUES",
    input.validationIssues.join("\n"),
    "",
    "SLIDE_DECK",
    JSON.stringify(input.deck, null, 2),
    "",
    "DESIGN_PLANNING_RESULT",
    JSON.stringify(input.designPlanningResult, null, 2),
    "",
    "INVALID_HTML",
    input.invalidHtml
  ].join("\n");
}

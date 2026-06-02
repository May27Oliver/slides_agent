import type {
  DesignPlanningGenerationPort,
  DesignPlanningInput,
  DesignPlanningResult
} from "@slides-agent/domain";
import type { LlmCompletionClient } from "@/adapters/llm/openai-responses.client";
import {
  buildUiUxProMaxDesignPlanningPrompt,
  designPlanningResponseFormat
} from "./ui-ux-pro-max.prompt";

export { buildUiUxProMaxDesignPlanningPrompt } from "./ui-ux-pro-max.prompt";

export interface UiUxProMaxDesignPlanningAdapterOptions {
  client: LlmCompletionClient;
  model?: string;
}

export class UiUxProMaxDesignPlanningAdapter implements DesignPlanningGenerationPort {
  constructor(private readonly options: UiUxProMaxDesignPlanningAdapterOptions) {}

  async generateDesignPlanningResult(input: DesignPlanningInput): Promise<DesignPlanningResult> {
    const rawResult = await this.options.client.complete({
      ...(this.options.model ? { model: this.options.model } : {}),
      operation: "design_planning",
      prompt: buildUiUxProMaxDesignPlanningPrompt(input),
      responseFormat: designPlanningResponseFormat()
    });

    return parseDesignPlanningResult(rawResult);
  }
}

function parseDesignPlanningResult(rawResult: string): DesignPlanningResult {
  const json = stripJsonFence(rawResult);

  try {
    return removeNullOptionalFields(JSON.parse(json)) as DesignPlanningResult;
  } catch {
    throw new Error("LLM design planning returned invalid JSON.");
  }
}

function stripJsonFence(rawResult: string): string {
  return rawResult
    .trim()
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "");
}

function removeNullOptionalFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(removeNullOptionalFields);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key, fieldValue]) =>
            !(fieldValue === null && (key === "fallbackRationale" || key === "fallbackReason"))
        )
        .map(([key, fieldValue]) => [key, removeNullOptionalFields(fieldValue)])
    );
  }

  return value;
}

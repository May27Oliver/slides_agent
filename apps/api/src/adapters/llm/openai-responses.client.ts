import type { LlmRuntimeConfig } from "@/config/llm.config";

export type LlmOperation =
  | "semantic_segmentation"
  | "semantic_segmentation_repair"
  | "design_planning"
  | "html_generation"
  | "html_repair";

export interface JsonSchemaResponseFormat {
  type: "json_schema";
  name: string;
  strict: true;
  schema: Record<string, unknown>;
}

export interface LlmCompletionInput {
  model?: string;
  operation: LlmOperation;
  prompt: string;
  responseFormat?: JsonSchemaResponseFormat;
}

export interface LlmCompletionClient {
  complete(input: LlmCompletionInput): Promise<string>;
}

interface OpenAiResponsesClientOptions {
  config: LlmRuntimeConfig;
  fetchImpl?: typeof fetch;
}

interface OpenAiResponseBody {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
}

export class OpenAiResponsesClient implements LlmCompletionClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: OpenAiResponsesClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async complete(input: LlmCompletionInput): Promise<string> {
    const model = input.model ?? this.options.config.defaultModel;
    if (!model) {
      throw new Error(`No LLM model configured for ${input.operation}.`);
    }
    if (!this.options.config.openAiApiKey) {
      throw new Error("OPENAI_API_KEY is required for OpenAI LLM calls.");
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.options.config.requestTimeoutMs);

    const response = await this.fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.config.openAiApiKey}`,
        "Content-Type": "application/json"
      },
      signal: abortController.signal,
      body: JSON.stringify({
        model,
        input: input.prompt,
        ...(input.responseFormat
          ? {
              text: {
                format: input.responseFormat
              }
            }
          : {})
      })
    }).finally(() => clearTimeout(timeout));

    const body = (await response.json()) as OpenAiResponseBody;
    if (!response.ok) {
      throw new Error(`OpenAI Responses API request failed with status ${response.status}.`);
    }

    return extractOutputText(body);
  }
}

function extractOutputText(body: OpenAiResponseBody): string {
  if (body.output_text) {
    return body.output_text;
  }

  const contentText =
    body.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((text): text is string => Boolean(text))
      .join("") ?? "";

  if (!contentText) {
    throw new Error("OpenAI Responses API returned no text output.");
  }

  return contentText;
}

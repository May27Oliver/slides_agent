import type { LlmRuntimeConfig } from "@/config/llm.config";
import { Logger } from "@nestjs/common";

export type LlmOperation =
  | "semantic_segmentation"
  | "semantic_segmentation_repair"
  | "deck_outline_planning"
  | "design_planning";

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
  logger?: Pick<Logger, "log" | "error">;
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

    const startedAt = Date.now();
    const logger = this.diagnosticLogger();
    logger.log(`[OpenAiResponsesClient] operation=${input.operation} status=start model=${model}`);

    try {
      const response = await this.fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.config.openAiApiKey}`,
          "Content-Type": "application/json"
        },
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
      });

      const body = (await response.json()) as OpenAiResponseBody;
      if (!response.ok) {
        throw new Error(`OpenAI Responses API request failed with status ${response.status}.`);
      }

      const output = extractOutputText(body);
      logger.log(
        `[OpenAiResponsesClient] operation=${input.operation} status=success duration_ms=${Date.now() - startedAt} output_chars=${output.length}`
      );
      return output;
    } catch (error) {
      logger.error(
        `[OpenAiResponsesClient] operation=${input.operation} status=failed ${safeFailureReason(error)} duration_ms=${Date.now() - startedAt}`
      );
      throw error;
    }
  }

  private diagnosticLogger(): Pick<Logger, "log" | "error"> {
    return this.options.logger ?? new Logger(OpenAiResponsesClient.name);
  }
}

function safeFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const status = message.match(/\bstatus\s+(\d{3})\b/i)?.[1];
  if (status) {
    return `reason=provider_http_error http_status=${status}`;
  }

  if (/no text output/i.test(message)) {
    return "reason=empty_output";
  }

  return "reason=provider_error";
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

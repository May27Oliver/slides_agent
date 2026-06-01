import type { GeneratePreviewRequestContract } from "@/index";

export interface ContractError {
  code: "INVALID_INPUT" | "UNSUPPORTED_OPTION";
  message: string;
  fields: string[];
}

export type PreviewRequestValidationResult =
  | {
      ok: true;
      value: GeneratePreviewRequestContract;
    }
  | {
      ok: false;
      error: ContractError;
    };

interface RawGeneratePreviewRequest {
  sourceContent?: unknown;
  deckBrief?: RawDeckBrief;
  options?: unknown;
}

type OptionalDeckBriefKey =
  | "styleDirection"
  | "chartEmphasis"
  | "segmentationGuidance"
  | "language"
  | "tone";

export function validateGeneratePreviewRequest(input: unknown): PreviewRequestValidationResult {
  if (!isRawGeneratePreviewRequest(input)) {
    return invalidInput(["sourceContent", "deckBrief.purpose", "deckBrief.audience"]);
  }

  const sourceContent = readString(input.sourceContent);
  const deckBrief = input.deckBrief;
  const purpose = deckBrief ? readString(deckBrief.purpose) : "";
  const audience = deckBrief ? readString(deckBrief.audience) : "";
  const missingFields = [
    sourceContent.trim() ? undefined : "sourceContent",
    purpose.trim() ? undefined : "deckBrief.purpose",
    audience.trim() ? undefined : "deckBrief.audience"
  ].filter((field): field is string => Boolean(field));

  if (missingFields.length > 0) {
    return invalidInput(missingFields);
  }

  if (input.options !== undefined) {
    return unsupportedOption(["options"]);
  }

  return {
    ok: true,
    value: {
      sourceContent,
      deckBrief: deckBriefValue(deckBrief, purpose, audience)
    }
  };
}

interface RawDeckBrief {
  purpose?: unknown;
  audience?: unknown;
  styleDirection?: unknown;
  chartEmphasis?: unknown;
  segmentationGuidance?: unknown;
  language?: unknown;
  tone?: unknown;
}

function deckBriefValue(
  deckBrief: RawDeckBrief | undefined,
  purpose: string,
  audience: string
): GeneratePreviewRequestContract["deckBrief"] {
  const result: GeneratePreviewRequestContract["deckBrief"] = { purpose, audience };

  for (const [key, value] of optionalDeckBriefEntries(deckBrief)) {
    result[key] = value;
  }

  return result;
}

function optionalDeckBriefEntries(
  deckBrief: RawDeckBrief | undefined
): Array<[OptionalDeckBriefKey, string]> {
  if (!deckBrief) {
    return [];
  }

  return [
    ["styleDirection", readOptionalString(deckBrief.styleDirection)],
    ["chartEmphasis", readOptionalString(deckBrief.chartEmphasis)],
    ["segmentationGuidance", readOptionalString(deckBrief.segmentationGuidance)],
    ["language", readOptionalString(deckBrief.language)],
    ["tone", readOptionalString(deckBrief.tone)]
  ].filter((entry): entry is [OptionalDeckBriefKey, string] => Boolean(entry[1]));
}

function invalidInput(fields: string[]): PreviewRequestValidationResult {
  return {
    ok: false,
    error: {
      code: "INVALID_INPUT",
      message: "sourceContent, purpose, and audience are required",
      fields
    }
  };
}

function unsupportedOption(fields: string[]): PreviewRequestValidationResult {
  return {
    ok: false,
    error: {
      code: "UNSUPPORTED_OPTION",
      message: "Generation settings are backend-configured and cannot be set in request",
      fields
    }
  };
}

function isRawGeneratePreviewRequest(value: unknown): value is RawGeneratePreviewRequest {
  if (!isRecord(value)) {
    return false;
  }

  return optionalRecord(value.deckBrief);
}

function optionalRecord(value: unknown): value is Record<string, unknown> | undefined {
  return value === undefined || isRecord(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

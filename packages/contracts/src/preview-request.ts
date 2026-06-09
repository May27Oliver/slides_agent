import type { GeneratePreviewRequestContract } from "./index";
import { parseThemeSelection } from "./theme-selection";

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
  themeSelection?: unknown;
}

type OptionalDeckBriefKey =
  | "styleDirection"
  | "chartEmphasis"
  | "segmentationGuidance"
  | "language";

// Upper bound on raw source text. Source content is fanned out verbatim into
// several chained LLM calls, so an uncapped input is a runaway-cost vector.
const MAX_SOURCE_CONTENT_CHARS = 50_000;

// deckBrief fields also flow into LLM prompts; cap them to bound cost and limit
// the prompt-injection surface.
const MAX_DECK_BRIEF_FIELD_CHARS = 2_000;

const supportedDeckBriefKeys = new Set([
  "purpose",
  "audience",
  "styleDirection",
  "chartEmphasis",
  "segmentationGuidance",
  "language"
]);

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

  if (sourceContent.length > MAX_SOURCE_CONTENT_CHARS) {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: `sourceContent exceeds the maximum of ${MAX_SOURCE_CONTENT_CHARS} characters`,
        fields: ["sourceContent"]
      }
    };
  }

  const overlongField = firstOverlongDeckBriefField(purpose, audience, deckBrief);
  if (overlongField) {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: `${overlongField} exceeds the maximum of ${MAX_DECK_BRIEF_FIELD_CHARS} characters`,
        fields: [overlongField]
      }
    };
  }

  if (input.options !== undefined) {
    return unsupportedOption(["options"]);
  }

  const unsupportedDeckBriefFields = unsupportedDeckBriefFieldPaths(deckBrief);
  if (unsupportedDeckBriefFields.length > 0) {
    return unsupportedDeckBriefOption(unsupportedDeckBriefFields);
  }

  const themeSelection = parseThemeSelection(input.themeSelection);
  if (!themeSelection.ok) {
    return invalidInput(themeSelection.fields);
  }

  return {
    ok: true,
    value: {
      sourceContent,
      deckBrief: deckBriefValue(deckBrief, purpose, audience),
      ...(themeSelection.value ? { themeSelection: themeSelection.value } : {})
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
    ["language", readOptionalString(deckBrief.language)]
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

function unsupportedDeckBriefOption(fields: string[]): PreviewRequestValidationResult {
  return {
    ok: false,
    error: {
      code: "UNSUPPORTED_OPTION",
      message: "Unsupported deck brief fields are not accepted by this generation slice",
      fields
    }
  };
}

function firstOverlongDeckBriefField(
  purpose: string,
  audience: string,
  deckBrief: RawDeckBrief | undefined
): string | undefined {
  const fields: Array<[string, string]> = [
    ["deckBrief.purpose", purpose],
    ["deckBrief.audience", audience],
    ["deckBrief.styleDirection", readString(deckBrief?.styleDirection)],
    ["deckBrief.chartEmphasis", readString(deckBrief?.chartEmphasis)],
    ["deckBrief.segmentationGuidance", readString(deckBrief?.segmentationGuidance)],
    ["deckBrief.language", readString(deckBrief?.language)]
  ];

  return fields.find(([, value]) => value.length > MAX_DECK_BRIEF_FIELD_CHARS)?.[0];
}

function unsupportedDeckBriefFieldPaths(deckBrief: RawDeckBrief | undefined): string[] {
  if (!deckBrief) {
    return [];
  }

  return Object.keys(deckBrief)
    .filter((key) => !supportedDeckBriefKeys.has(key))
    .map((key) => `deckBrief.${key}`);
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

import type {
  SegmentedSourceContent,
  SegmentationValidation,
  SemanticSegment,
  SemanticSegmentationOutput
} from "@/content-core/semantic-segmentation.types";
import { parseSourceSections } from "@/content-core/source-parser";

interface ValidateSemanticSegmentsInput {
  sourceContent: string;
  segments: Array<{
    id: string;
    heading: string;
    sourceQuotes: Array<{ text: string; role: string }>;
    order: number;
  }>;
}

interface SegmentSourceContentInput {
  sourceContent: string;
  llmOutput?: unknown;
}

const supportedQuoteRoles = new Set(["heading", "body", "bullet", "table", "quote"]);
const supportedConfidence = new Set(["high", "medium", "low"]);

export function validateSemanticSegments(
  input: ValidateSemanticSegmentsInput
): SegmentationValidation {
  return validateSegments(input.sourceContent, input.segments);
}

export function segmentSourceContent(input: SegmentSourceContentInput): SegmentedSourceContent {
  const parsedOutput = parseSemanticSegmentationOutput(input.llmOutput);
  if (!parsedOutput) {
    return fallbackSegment(input.sourceContent, [
      "semantic segmentation output is missing or invalid"
    ]);
  }

  const validation = validateSegments(input.sourceContent, parsedOutput.segments);
  if (!canUseLlmSegments(validation)) {
    return fallbackSegment(input.sourceContent, validation.issues);
  }

  return {
    sections: parsedOutput.segments.map((segment, index) => ({
      id: segment.id,
      heading: segment.heading,
      text: segment.sourceQuotes.map((quote) => quote.text.trim()).join("\n"),
      segmentationSource: "llm" as const,
      order: index + 1
    })),
    validation
  };
}

function validateSegments(
  sourceContent: string,
  segments: ValidateSemanticSegmentsInput["segments"]
): SegmentationValidation {
  const issues: string[] = [];
  let schemaValid = true;
  let quoteGroundingValid = true;
  let sourceOrderValid = true;
  const normalizedSource = normalizeText(sourceContent);
  let previousQuoteIndex = -1;

  if (segments.length === 0) {
    schemaValid = false;
    issues.push("semantic segmentation must contain at least one segment");
  }

  for (const [index, segment] of segments.entries()) {
    if (!isValidSegmentShape(segment)) {
      schemaValid = false;
      issues.push(`segment ${index + 1} does not match semantic segmentation shape`);
      continue;
    }

    for (const quote of segment.sourceQuotes) {
      const quoteText = normalizeText(quote.text);
      const quoteIndex = normalizedSource.indexOf(quoteText);
      if (quoteIndex < 0) {
        quoteGroundingValid = false;
        issues.push(`source quote does not exact-match source content: ${quote.text}`);
        continue;
      }

      if (quoteIndex < previousQuoteIndex) {
        sourceOrderValid = false;
        issues.push(`source quote appears out of order: ${quote.text}`);
      }
      previousQuoteIndex = quoteIndex;
    }
  }

  const importantContentCoverageValid = quoteGroundingValid && sourceOrderValid;

  return {
    schemaValid,
    quoteGroundingValid,
    sourceOrderValid,
    importantContentCoverageValid,
    fallbackUsed: false,
    issues
  };
}

function fallbackSegment(sourceContent: string, issues: string[]): SegmentedSourceContent {
  return {
    sections: parseSourceSections(sourceContent).map((section) => ({
      ...section,
      segmentationSource: "deterministic_fallback" as const
    })),
    validation: {
      schemaValid: false,
      quoteGroundingValid: false,
      sourceOrderValid: false,
      importantContentCoverageValid: false,
      fallbackUsed: true,
      issues
    }
  };
}

function canUseLlmSegments(validation: SegmentationValidation): boolean {
  return (
    validation.schemaValid &&
    validation.quoteGroundingValid &&
    validation.sourceOrderValid &&
    validation.importantContentCoverageValid
  );
}

function parseSemanticSegmentationOutput(input: unknown): SemanticSegmentationOutput | undefined {
  if (!isRecord(input) || !Array.isArray(input.segments) || !Array.isArray(input.globalWarnings)) {
    return undefined;
  }

  if (!input.segments.every(isFullSemanticSegment)) {
    return undefined;
  }

  if (!input.globalWarnings.every((warning) => typeof warning === "string")) {
    return undefined;
  }

  return {
    segments: input.segments,
    globalWarnings: input.globalWarnings
  };
}

function isValidSegmentShape(segment: ValidateSemanticSegmentsInput["segments"][number]): boolean {
  return (
    typeof segment.id === "string" &&
    typeof segment.heading === "string" &&
    Number.isInteger(segment.order) &&
    Array.isArray(segment.sourceQuotes) &&
    segment.sourceQuotes.length > 0 &&
    segment.sourceQuotes.every(
      (quote) =>
        typeof quote.text === "string" &&
        quote.text.length > 0 &&
        typeof quote.role === "string" &&
        supportedQuoteRoles.has(quote.role)
    )
  );
}

function isFullSemanticSegment(value: unknown): value is SemanticSegment {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.heading === "string" &&
    Array.isArray(value.sourceQuotes) &&
    value.sourceQuotes.every(
      (quote) =>
        isRecord(quote) &&
        typeof quote.text === "string" &&
        typeof quote.role === "string" &&
        supportedQuoteRoles.has(quote.role)
    ) &&
    typeof value.summary === "string" &&
    Number.isInteger(value.order) &&
    typeof value.rationale === "string" &&
    typeof value.confidence === "string" &&
    supportedConfidence.has(value.confidence) &&
    Array.isArray(value.warnings) &&
    value.warnings.every((warning) => typeof warning === "string")
  );
}

function normalizeText(value: string): string {
  return value.replace(/\r\n/gu, "\n").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const SEMANTIC_SEGMENTATION_SCHEMA_ID = "urn:slides-agent:contracts:semantic-segmentation";

export interface ContractValidationError {
  path: string;
  message: string;
}

export interface SemanticSegmentationValidationResult {
  ok: boolean;
  errors: ContractValidationError[];
}

const ROOT_KEYS = new Set(["segments", "globalWarnings"]);
const SEGMENT_KEYS = new Set([
  "id",
  "heading",
  "sourceQuotes",
  "summary",
  "order",
  "rationale",
  "confidence",
  "warnings"
]);
const SOURCE_QUOTE_KEYS = new Set(["text", "role"]);

const SOURCE_QUOTE_ROLES = new Set(["heading", "body", "bullet", "table", "quote"]);
const CONFIDENCE_VALUES = new Set(["high", "medium", "low"]);
const SEGMENT_ID_PATTERN = /^segment_[0-9]{3}$/u;

export function validateSemanticSegmentationOutput(
  input: unknown
): SemanticSegmentationValidationResult {
  const errors: ContractValidationError[] = [];

  if (!isRecord(input)) {
    return {
      ok: false,
      errors: [{ path: "", message: "Semantic segmentation output must be an object" }]
    };
  }

  assertOnlyKeys(input, ROOT_KEYS, "", errors);
  validateSegments(input.segments, errors);
  validateStringArray(
    input.globalWarnings,
    "/globalWarnings",
    "globalWarnings",
    "global warning",
    errors
  );

  return {
    ok: errors.length === 0,
    errors
  };
}

function validateSegments(value: unknown, errors: ContractValidationError[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push({ path: "/segments", message: "segments must be a non-empty array" });
    return;
  }

  value.forEach((segment, index) => validateSegment(segment, index, errors));
}

function validateSegment(segment: unknown, index: number, errors: ContractValidationError[]): void {
  const path = `/segments/${index}`;
  if (!isRecord(segment)) {
    errors.push({ path, message: "segment must be an object" });
    return;
  }

  assertOnlyKeys(segment, SEGMENT_KEYS, path, errors);
  requireString(segment.id, `${path}/id`, errors, SEGMENT_ID_PATTERN);
  requireString(segment.heading, `${path}/heading`, errors);
  requireString(segment.summary, `${path}/summary`, errors);
  requireString(segment.rationale, `${path}/rationale`, errors);
  requireIntegerAtLeast(segment.order, `${path}/order`, 1, "order must be an integer >= 1", errors);
  requireEnum(
    segment.confidence,
    `${path}/confidence`,
    CONFIDENCE_VALUES,
    "confidence must be high, medium, or low",
    errors
  );

  validateSourceQuotes(segment.sourceQuotes, `${path}/sourceQuotes`, errors);
  validateStringArray(segment.warnings, `${path}/warnings`, "warnings", "warning", errors);
}

function validateSourceQuotes(
  value: unknown,
  path: string,
  errors: ContractValidationError[]
): void {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push({
      path,
      message: "sourceQuotes must be a non-empty array"
    });
    return;
  }

  value.forEach((quote, index) => validateSourceQuote(quote, `${path}/${index}`, errors));
}

function validateSourceQuote(
  quote: unknown,
  path: string,
  errors: ContractValidationError[]
): void {
  if (!isRecord(quote)) {
    errors.push({ path, message: "source quote must be an object" });
    return;
  }

  assertOnlyKeys(quote, SOURCE_QUOTE_KEYS, path, errors);
  requireString(quote.text, `${path}/text`, errors);
  requireEnum(
    quote.role,
    `${path}/role`,
    SOURCE_QUOTE_ROLES,
    "role must be a supported quote role",
    errors
  );
}

function validateStringArray(
  value: unknown,
  path: string,
  arrayName: string,
  itemName: string,
  errors: ContractValidationError[]
): void {
  if (!Array.isArray(value)) {
    errors.push({ path, message: `${arrayName} must be an array` });
    return;
  }

  value.forEach((item, index) => {
    if (typeof item !== "string") {
      errors.push({
        path: `${path}/${index}`,
        message: `${itemName} must be a string`
      });
    }
  });
}

function assertOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: Set<string>,
  path: string,
  errors: ContractValidationError[]
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push({
        path: `${path}/${key}`,
        message: "additional property is not allowed"
      });
    }
  }
}

function requireIntegerAtLeast(
  value: unknown,
  path: string,
  minimum: number,
  message: string,
  errors: ContractValidationError[]
): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    errors.push({ path, message });
  }
}

function requireEnum(
  value: unknown,
  path: string,
  allowedValues: Set<string>,
  message: string,
  errors: ContractValidationError[]
): void {
  if (typeof value !== "string" || !allowedValues.has(value)) {
    errors.push({ path, message });
  }
}

function requireString(
  value: unknown,
  path: string,
  errors: ContractValidationError[],
  pattern?: RegExp
): void {
  if (typeof value !== "string" || value.length === 0) {
    errors.push({ path, message: "value must be a non-empty string" });
    return;
  }

  if (pattern && !pattern.test(value)) {
    errors.push({ path, message: "value does not match required pattern" });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * OpenAPI 3 schema objects for the public preview API, kept here in the shared
 * contracts package (next to the types and runtime validator) so the docs come
 * from the same source as the contract instead of drifting in controller
 * decorators. Plain JSON-Schema objects — framework-agnostic, consumable by
 * @nestjs/swagger's `@ApiBody({ schema })` / `@ApiResponse({ schema })`.
 */
export type OpenApiSchema = Record<string, unknown>;

const MAX_SOURCE_CONTENT_CHARS = 50_000;
const MAX_DECK_BRIEF_FIELD_CHARS = 2_000;

const PREVIEW_JOB_STATUSES = ["queued", "running", "succeeded", "failed", "expired"];
const PREVIEW_JOB_STAGES = [
  "request_accepted",
  "queued",
  "content_planning",
  "deck_planning",
  "design_planning",
  "html_generation",
  "html_validation",
  "repair_or_fallback",
  "completed",
  "failed"
];

const briefField = (): OpenApiSchema => ({ type: "string", maxLength: MAX_DECK_BRIEF_FIELD_CHARS });

export const DECK_BRIEF_SCHEMA: OpenApiSchema = {
  type: "object",
  required: ["purpose", "audience"],
  additionalProperties: false,
  properties: {
    purpose: briefField(),
    audience: briefField(),
    styleDirection: briefField(),
    chartEmphasis: briefField(),
    segmentationGuidance: briefField(),
    language: briefField()
  }
};

export const GENERATE_PREVIEW_REQUEST_SCHEMA: OpenApiSchema = {
  type: "object",
  required: ["sourceContent", "deckBrief"],
  additionalProperties: false,
  properties: {
    sourceContent: { type: "string", maxLength: MAX_SOURCE_CONTENT_CHARS },
    deckBrief: DECK_BRIEF_SCHEMA
  }
};

const HTML_GENERATION_VALIDATION_SCHEMA: OpenApiSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["pass", "repair_required", "fallback_used", "failed"] },
    selfContained: { type: "boolean" },
    slideCountAndOrderPreserved: { type: "boolean" },
    contentFidelityPreserved: { type: "boolean" },
    designCompliancePreserved: { type: "boolean" },
    speakerNotesHidden: { type: "boolean" },
    keyboardNavigationPresent: { type: "boolean" },
    externalResourceIssues: { type: "array", items: { type: "string" } },
    contentIssues: { type: "array", items: { type: "string" } },
    designIssues: { type: "array", items: { type: "string" } },
    repairAttempted: { type: "boolean" },
    fallbackUsed: { type: "boolean" }
  }
};

const GENERATION_SUMMARY_SCHEMA: OpenApiSchema = {
  type: "object",
  properties: {
    slideCount: { type: "integer" },
    sourceFactCount: { type: "integer" },
    chartIntentCount: { type: "integer" },
    uncertainClaimCount: { type: "integer" }
  }
};

const PREVIEW_ARTIFACT_SCHEMA: OpenApiSchema = {
  type: "object",
  properties: {
    html: { type: "string", description: "Self-contained HTML deck." },
    htmlGenerationValidation: HTML_GENERATION_VALIDATION_SCHEMA,
    generationSummary: GENERATION_SUMMARY_SCHEMA
  }
};

export const GENERATE_PREVIEW_RESPONSE_SCHEMA: OpenApiSchema = {
  type: "object",
  properties: {
    slideDeck: { type: "object", additionalProperties: true },
    designPlanningResult: { type: "object", additionalProperties: true },
    previewArtifact: PREVIEW_ARTIFACT_SCHEMA
  }
};

export const CREATE_PREVIEW_JOB_RESPONSE_SCHEMA: OpenApiSchema = {
  type: "object",
  properties: {
    jobId: { type: "string", example: "preview_job_8f1c2d3e4a5b6c7d" },
    status: { type: "string", enum: ["queued"] },
    stage: { type: "string", enum: ["request_accepted"] },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    statusUrl: { type: "string", example: "/api/slides/preview-jobs/preview_job_8f1c2d3e4a5b6c7d" }
  }
};

const PREVIEW_JOB_EVIDENCE_SCHEMA: OpenApiSchema = {
  type: "object",
  properties: {
    stageTransitions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          stage: { type: "string", enum: PREVIEW_JOB_STAGES },
          at: { type: "string", format: "date-time" }
        }
      }
    },
    validationAccepted: { type: "boolean" },
    fallbackUsed: { type: "boolean" },
    repairAttempted: { type: "boolean" },
    timingMs: { type: "object", additionalProperties: { type: "number" } },
    finalStatus: { type: "string", enum: PREVIEW_JOB_STATUSES },
    failureCategory: { type: "string", enum: ["timeout", "generation", "unavailable"] }
  }
};

const PREVIEW_JOB_FAILURE_SCHEMA: OpenApiSchema = {
  type: "object",
  properties: {
    code: {
      type: "string",
      enum: ["PREVIEW_JOB_TIMEOUT", "PREVIEW_GENERATION_FAILED", "PREVIEW_JOB_UNAVAILABLE"]
    },
    message: { type: "string" },
    failedStage: { type: "string", enum: PREVIEW_JOB_STAGES },
    retryable: { type: "boolean" },
    retryGuidance: { type: "string" }
  }
};

export const PREVIEW_JOB_STATUS_RESPONSE_SCHEMA: OpenApiSchema = {
  type: "object",
  description: "Current job state; result is present when succeeded, failure when failed.",
  properties: {
    jobId: { type: "string" },
    status: { type: "string", enum: PREVIEW_JOB_STATUSES },
    stage: { type: "string", enum: PREVIEW_JOB_STAGES },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    evidence: PREVIEW_JOB_EVIDENCE_SCHEMA,
    result: GENERATE_PREVIEW_RESPONSE_SCHEMA,
    failure: PREVIEW_JOB_FAILURE_SCHEMA
  }
};

const errorSchema = (codes: string[], example: string): OpenApiSchema => ({
  type: "object",
  properties: {
    code: { type: "string", enum: codes },
    message: { type: "string", example },
    fields: { type: "array", items: { type: "string" } }
  }
});

export const PREVIEW_REQUEST_ERROR_SCHEMA: OpenApiSchema = errorSchema(
  ["INVALID_INPUT", "UNSUPPORTED_OPTION"],
  "sourceContent, purpose, and audience are required"
);

export const INVALID_JOB_ID_ERROR_SCHEMA: OpenApiSchema = errorSchema(
  ["INVALID_JOB_ID"],
  "Invalid preview job id."
);

export const PREVIEW_JOB_UNAVAILABLE_SCHEMA: OpenApiSchema = errorSchema(
  ["PREVIEW_JOB_UNAVAILABLE"],
  "Preview job is unavailable."
);

export const PREVIEW_QUEUE_UNAVAILABLE_SCHEMA: OpenApiSchema = errorSchema(
  ["PREVIEW_QUEUE_UNAVAILABLE"],
  "Preview service is temporarily unavailable. Please try again."
);

// --- Decks read-only API (feature 006 US3) ---

const DECK_SUMMARY_SCHEMA: OpenApiSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    title: { type: "string" },
    status: { type: "string", enum: ["ready", "failed"] },
    updatedAt: { type: "string", format: "date-time" }
  }
};

export const DECK_LIST_RESPONSE_SCHEMA: OpenApiSchema = {
  type: "object",
  properties: {
    decks: { type: "array", items: DECK_SUMMARY_SCHEMA }
  }
};

const DECK_REVISION_SCHEMA: OpenApiSchema = {
  type: "object",
  properties: {
    revision: { type: "integer" },
    slideDeck: { type: "object", additionalProperties: true },
    designPlan: { type: "object", additionalProperties: true, nullable: true },
    html: { type: "string", nullable: true },
    generationSummary: { type: "object", additionalProperties: true, nullable: true },
    origin: { type: "string", enum: ["generation", "edit"] },
    sourceJobId: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" }
  }
};

export const DECK_DETAIL_RESPONSE_SCHEMA: OpenApiSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    title: { type: "string" },
    status: { type: "string", enum: ["ready", "failed"] },
    sourceContent: { type: "string" },
    deckBrief: { type: "object", additionalProperties: true },
    currentRevision: { ...DECK_REVISION_SCHEMA, nullable: true }
  }
};

export const INVALID_DECK_ID_ERROR_SCHEMA: OpenApiSchema = errorSchema(
  ["INVALID_DECK_ID"],
  "Invalid deck id."
);

export const DECK_NOT_FOUND_SCHEMA: OpenApiSchema = errorSchema(
  ["DECK_NOT_FOUND"],
  "Deck not found."
);

export const AUTH_REQUIRED_SCHEMA: OpenApiSchema = errorSchema(
  ["AUTH_REQUIRED"],
  "Authentication required."
);

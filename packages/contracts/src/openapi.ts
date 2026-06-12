/**
 * OpenAPI 3 schema objects for the public preview API, kept here in the shared
 * contracts package (next to the types and runtime validator) so the docs come
 * from the same source as the contract instead of drifting in controller
 * decorators. Plain JSON-Schema objects — framework-agnostic, consumable by
 * @nestjs/swagger's `@ApiBody({ schema })` / `@ApiResponse({ schema })`.
 */
import { MAX_THEME_ID_CHARS } from "./theme-selection";

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
const CHART_VISUAL_OVERRIDES = ["auto", "pie_donut", "line", "bar", "metric_card", "table"];
const MAX_CHART_POINTS = 12;
const MAX_CHART_OPERATIONS = 50;
const MAX_CHART_LABEL_CHARS = 120;
const MAX_CHART_UNIT_CHARS = 16;
const MAX_CHART_VALUE_TEXT_CHARS = 32;

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

// 011: optional per-axis manual theme override. All ids optional; absent ⇒ keyword
// baseline. A well-formed id not in the catalogue is accepted then surfaced as a
// themeSelectionWarnings fallback (not a 400).
export const THEME_SELECTION_SCHEMA: OpenApiSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    fontId: { type: "string", maxLength: MAX_THEME_ID_CHARS },
    paletteId: { type: "string", maxLength: MAX_THEME_ID_CHARS },
    styleId: { type: "string", maxLength: MAX_THEME_ID_CHARS }
  }
};

export const GENERATE_PREVIEW_REQUEST_SCHEMA: OpenApiSchema = {
  type: "object",
  required: ["sourceContent", "deckBrief"],
  additionalProperties: false,
  properties: {
    sourceContent: { type: "string", maxLength: MAX_SOURCE_CONTENT_CHARS },
    deckBrief: DECK_BRIEF_SCHEMA,
    themeSelection: THEME_SELECTION_SCHEMA
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

const SELECTED_THEME_SUMMARY_SCHEMA: OpenApiSchema = {
  type: "object",
  description: "007/009: readonly applied-theme evidence (projection of the composed style kit).",
  required: ["kitName", "ids", "fallback", "accentHues", "fonts", "structureFeatures"],
  properties: {
    kitName: { type: "string" },
    ids: {
      type: "object",
      required: ["style", "palette", "font"],
      properties: {
        style: { type: "string", nullable: true },
        palette: { type: "string", nullable: true },
        font: { type: "string", nullable: true }
      }
    },
    fallback: { type: "boolean" },
    accentHues: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "base"],
        properties: { name: { type: "string" }, base: { type: "string" } }
      }
    },
    fonts: {
      type: "object",
      required: ["heading", "body"],
      properties: { heading: { type: "string" }, body: { type: "string" } }
    },
    visualDensity: { type: "string", enum: ["low", "medium", "high"] },
    structureFeatures: {
      type: "object",
      required: ["radiusPx", "shadow"],
      properties: {
        radiusPx: { type: "number" },
        shadow: { type: "boolean" },
        backdropBlurPx: { type: "number" },
        glow: { type: "boolean" },
        texture: { type: "string", enum: ["grain", "noise", "paper"] },
        animation: {
          type: "object",
          required: ["preset", "durationMs"],
          properties: {
            preset: { type: "string", enum: ["aurora", "mesh"] },
            durationMs: { type: "number" }
          }
        }
      }
    }
  }
};

const CHART_NOTE_CODE_ENUM = [
  "series_extracted",
  "series_insufficient",
  "unit_mismatch",
  "invalid_pie_total",
  "time_sort_failed",
  "table_truncated",
  "fallback_used",
  "value_parse_uncertain"
];

const RENDERED_CHART_SUMMARY_SCHEMA: OpenApiSchema = {
  type: "object",
  description: "009: per-chart render evidence from the single render pass.",
  required: ["slideId", "chartIntentId", "visualKind", "fallback", "notes"],
  properties: {
    slideId: { type: "string" },
    chartIntentId: { type: "string" },
    visualKind: {
      type: "string",
      enum: ["pie_donut", "line", "bar", "metric_card", "metric_group", "table", "fallback_text"]
    },
    fallback: { type: "boolean" },
    notes: {
      type: "array",
      items: {
        type: "object",
        required: ["code", "message"],
        properties: {
          code: { type: "string", enum: CHART_NOTE_CODE_ENUM },
          message: { type: "string" }
        }
      }
    }
  }
};

// 011: evidence an axis fell back to the default kit (invalid override / unresolvable base).
const THEME_SELECTION_WARNING_SCHEMA: OpenApiSchema = {
  type: "object",
  required: ["axis", "reason"],
  properties: {
    axis: { type: "string", enum: ["font", "palette", "style"] },
    requestedId: { type: "string" },
    reason: { type: "string", enum: ["invalid_id", "base_unresolved"] }
  }
};

// 014: disclosure of a chart placement whose intent contains user-provided points.
const USER_DATA_DISCLOSURE_SCHEMA: OpenApiSchema = {
  type: "object",
  required: ["slideId", "chartIntentId", "chartTitle", "userPointCount", "totalPointCount"],
  properties: {
    slideId: { type: "string" },
    chartIntentId: { type: "string" },
    chartTitle: { type: "string" },
    userPointCount: { type: "integer" },
    totalPointCount: { type: "integer" }
  }
};

const GENERATION_SUMMARY_SCHEMA: OpenApiSchema = {
  type: "object",
  required: [
    "slideCount",
    "sourceFactCount",
    "chartIntentCount",
    "uncertainClaimCount",
    "selectedTheme",
    "renderedCharts",
    "themeSelectionWarnings",
    "userDataDisclosures"
  ],
  properties: {
    slideCount: { type: "integer" },
    sourceFactCount: { type: "integer" },
    chartIntentCount: { type: "integer" },
    uncertainClaimCount: { type: "integer" },
    selectedTheme: SELECTED_THEME_SUMMARY_SCHEMA,
    renderedCharts: { type: "array", items: RENDERED_CHART_SUMMARY_SCHEMA },
    themeSelectionWarnings: { type: "array", items: THEME_SELECTION_WARNING_SCHEMA },
    userDataDisclosures: { type: "array", items: USER_DATA_DISCLOSURE_SCHEMA }
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
    previewArtifact: PREVIEW_ARTIFACT_SCHEMA,
    // 010 (C1/FR-006a): planned chart intents surfaced for persistence.
    chartIntents: { type: "array", items: { type: "object", additionalProperties: true } }
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
  required: ["id", "title", "status", "updatedAt"],
  properties: {
    id: { type: "string", format: "uuid" },
    title: { type: "string" },
    status: { type: "string", enum: ["ready", "failed"] },
    updatedAt: { type: "string", format: "date-time" }
  }
};

export const DECK_LIST_RESPONSE_SCHEMA: OpenApiSchema = {
  type: "object",
  required: ["decks"],
  properties: {
    decks: { type: "array", items: DECK_SUMMARY_SCHEMA }
  }
};

export const DECK_REVISION_SCHEMA: OpenApiSchema = {
  type: "object",
  required: ["revision", "slideDeck", "html", "chartIntents", "origin", "sourceJobId", "createdAt"],
  properties: {
    revision: { type: "integer" },
    slideDeck: { type: "object", additionalProperties: true },
    designPlan: { type: "object", additionalProperties: true, nullable: true },
    html: { type: "string", nullable: true },
    generationSummary: { type: "object", additionalProperties: true, nullable: true },
    // 010 (C1/FR-006a): planned chart intents for deterministic redraw; null for legacy.
    chartIntents: {
      type: "array",
      items: { type: "object", additionalProperties: true },
      nullable: true
    },
    origin: { type: "string", enum: ["generation", "edit"] },
    sourceJobId: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" }
  }
};

export const DECK_DETAIL_RESPONSE_SCHEMA: OpenApiSchema = {
  type: "object",
  required: ["id", "title", "status", "sourceContent", "deckBrief", "currentRevision"],
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

// --- Deck edit revisions (feature 010 US1) ---

const USER_POINT_INPUT_SCHEMA: OpenApiSchema = {
  type: "object",
  required: ["label", "valueText", "unit"],
  additionalProperties: false,
  properties: {
    label: { type: "string", maxLength: MAX_CHART_LABEL_CHARS },
    valueText: {
      type: "string",
      maxLength: MAX_CHART_VALUE_TEXT_CHARS,
      pattern: "^-?\\d+(\\.\\d+)?$"
    },
    unit: { type: "string", nullable: true, maxLength: MAX_CHART_UNIT_CHARS }
  }
};

const EDIT_DATA_POINT_SCHEMA: OpenApiSchema = {
  oneOf: [
    {
      type: "object",
      required: ["kind", "sourceFactId"],
      additionalProperties: false,
      properties: {
        kind: { type: "string", enum: ["original"] },
        sourceFactId: { type: "string" }
      }
    },
    {
      type: "object",
      required: ["kind", "point"],
      additionalProperties: false,
      properties: {
        kind: { type: "string", enum: ["user"] },
        point: USER_POINT_INPUT_SCHEMA,
        replacesFactId: { type: "string" }
      }
    }
  ]
};

// 014: one structured chart operation. OpenAPI mirrors the runtime validator's
// discriminated shapes so API docs do not accept payloads the server rejects.
const CHART_OPERATION_SCHEMA: OpenApiSchema = {
  oneOf: [
    {
      type: "object",
      required: ["op", "chartIntentId", "visual"],
      additionalProperties: false,
      properties: {
        op: { type: "string", enum: ["set_visual"] },
        chartIntentId: { type: "string" },
        visual: { type: "string", enum: CHART_VISUAL_OVERRIDES }
      }
    },
    {
      type: "object",
      required: ["op", "slideId", "chartIntentId"],
      additionalProperties: false,
      properties: {
        op: { type: "string", enum: ["remove_chart"] },
        slideId: { type: "string" },
        chartIntentId: { type: "string" }
      }
    },
    {
      type: "object",
      required: ["op", "slideId", "source"],
      additionalProperties: false,
      properties: {
        op: { type: "string", enum: ["add_chart"] },
        slideId: { type: "string" },
        source: {
          oneOf: [
            {
              type: "object",
              required: ["kind", "chartIntentId"],
              additionalProperties: false,
              properties: {
                kind: { type: "string", enum: ["existing_intent"] },
                chartIntentId: { type: "string" }
              }
            },
            {
              type: "object",
              required: ["kind", "title", "visual", "points"],
              additionalProperties: false,
              properties: {
                kind: { type: "string", enum: ["user_data"] },
                title: { type: "string", maxLength: MAX_CHART_LABEL_CHARS },
                visual: { type: "string", enum: CHART_VISUAL_OVERRIDES },
                points: {
                  type: "array",
                  maxItems: MAX_CHART_POINTS,
                  items: USER_POINT_INPUT_SCHEMA
                }
              }
            }
          ]
        }
      }
    },
    {
      type: "object",
      required: ["op", "chartIntentId", "points"],
      additionalProperties: false,
      properties: {
        op: { type: "string", enum: ["edit_data"] },
        chartIntentId: { type: "string" },
        title: { type: "string", maxLength: MAX_CHART_LABEL_CHARS },
        points: { type: "array", maxItems: MAX_CHART_POINTS, items: EDIT_DATA_POINT_SCHEMA }
      }
    }
  ],
  description:
    "Structured chart edit (the only legal chart-edit channel; contentBlocks stay read-only)."
};

export const EDIT_REVISION_REQUEST_SCHEMA: OpenApiSchema = {
  type: "object",
  required: ["baseRevision", "slideDeck"],
  properties: {
    baseRevision: {
      type: "integer",
      minimum: 0,
      description: "Revision the client edited from (optimistic concurrency, FR-020)."
    },
    slideDeck: {
      type: "object",
      additionalProperties: true,
      description: "Edited deck (text + structure). Read-only blocks are re-derived server-side."
    },
    themeSelection: THEME_SELECTION_SCHEMA,
    chartOperations: {
      type: "array",
      maxItems: MAX_CHART_OPERATIONS,
      items: CHART_OPERATION_SCHEMA,
      description: "014: applied in array order; any violation rejects the whole request (400)."
    }
  }
};

export const INVALID_EDIT_SCHEMA: OpenApiSchema = errorSchema(
  ["INVALID_EDIT"],
  "Edit could not be applied."
);

// 015 US2: PPTX export job (create / poll / download) on the deck resource.
export const CREATE_PPTX_EXPORT_REQUEST_SCHEMA: OpenApiSchema = {
  type: "object",
  required: ["revision"],
  properties: {
    revision: {
      type: "integer",
      minimum: 0,
      description: "The EXACT revision to export (FR-003a); must be the deck's current revision."
    }
  }
};

export const CREATE_PPTX_EXPORT_RESPONSE_SCHEMA: OpenApiSchema = {
  type: "object",
  required: ["jobId", "status", "statusUrl"],
  properties: {
    jobId: { type: "string", example: "pptx_job_8f1c2d3e4a5b6c7d" },
    status: { type: "string", enum: ["queued"] },
    statusUrl: { type: "string", example: "/api/decks/{id}/pptx-exports/{jobId}" }
  }
};

export const PPTX_EXPORT_STATUS_RESPONSE_SCHEMA: OpenApiSchema = {
  type: "object",
  required: ["jobId", "status", "createdAt", "updatedAt"],
  properties: {
    jobId: { type: "string" },
    status: { type: "string", enum: ["queued", "processing", "done", "failed"] },
    pageCount: { type: "integer" },
    downloadUrl: {
      type: "string",
      description: "Present only when status=done and the artifact is within its TTL."
    },
    failure: {
      type: "object",
      required: ["reason", "message"],
      properties: {
        reason: { type: "string", enum: ["timeout", "export"] },
        message: { type: "string" }
      }
    },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" }
  }
};

export const REVISION_CONFLICT_SCHEMA: OpenApiSchema = {
  type: "object",
  required: ["code", "message", "currentRevision"],
  properties: {
    code: { type: "string", enum: ["REVISION_CONFLICT"] },
    message: { type: "string", example: "This deck was updated elsewhere." },
    currentRevision: { type: "integer", description: "Latest revision so the client can rebase." }
  }
};

// 011: GET /api/themes browse catalogue. styleKit is the trusted-builtin partial kit
// (opaque here; the renderer/client escape at the use boundary).
const BROWSABLE_THEME_SCHEMA: OpenApiSchema = {
  type: "object",
  required: ["id", "kind", "name", "keywords", "support", "styleKit"],
  properties: {
    id: { type: "string" },
    kind: { type: "string", enum: ["font", "palette", "style"] },
    name: { type: "string" },
    description: { type: "string" },
    keywords: { type: "array", items: { type: "string" } },
    support: { type: "string", enum: ["full", "partial", "raw"] },
    styleKit: { type: "object", additionalProperties: true }
  }
};

export const THEME_CATALOG_RESPONSE_SCHEMA: OpenApiSchema = {
  type: "object",
  required: ["font", "palette", "style"],
  properties: {
    font: { type: "array", items: BROWSABLE_THEME_SCHEMA },
    palette: { type: "array", items: BROWSABLE_THEME_SCHEMA },
    style: { type: "array", items: BROWSABLE_THEME_SCHEMA }
  }
};

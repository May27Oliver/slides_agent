import type { OpenAPIObject } from "@nestjs/swagger";
import {
  type OpenApiSchema,
  AUTH_REQUIRED_SCHEMA,
  CREATE_PREVIEW_JOB_RESPONSE_SCHEMA,
  DECK_DETAIL_RESPONSE_SCHEMA,
  DECK_LIST_RESPONSE_SCHEMA,
  DECK_NOT_FOUND_SCHEMA,
  DECK_REVISION_SCHEMA,
  EDIT_REVISION_REQUEST_SCHEMA,
  GENERATE_PREVIEW_REQUEST_SCHEMA,
  GENERATE_PREVIEW_RESPONSE_SCHEMA,
  INVALID_DECK_ID_ERROR_SCHEMA,
  INVALID_EDIT_SCHEMA,
  INVALID_JOB_ID_ERROR_SCHEMA,
  REVISION_CONFLICT_SCHEMA,
  PREVIEW_JOB_STATUS_RESPONSE_SCHEMA,
  PREVIEW_JOB_UNAVAILABLE_SCHEMA,
  PREVIEW_QUEUE_UNAVAILABLE_SCHEMA,
  PREVIEW_REQUEST_ERROR_SCHEMA,
  THEME_CATALOG_RESPONSE_SCHEMA
} from "@slides-agent/contracts";

const json = (schema: OpenApiSchema): Record<string, unknown> => ({
  "application/json": { schema }
});

/**
 * Static OpenAPI 3 document, assembled from the shared contract schemas. Built
 * by hand (not SwaggerModule.createDocument) on purpose: the app runs under tsx,
 * which doesn't emit decorator metadata, so swagger's controller reflection
 * cannot read route param types. Hand-assembly keeps the docs sourced from the
 * contracts package and free of any runtime reflection.
 */
export function buildOpenApiDocument(): OpenAPIObject {
  return {
    openapi: "3.0.0",
    info: {
      title: "Slides Agent API",
      description: "Preview generation (sync) and async preview jobs.",
      version: "1.0"
    },
    tags: [{ name: "slides" }, { name: "decks" }, { name: "themes" }],
    paths: {
      "/api/themes": {
        get: {
          tags: ["themes"],
          summary: "Browse the builtin theme catalogue (011)",
          description:
            "JWT-protected, read-only, shared builtin catalogue (not account-scoped). Returns font/palette/style groups, each entry carrying the trusted-builtin partial styleKit.",
          responses: {
            "200": {
              description: "Theme catalogue grouped by axis",
              content: json(THEME_CATALOG_RESPONSE_SCHEMA)
            },
            "401": { description: "Missing/invalid JWT", content: json(AUTH_REQUIRED_SCHEMA) },
            "500": { description: "Unexpected server error." }
          }
        }
      },
      "/api/decks": {
        get: {
          tags: ["decks"],
          summary: "List the current user's decks (newest first)",
          description: "JWT-protected; always scoped to the authenticated account. Not paginated.",
          responses: {
            "200": { description: "The user's decks", content: json(DECK_LIST_RESPONSE_SCHEMA) },
            "401": { description: "Missing/invalid JWT", content: json(AUTH_REQUIRED_SCHEMA) },
            "500": { description: "Unexpected server error." }
          }
        }
      },
      "/api/decks/{id}": {
        get: {
          tags: ["decks"],
          summary: "Fetch one deck the current user owns",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
              example: "11111111-2222-3333-4444-555555555555"
            }
          ],
          responses: {
            "200": {
              description: "The deck + current revision",
              content: json(DECK_DETAIL_RESPONSE_SCHEMA)
            },
            "400": { description: "Invalid deck id", content: json(INVALID_DECK_ID_ERROR_SCHEMA) },
            "401": { description: "Missing/invalid JWT", content: json(AUTH_REQUIRED_SCHEMA) },
            "404": {
              description: "Not found or owned by another account",
              content: json(DECK_NOT_FOUND_SCHEMA)
            },
            "500": { description: "Unexpected server error." }
          }
        }
      },
      "/api/decks/{id}/revisions": {
        post: {
          tags: ["decks"],
          summary: "Apply an edit and append a new revision (010 US1)",
          description:
            "JWT-protected; scoped to the owner. Deterministic re-render (no LLM). Optimistic " +
            "concurrency on baseRevision; read-only blocks/structure are enforced server-side.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
              example: "11111111-2222-3333-4444-555555555555"
            }
          ],
          requestBody: {
            required: true,
            content: json(EDIT_REVISION_REQUEST_SCHEMA)
          },
          responses: {
            "201": {
              description: "The new edit revision",
              content: json(DECK_REVISION_SCHEMA)
            },
            "400": {
              description: "Malformed body, read-only tampering, or unrenderable deck",
              content: json(INVALID_EDIT_SCHEMA)
            },
            "401": { description: "Missing/invalid JWT", content: json(AUTH_REQUIRED_SCHEMA) },
            "404": {
              description: "Not found or owned by another account",
              content: json(DECK_NOT_FOUND_SCHEMA)
            },
            "409": {
              description: "Base revision is stale (edited elsewhere)",
              content: json(REVISION_CONFLICT_SCHEMA)
            },
            "500": { description: "Unexpected server error." }
          }
        }
      },
      "/api/slides/preview": {
        post: {
          tags: ["slides"],
          summary: "Generate a preview synchronously",
          description:
            "Runs the full pipeline and returns the deck + self-contained HTML. May be slow; prefer the async preview-jobs endpoint.",
          requestBody: { required: true, content: json(GENERATE_PREVIEW_REQUEST_SCHEMA) },
          responses: {
            "200": {
              description: "Generated preview",
              content: json(GENERATE_PREVIEW_RESPONSE_SCHEMA)
            },
            "400": { description: "Validation error", content: json(PREVIEW_REQUEST_ERROR_SCHEMA) },
            "429": { description: "Rate limit exceeded for this IP." },
            "500": { description: "Unexpected server error." }
          }
        }
      },
      "/api/slides/preview-jobs": {
        post: {
          tags: ["slides"],
          summary: "Create an async preview job",
          description:
            "Validates and enqueues a preview job, returning a job id to poll. Generation runs in a separate worker process.",
          requestBody: { required: true, content: json(GENERATE_PREVIEW_REQUEST_SCHEMA) },
          responses: {
            "202": {
              description: "Job accepted",
              content: json(CREATE_PREVIEW_JOB_RESPONSE_SCHEMA)
            },
            "400": { description: "Validation error", content: json(PREVIEW_REQUEST_ERROR_SCHEMA) },
            "429": { description: "Rate limit exceeded for this IP." },
            "503": {
              description: "Queue/Redis unavailable",
              content: json(PREVIEW_QUEUE_UNAVAILABLE_SCHEMA)
            },
            "500": { description: "Unexpected server error." }
          }
        }
      },
      "/api/slides/preview-jobs/{jobId}": {
        get: {
          tags: ["slides"],
          summary: "Poll a preview job's status / result",
          parameters: [
            {
              name: "jobId",
              in: "path",
              required: true,
              schema: { type: "string" },
              example: "preview_job_8f1c2d3e4a5b6c7d"
            }
          ],
          responses: {
            "200": {
              description: "Current job state",
              content: json(PREVIEW_JOB_STATUS_RESPONSE_SCHEMA)
            },
            "400": { description: "Invalid job id", content: json(INVALID_JOB_ID_ERROR_SCHEMA) },
            "404": {
              description: "Job unavailable",
              content: json(PREVIEW_JOB_UNAVAILABLE_SCHEMA)
            },
            "503": {
              description: "Queue/Redis unavailable",
              content: json(PREVIEW_QUEUE_UNAVAILABLE_SCHEMA)
            },
            "500": { description: "Unexpected server error." }
          }
        }
      }
    }
  } as OpenAPIObject;
}

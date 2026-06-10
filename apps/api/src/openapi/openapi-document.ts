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

// --- Auth/admin schemas (feature 013). Inlined here (not the contracts package)
// since they are doc-only projections of the public-safe shapes. ---

const sanitizedError = (codes: string[], description: string): OpenApiSchema => ({
  type: "object",
  required: ["code", "message"],
  properties: {
    code: { type: "string", enum: codes },
    message: { type: "string", description }
  }
});

const PUBLIC_ACCOUNT_SCHEMA: OpenApiSchema = {
  type: "object",
  required: ["id", "username", "displayName", "status", "isAdmin", "createdAt"],
  properties: {
    id: { type: "string" },
    username: { type: "string", description: "email (normalized lowercase)" },
    displayName: { type: "string" },
    status: { type: "string", enum: ["pending", "active", "disabled"] },
    isAdmin: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" }
  }
};

const REGISTER_REQUEST_SCHEMA: OpenApiSchema = {
  type: "object",
  required: ["username", "displayName", "password"],
  properties: {
    username: { type: "string", format: "email", maxLength: 320 },
    displayName: { type: "string", maxLength: 200 },
    password: {
      type: "string",
      minLength: 10,
      maxLength: 1000,
      description: "≥10 chars, with at least one letter and one digit (FR-002)"
    }
  }
};

const AUTH_CONFIG_SCHEMA: OpenApiSchema = {
  type: "object",
  required: ["registrationEnabled"],
  properties: { registrationEnabled: { type: "boolean" } }
};

const ADMIN_USER_LIST_SCHEMA: OpenApiSchema = {
  type: "object",
  required: ["users"],
  properties: { users: { type: "array", items: PUBLIC_ACCOUNT_SCHEMA } }
};

const ADMIN_UPDATE_REQUEST_SCHEMA: OpenApiSchema = {
  type: "object",
  minProperties: 1,
  description: "At least one of status/isAdmin. status may only be set to active|disabled.",
  properties: {
    status: { type: "string", enum: ["active", "disabled"] },
    isAdmin: { type: "boolean" }
  }
};

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
    tags: [
      { name: "slides" },
      { name: "decks" },
      { name: "themes" },
      { name: "auth" },
      { name: "admin" }
    ],
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
      },
      "/api/auth/register": {
        post: {
          tags: ["auth"],
          summary: "Self-register a pending account (013 US1)",
          description:
            "Public, no JWT, per-IP rate-limited. Creates a status=pending account (no token issued); an admin must approve it before login. Closed when REGISTRATION_ENABLED is false.",
          requestBody: { required: true, content: json(REGISTER_REQUEST_SCHEMA) },
          responses: {
            "201": {
              description: "Pending account created (public-safe; no token)",
              content: json(PUBLIC_ACCOUNT_SCHEMA)
            },
            "400": {
              description: "Validation error (email / display name / password policy)",
              content: json(sanitizedError(["INVALID_INPUT"], "Invalid registration input."))
            },
            "403": {
              description: "Self-registration is disabled",
              content: json(sanitizedError(["REGISTRATION_DISABLED"], "Registration is off."))
            },
            "409": {
              description: "Email already registered",
              content: json(sanitizedError(["USERNAME_TAKEN"], "This email is already in use."))
            },
            "429": { description: "Rate limit exceeded for this IP." },
            "500": { description: "Unexpected server error." }
          }
        }
      },
      "/api/auth/config": {
        get: {
          tags: ["auth"],
          summary: "Public registration availability flag (013 DR-010)",
          description: "No auth. Lets the login page decide whether to show the register link.",
          responses: {
            "200": { description: "Registration flag", content: json(AUTH_CONFIG_SCHEMA) },
            "500": { description: "Unexpected server error." }
          }
        }
      },
      "/api/admin/users": {
        get: {
          tags: ["admin"],
          summary: "List users for the admin dashboard (013 US2)",
          description:
            "JWT + AdminGuard (live DB isAdmin). Optional status filter; returns public-safe accounts (no hash).",
          parameters: [
            {
              name: "status",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["pending", "active", "disabled", "all"] }
            }
          ],
          responses: {
            "200": { description: "All/filtered users", content: json(ADMIN_USER_LIST_SCHEMA) },
            "401": { description: "Missing/invalid JWT", content: json(AUTH_REQUIRED_SCHEMA) },
            "403": {
              description: "Authenticated but not an admin",
              content: json(sanitizedError(["FORBIDDEN"], "Admin privilege required."))
            },
            "500": { description: "Unexpected server error." }
          }
        }
      },
      "/api/admin/users/{id}": {
        patch: {
          tags: ["admin"],
          summary: "Approve / disable / re-enable / promote / demote a user (013 US2)",
          description:
            "JWT + AdminGuard. Idempotent partial update (status active|disabled and/or isAdmin). The FR-018 last-admin/self guard is enforced atomically.",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          requestBody: { required: true, content: json(ADMIN_UPDATE_REQUEST_SCHEMA) },
          responses: {
            "200": { description: "Updated account", content: json(PUBLIC_ACCOUNT_SCHEMA) },
            "400": {
              description: "Empty body or non-settable status",
              content: json(sanitizedError(["INVALID_INPUT"], "Invalid admin update."))
            },
            "401": { description: "Missing/invalid JWT", content: json(AUTH_REQUIRED_SCHEMA) },
            "403": {
              description: "Authenticated but not an admin",
              content: json(sanitizedError(["FORBIDDEN"], "Admin privilege required."))
            },
            "404": {
              description: "No such account",
              content: json(sanitizedError(["ACCOUNT_NOT_FOUND"], "Account not found."))
            },
            "409": {
              description: "Last-admin / self-modify guard (FR-018)",
              content: json(
                sanitizedError(
                  ["LAST_ADMIN_PROTECTED", "CANNOT_MODIFY_SELF"],
                  "Admin lockout prevented."
                )
              )
            },
            "500": { description: "Unexpected server error." }
          }
        },
        delete: {
          tags: ["admin"],
          summary: "Reject (delete) a pending registration (013 US2)",
          description: "JWT + AdminGuard. Only a status=pending account may be deleted.",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "204": { description: "Pending account deleted" },
            "401": { description: "Missing/invalid JWT", content: json(AUTH_REQUIRED_SCHEMA) },
            "403": {
              description: "Authenticated but not an admin",
              content: json(sanitizedError(["FORBIDDEN"], "Admin privilege required."))
            },
            "404": {
              description: "No such account",
              content: json(sanitizedError(["ACCOUNT_NOT_FOUND"], "Account not found."))
            },
            "409": {
              description: "Account is not pending",
              content: json(
                sanitizedError(
                  ["CANNOT_REJECT_NON_PENDING"],
                  "Only a pending account can be deleted."
                )
              )
            },
            "500": { description: "Unexpected server error." }
          }
        }
      }
    }
  } as OpenAPIObject;
}

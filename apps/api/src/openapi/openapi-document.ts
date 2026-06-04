import type { OpenAPIObject } from "@nestjs/swagger";
import {
  type OpenApiSchema,
  CREATE_PREVIEW_JOB_RESPONSE_SCHEMA,
  GENERATE_PREVIEW_REQUEST_SCHEMA,
  GENERATE_PREVIEW_RESPONSE_SCHEMA,
  INVALID_JOB_ID_ERROR_SCHEMA,
  PREVIEW_JOB_STATUS_RESPONSE_SCHEMA,
  PREVIEW_JOB_UNAVAILABLE_SCHEMA,
  PREVIEW_QUEUE_UNAVAILABLE_SCHEMA,
  PREVIEW_REQUEST_ERROR_SCHEMA
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
    tags: [{ name: "slides" }],
    paths: {
      "/api/slides/preview": {
        post: {
          tags: ["slides"],
          summary: "Generate a preview synchronously",
          description:
            "Runs the full pipeline and returns the deck + self-contained HTML. May be slow; prefer the async preview-jobs endpoint.",
          requestBody: { required: true, content: json(GENERATE_PREVIEW_REQUEST_SCHEMA) },
          responses: {
            "200": { description: "Generated preview", content: json(GENERATE_PREVIEW_RESPONSE_SCHEMA) },
            "400": { description: "Validation error", content: json(PREVIEW_REQUEST_ERROR_SCHEMA) },
            "429": { description: "Rate limit exceeded for this IP." }
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
            "202": { description: "Job accepted", content: json(CREATE_PREVIEW_JOB_RESPONSE_SCHEMA) },
            "400": { description: "Validation error", content: json(PREVIEW_REQUEST_ERROR_SCHEMA) },
            "429": { description: "Rate limit exceeded for this IP." },
            "503": {
              description: "Queue/Redis unavailable",
              content: json(PREVIEW_QUEUE_UNAVAILABLE_SCHEMA)
            }
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
            "200": { description: "Current job state", content: json(PREVIEW_JOB_STATUS_RESPONSE_SCHEMA) },
            "400": { description: "Invalid job id", content: json(INVALID_JOB_ID_ERROR_SCHEMA) },
            "404": { description: "Job unavailable", content: json(PREVIEW_JOB_UNAVAILABLE_SCHEMA) }
          }
        }
      }
    }
  } as OpenAPIObject;
}

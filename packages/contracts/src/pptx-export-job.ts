/**
 * 015 US2: the PPTX export job's public contract — a three-step async flow on the
 * deck resource (see contracts/pptx-export-job.contract.md):
 *   POST /api/decks/:id/pptx-exports          → 202 CreatePptxExportResponseContract
 *   GET  /api/decks/:id/pptx-exports/:jobId   → 200 PptxExportJobStatusResponseContract
 *   GET  /api/decks/:id/pptx-exports/:jobId/file → 200 (pptx binary)
 * Owner scope: every read is bound to the requesting account; non-owners see 404.
 */
export type PptxExportJobStatusContract = "queued" | "processing" | "done" | "failed";

/** Why an export failed (mirrors the domain PptxExportFailure + the OpenAPI enum). */
export type PptxExportFailureReason = "timeout" | "export";

export interface CreatePptxExportRequestContract {
  /** The EXACT revision to export (FR-003a); validated against the deck server-side. */
  revision: number;
}

export interface CreatePptxExportResponseContract {
  jobId: string;
  status: "queued";
  statusUrl: string;
}

export interface PptxExportJobStatusResponseContract {
  jobId: string;
  status: PptxExportJobStatusContract;
  pageCount?: number;
  /** Present only when status = "done" and the artifact is still within its TTL. */
  downloadUrl?: string;
  failure?: { reason: PptxExportFailureReason; message: string };
  createdAt: string;
  updatedAt: string;
}

export type PptxExportValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: string[] };

const STATUSES = new Set<PptxExportJobStatusContract>(["queued", "processing", "done", "failed"]);

export function validateCreatePptxExportRequest(
  input: unknown
): PptxExportValidationResult<CreatePptxExportRequestContract> {
  if (!isRecord(input)) {
    return invalid(["request must be an object"]);
  }
  if (!Number.isInteger(input.revision) || (input.revision as number) < 0) {
    return invalid(["revision must be a non-negative integer"]);
  }
  return { ok: true, value: input as unknown as CreatePptxExportRequestContract };
}

export function validatePptxExportJobStatusResponse(
  input: unknown
): PptxExportValidationResult<PptxExportJobStatusResponseContract> {
  if (!isRecord(input)) {
    return invalid(["response must be an object"]);
  }
  const issues: string[] = [];
  if (typeof input.jobId !== "string" || input.jobId.length === 0) {
    issues.push("jobId must be a non-empty string");
  }
  if (
    typeof input.status !== "string" ||
    !STATUSES.has(input.status as PptxExportJobStatusContract)
  ) {
    issues.push("status must be one of queued/processing/done/failed");
  }
  if (typeof input.createdAt !== "string" || typeof input.updatedAt !== "string") {
    issues.push("createdAt/updatedAt must be ISO strings");
  }
  if (input.pageCount !== undefined && !Number.isInteger(input.pageCount)) {
    issues.push("pageCount must be an integer");
  }
  if (input.downloadUrl !== undefined && typeof input.downloadUrl !== "string") {
    issues.push("downloadUrl must be a string");
  }
  if (input.failure !== undefined) {
    if (
      !isRecord(input.failure) ||
      (input.failure.reason !== "timeout" && input.failure.reason !== "export") ||
      typeof input.failure.message !== "string"
    ) {
      issues.push("failure must be { reason: timeout|export, message }");
    }
  }
  return issues.length === 0
    ? { ok: true, value: input as unknown as PptxExportJobStatusResponseContract }
    : invalid(issues);
}

function invalid(issues: string[]): { ok: false; issues: string[] } {
  return { ok: false, issues };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

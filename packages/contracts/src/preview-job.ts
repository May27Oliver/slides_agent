import type { GeneratePreviewResponseContract } from "./index";

export type PreviewJobStatus = "queued" | "running" | "succeeded" | "failed" | "expired";

export type PreviewJobStage =
  | "request_accepted"
  | "queued"
  | "content_planning"
  | "deck_planning"
  | "design_planning"
  | "html_generation"
  | "html_validation"
  | "repair_or_fallback"
  | "completed"
  | "failed";

export interface PreviewJobStageTransitionContract {
  stage: PreviewJobStage;
  at: string;
}

export interface PreviewJobEvidenceContract {
  stageTransitions: PreviewJobStageTransitionContract[];
  validationAccepted: boolean;
  fallbackUsed: boolean;
  repairAttempted: boolean;
  timingMs?: Record<string, number>;
  finalStatus: PreviewJobStatus;
  failureCategory?: "timeout" | "generation" | "unavailable";
}

export interface PreviewJobFailureContract {
  code: "PREVIEW_JOB_TIMEOUT" | "PREVIEW_GENERATION_FAILED" | "PREVIEW_JOB_UNAVAILABLE";
  message: string;
  failedStage: PreviewJobStage;
  retryable: boolean;
  retryGuidance: string;
}

export interface CreatePreviewJobResponseContract {
  jobId: string;
  status: "queued";
  stage: "request_accepted";
  createdAt: string;
  updatedAt: string;
  statusUrl: string;
}

export interface PreviewJobAvailableStatusResponseContract {
  jobId: string;
  status: PreviewJobStatus;
  stage: PreviewJobStage;
  createdAt: string;
  updatedAt: string;
  evidence: PreviewJobEvidenceContract;
  result?: GeneratePreviewResponseContract;
  failure?: PreviewJobFailureContract;
}

export interface PreviewJobUnavailableResponseContract {
  code: "PREVIEW_JOB_UNAVAILABLE";
  message: string;
}

export type PreviewJobStatusResponseContract =
  | PreviewJobAvailableStatusResponseContract
  | PreviewJobUnavailableResponseContract;

export type PreviewJobContractValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: string[] };

const statuses = new Set(["queued", "running", "succeeded", "failed", "expired"]);
const stages = new Set([
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
]);
const failureCodes = new Set([
  "PREVIEW_JOB_TIMEOUT",
  "PREVIEW_GENERATION_FAILED",
  "PREVIEW_JOB_UNAVAILABLE"
]);

export function validateCreatePreviewJobResponse(
  input: unknown
): PreviewJobContractValidationResult<CreatePreviewJobResponseContract> {
  const issues: string[] = [];

  if (!isRecord(input)) {
    return invalid(["response must be an object"]);
  }

  requireString(input, "jobId", issues);
  requireString(input, "createdAt", issues);
  requireString(input, "updatedAt", issues);
  requireString(input, "statusUrl", issues);
  requireLiteral(input, "status", "queued", issues);
  requireLiteral(input, "stage", "request_accepted", issues);

  return issues.length === 0
    ? { ok: true, value: input as unknown as CreatePreviewJobResponseContract }
    : invalid(issues);
}

export function validatePreviewJobStatusResponse(
  input: unknown
): PreviewJobContractValidationResult<PreviewJobStatusResponseContract> {
  if (!isRecord(input)) {
    return invalid(["response must be an object"]);
  }

  if (input.code === "PREVIEW_JOB_UNAVAILABLE") {
    return typeof input.message === "string"
      ? { ok: true, value: input as unknown as PreviewJobUnavailableResponseContract }
      : invalid(["message must be a string"]);
  }

  const issues: string[] = [];
  requireString(input, "jobId", issues);
  requireString(input, "createdAt", issues);
  requireString(input, "updatedAt", issues);

  if (!isStringInSet(input.status, statuses)) {
    issues.push("status is invalid");
  }

  if (!isStringInSet(input.stage, stages)) {
    issues.push("stage is invalid");
  }

  if (!isValidEvidence(input.evidence)) {
    issues.push("evidence is invalid");
  }

  if (input.status === "succeeded" && !isRecord(input.result)) {
    issues.push("succeeded response requires result");
  }

  if (input.status === "failed" && !isValidFailure(input.failure)) {
    issues.push("failed response requires sanitized failure");
  }

  return issues.length === 0
    ? { ok: true, value: input as unknown as PreviewJobStatusResponseContract }
    : invalid(issues);
}

function isValidEvidence(value: unknown): value is PreviewJobEvidenceContract {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value.stageTransitions) &&
    value.stageTransitions.every(isValidStageTransition) &&
    typeof value.validationAccepted === "boolean" &&
    typeof value.fallbackUsed === "boolean" &&
    typeof value.repairAttempted === "boolean" &&
    isStringInSet(value.finalStatus, statuses)
  );
}

function isValidStageTransition(value: unknown): value is PreviewJobStageTransitionContract {
  return isRecord(value) && isStringInSet(value.stage, stages) && typeof value.at === "string";
}

function isValidFailure(value: unknown): value is PreviewJobFailureContract {
  return (
    isRecord(value) &&
    isStringInSet(value.code, failureCodes) &&
    typeof value.message === "string" &&
    isStringInSet(value.failedStage, stages) &&
    typeof value.retryable === "boolean" &&
    typeof value.retryGuidance === "string"
  );
}

function requireString(input: Record<string, unknown>, key: string, issues: string[]): void {
  if (typeof input[key] !== "string") {
    issues.push(`${key} must be a string`);
  }
}

function requireLiteral(
  input: Record<string, unknown>,
  key: string,
  expected: string,
  issues: string[]
): void {
  if (input[key] !== expected) {
    issues.push(`${key} must be ${expected}`);
  }
}

function isStringInSet(value: unknown, allowed: Set<string>): value is string {
  return typeof value === "string" && allowed.has(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid<T>(issues: string[]): PreviewJobContractValidationResult<T> {
  return { ok: false, issues };
}

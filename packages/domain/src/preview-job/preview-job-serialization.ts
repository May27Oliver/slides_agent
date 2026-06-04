import type { JobStage, JobStatus, PreviewJob } from "@/preview-job/preview-job.types";

const JOB_STATUSES: ReadonlySet<JobStatus> = new Set([
  "queued",
  "running",
  "succeeded",
  "failed",
  "expired",
  "unavailable"
]);

const JOB_STAGES: ReadonlySet<JobStage> = new Set([
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

/**
 * Wire form of {@link PreviewJob}: identical shape except the three `Date`
 * fields are ISO-8601 strings so the job can be stored as a JSON value (e.g. in
 * Redis). Pure, with no I/O and no internal time access.
 */
export type SerializedPreviewJob = Omit<PreviewJob, "createdAt" | "updatedAt" | "expiresAt"> & {
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export function serializePreviewJob(job: PreviewJob): SerializedPreviewJob {
  return {
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    expiresAt: job.expiresAt.toISOString()
  };
}

export function deserializePreviewJob(raw: string | unknown): PreviewJob {
  const parsed: unknown = typeof raw === "string" ? safeJsonParse(raw) : raw;

  if (!isRecord(parsed)) {
    throw new Error("Invalid serialized preview job: expected an object");
  }

  const createdAt = parseIsoDate(parsed.createdAt, "createdAt");
  const updatedAt = parseIsoDate(parsed.updatedAt, "updatedAt");
  const expiresAt = parseIsoDate(parsed.expiresAt, "expiresAt");

  if (typeof parsed.id !== "string" || !isRecord(parsed.request) || !isRecord(parsed.evidence)) {
    throw new Error("Invalid serialized preview job: missing required fields");
  }

  // Validate the enum values, not just their type: a corrupted or schema-evolved
  // record must not slip an unknown status/stage past the terminal-state guard.
  if (!isJobStatus(parsed.status)) {
    throw new Error("Invalid serialized preview job: unknown status");
  }
  if (!isJobStage(parsed.stage)) {
    throw new Error("Invalid serialized preview job: unknown stage");
  }

  return {
    ...(parsed as unknown as PreviewJob),
    createdAt,
    updatedAt,
    expiresAt
  };
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid serialized preview job: not valid JSON");
  }
}

function parseIsoDate(value: unknown, field: string): Date {
  if (typeof value !== "string") {
    throw new Error(`Invalid serialized preview job: ${field} must be an ISO string`);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid serialized preview job: ${field} is not a valid date`);
  }

  return date;
}

function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === "string" && JOB_STATUSES.has(value as JobStatus);
}

function isJobStage(value: unknown): value is JobStage {
  return typeof value === "string" && JOB_STAGES.has(value as JobStage);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

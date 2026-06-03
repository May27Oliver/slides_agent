import type { PreviewJob } from "@/preview-job/preview-job.types";

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

  if (
    typeof parsed.id !== "string" ||
    typeof parsed.status !== "string" ||
    typeof parsed.stage !== "string" ||
    !isRecord(parsed.request) ||
    !isRecord(parsed.evidence)
  ) {
    throw new Error("Invalid serialized preview job: missing required fields");
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

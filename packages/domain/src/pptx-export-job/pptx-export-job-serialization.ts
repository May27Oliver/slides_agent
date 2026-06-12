import type { PptxExportJob, PptxExportJobStatus } from "@/pptx-export-job/pptx-export-job.types";

const STATUSES: ReadonlySet<PptxExportJobStatus> = new Set([
  "queued",
  "processing",
  "done",
  "failed"
]);

/** Wire form: Date fields as ISO strings so the job stores as JSON (Redis). */
export type SerializedPptxExportJob = Omit<
  PptxExportJob,
  "createdAt" | "updatedAt" | "expiresAt"
> & {
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export function serializePptxExportJob(job: PptxExportJob): SerializedPptxExportJob {
  return {
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    expiresAt: job.expiresAt.toISOString()
  };
}

export function deserializePptxExportJob(raw: string | unknown): PptxExportJob {
  const parsed: unknown = typeof raw === "string" ? safeJsonParse(raw) : raw;
  if (!isRecord(parsed)) {
    throw new Error("Invalid serialized pptx export job: expected an object");
  }

  const createdAt = parseIsoDate(parsed.createdAt, "createdAt");
  const updatedAt = parseIsoDate(parsed.updatedAt, "updatedAt");
  const expiresAt = parseIsoDate(parsed.expiresAt, "expiresAt");

  if (
    typeof parsed.id !== "string" ||
    typeof parsed.accountId !== "string" ||
    typeof parsed.deckId !== "string" ||
    typeof parsed.revision !== "number"
  ) {
    throw new Error("Invalid serialized pptx export job: missing required fields");
  }
  if (typeof parsed.status !== "string" || !STATUSES.has(parsed.status as PptxExportJobStatus)) {
    throw new Error("Invalid serialized pptx export job: unknown status");
  }

  return { ...(parsed as unknown as PptxExportJob), createdAt, updatedAt, expiresAt };
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid serialized pptx export job: not valid JSON");
  }
}

function parseIsoDate(value: unknown, field: string): Date {
  if (typeof value !== "string") {
    throw new Error(`Invalid serialized pptx export job: ${field} must be an ISO string`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid serialized pptx export job: ${field} is not a valid date`);
  }
  return date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

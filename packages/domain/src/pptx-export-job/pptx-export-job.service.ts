import {
  isTerminalPptxStatus,
  type PptxExportFailure,
  type PptxExportJob,
  type PptxExportJobRequest,
  type PptxExportResult
} from "@/pptx-export-job/pptx-export-job.types";

export interface PptxExportJobServiceOptions {
  idFactory?: () => string;
  now?: () => Date;
  retentionMs?: number;
}

/** Job + artifact retention (FR-018) — long enough to download, short enough to purge. */
const DEFAULT_RETENTION_MS = 30 * 60 * 1000;

export class PptxExportJobService {
  private readonly idFactory: () => string;
  private readonly now: () => Date;
  private readonly retentionMs: number;

  constructor(options: PptxExportJobServiceOptions = {}) {
    this.idFactory = options.idFactory ?? defaultIdFactory;
    this.now = options.now ?? (() => new Date());
    this.retentionMs = options.retentionMs ?? DEFAULT_RETENTION_MS;
  }

  createAcceptedJob(request: PptxExportJobRequest): PptxExportJob {
    const now = this.now();
    return {
      ...request,
      id: this.idFactory(),
      status: "queued",
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + this.retentionMs)
    };
  }

  markProcessing(job: PptxExportJob, at = this.now()): PptxExportJob {
    if (isTerminalPptxStatus(job.status)) {
      return job;
    }
    return { ...job, status: "processing", updatedAt: at };
  }

  markDone(job: PptxExportJob, result: PptxExportResult, at = this.now()): PptxExportJob {
    if (isTerminalPptxStatus(job.status)) {
      return job;
    }
    return { ...job, status: "done", updatedAt: at, result, pageCount: result.pageCount };
  }

  markFailed(job: PptxExportJob, failure: PptxExportFailure, at = this.now()): PptxExportJob {
    if (isTerminalPptxStatus(job.status)) {
      return job;
    }
    return { ...job, status: "failed", updatedAt: at, failure };
  }
}

export function createPptxTimeoutFailure(): PptxExportFailure {
  return { reason: "timeout", message: "PPTX export did not complete in time." };
}

export function createPptxExportFailure(_error: unknown): PptxExportFailure {
  return { reason: "export", message: "PPTX export failed." };
}

function defaultIdFactory(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `pptx_job_${random.replaceAll("-", "").slice(0, 16)}`;
}

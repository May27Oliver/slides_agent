import type {
  PptxExportFailure,
  PptxExportJob,
  PptxExportResult
} from "@/pptx-export-job/pptx-export-job.types";

/** Outcome of the atomic single-flight create (FR-006). */
export type CreatePptxExportJobResult =
  | { ok: true; job: PptxExportJob }
  | { ok: false; active: PptxExportJob };

export interface PptxExportJobStore {
  /**
   * FR-006 single-flight: atomically create the job IFF the account has no
   * non-terminal export; otherwise return the existing in-flight job. The check
   * and the write are one atomic step, so two concurrent POSTs from the same
   * account cannot both pass the gate (no TOCTOU).
   */
  createIfNoActive(job: PptxExportJob): Promise<CreatePptxExportJobResult>;
  findById(jobId: string): Promise<PptxExportJob | undefined>;
  /** Ids of non-terminal jobs — the timeout sweeper's scan set. */
  listActiveJobIds(): Promise<string[]>;
  markProcessing(jobId: string, at: Date): Promise<PptxExportJob | undefined>;
  markDone(jobId: string, result: PptxExportResult, at: Date): Promise<PptxExportJob | undefined>;
  markFailed(
    jobId: string,
    failure: PptxExportFailure,
    at: Date
  ): Promise<PptxExportJob | undefined>;
  /** Drops terminal/expired jobs from the active set; returns the expired ones. */
  expireOldJobs(at: Date): Promise<PptxExportJob[]>;
}

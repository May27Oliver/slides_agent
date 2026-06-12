import type {
  PptxExportFailure,
  PptxExportJob,
  PptxExportResult
} from "@/pptx-export-job/pptx-export-job.types";

export interface PptxExportJobStore {
  create(job: PptxExportJob): Promise<PptxExportJob>;
  findById(jobId: string): Promise<PptxExportJob | undefined>;
  /** Ids of non-terminal jobs — the timeout sweeper's scan set. */
  listActiveJobIds(): Promise<string[]>;
  /** The account's non-terminal job, if any — the single-flight gate (FR-006). */
  findActiveByAccount(accountId: string): Promise<PptxExportJob | undefined>;
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

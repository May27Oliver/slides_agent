import { isTerminalPptxStatus, type PptxExportJob } from "@/pptx-export-job/pptx-export-job.types";

/** Hard wall-clock limit per export (FR-020; ≤30 pages targets 90s, cap is generous). */
export const PPTX_EXPORT_JOB_TIMEOUT_MS = 3 * 60 * 1000;

/** Max slides per export — one oversized deck must not monopolize the worker (FR-019). */
export const PPTX_MAX_PAGES = 60;

export function hasPptxExportJobTimedOut(job: PptxExportJob, at: Date): boolean {
  if (isTerminalPptxStatus(job.status)) {
    return false;
  }
  return at.getTime() - job.createdAt.getTime() >= PPTX_EXPORT_JOB_TIMEOUT_MS;
}

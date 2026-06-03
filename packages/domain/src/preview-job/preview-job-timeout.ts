import type { JobStage, PreviewJob } from "@/preview-job/preview-job.types";
import { createTimeoutFailure } from "@/preview-job/preview-job.service";

export const PREVIEW_JOB_TIMEOUT_MS = 5 * 60 * 1000;

export function hasPreviewJobTimedOut(job: PreviewJob, at: Date): boolean {
  if (job.status === "succeeded" || job.status === "failed" || job.status === "expired") {
    return false;
  }

  return at.getTime() - job.createdAt.getTime() >= PREVIEW_JOB_TIMEOUT_MS;
}

export { createTimeoutFailure };

export function timeoutFailureForJob(job: PreviewJob): ReturnType<typeof createTimeoutFailure> {
  const failedStage: JobStage = job.stage === "failed" ? "html_generation" : job.stage;
  return createTimeoutFailure(failedStage);
}

import type { PreviewJob } from "@/preview-job/preview-job.types";

export interface PreviewJobRunner {
  start(job: PreviewJob): void | Promise<void>;
}

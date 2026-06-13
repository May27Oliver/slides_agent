import type { PptxExportJob } from "@/pptx-export-job/pptx-export-job.types";

export interface PptxExportJobRunner {
  start(job: PptxExportJob): void | Promise<void>;
}

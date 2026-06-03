import type {
  JobFailure,
  JobStage,
  PreviewJob,
  PreviewResult
} from "@/preview-job/preview-job.types";

export interface PreviewJobStore {
  create(job: PreviewJob): Promise<PreviewJob>;
  findById(jobId: string): Promise<PreviewJob | undefined>;
  markRunning(jobId: string, stage: JobStage, at: Date): Promise<PreviewJob | undefined>;
  markStage(jobId: string, stage: JobStage, at: Date): Promise<PreviewJob | undefined>;
  markSucceeded(jobId: string, result: PreviewResult, at: Date): Promise<PreviewJob | undefined>;
  markFailed(jobId: string, failure: JobFailure, at: Date): Promise<PreviewJob | undefined>;
  expireOldJobs(at: Date): Promise<PreviewJob[]>;
}

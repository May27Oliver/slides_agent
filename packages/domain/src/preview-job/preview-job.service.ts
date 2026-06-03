import {
  appendStageTransition,
  createInitialJobEvidence,
  isTerminalJobStatus,
  type FailureCategory,
  type JobFailure,
  type JobStage,
  type PreviewJob,
  type PreviewJobRequest,
  type PreviewResult
} from "@/preview-job/preview-job.types";

export interface PreviewJobServiceOptions {
  idFactory?: () => string;
  now?: () => Date;
  retentionMs?: number;
}

const DEFAULT_RETENTION_MS = 10 * 60 * 1000;

export class PreviewJobService {
  private readonly idFactory: () => string;
  private readonly now: () => Date;
  private readonly retentionMs: number;

  constructor(options: PreviewJobServiceOptions = {}) {
    this.idFactory = options.idFactory ?? defaultIdFactory;
    this.now = options.now ?? (() => new Date());
    this.retentionMs = options.retentionMs ?? DEFAULT_RETENTION_MS;
  }

  createAcceptedJob(request: PreviewJobRequest): PreviewJob {
    const now = this.now();
    return {
      id: this.idFactory(),
      status: "queued",
      stage: "request_accepted",
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + this.retentionMs),
      request,
      evidence: createInitialJobEvidence({
        acceptedAt: now,
        validationAccepted: true
      })
    };
  }

  markRunning(job: PreviewJob, stage: JobStage, at = this.now()): PreviewJob {
    if (isTerminalJobStatus(job.status)) {
      return job;
    }

    return {
      ...job,
      status: "running",
      stage,
      updatedAt: at,
      evidence: appendStageTransition(job.evidence, {
        stage,
        at,
        finalStatus: "running"
      })
    };
  }

  markStage(job: PreviewJob, stage: JobStage, at = this.now()): PreviewJob {
    if (isTerminalJobStatus(job.status)) {
      return job;
    }

    return {
      ...job,
      status: job.status === "queued" ? "running" : job.status,
      stage,
      updatedAt: at,
      evidence: appendStageTransition(job.evidence, {
        stage,
        at,
        finalStatus: job.status === "queued" ? "running" : job.status
      })
    };
  }

  markSucceeded(job: PreviewJob, result: PreviewResult, at = this.now()): PreviewJob {
    if (isTerminalJobStatus(job.status)) {
      return job;
    }

    return {
      ...job,
      status: "succeeded",
      stage: "completed",
      updatedAt: at,
      result,
      evidence: appendStageTransition(job.evidence, {
        stage: "completed",
        at,
        finalStatus: "succeeded"
      })
    };
  }

  markFailed(job: PreviewJob, failure: JobFailure, at = this.now()): PreviewJob {
    if (isTerminalJobStatus(job.status)) {
      return job;
    }

    return {
      ...job,
      status: "failed",
      stage: "failed",
      updatedAt: at,
      failure,
      evidence: {
        ...appendStageTransition(job.evidence, {
          stage: "failed",
          at,
          finalStatus: "failed"
        }),
        failureCategory: failureCategory(failure)
      }
    };
  }
}

export function createTimeoutFailure(failedStage: JobStage): JobFailure {
  return {
    code: "PREVIEW_JOB_TIMEOUT",
    message: "Preview generation did not complete in time.",
    failedStage,
    retryable: true,
    retryGuidance: "Create a new preview job."
  };
}

export function createGenerationFailure(_error: unknown, failedStage: JobStage): JobFailure {
  return {
    code: "PREVIEW_GENERATION_FAILED",
    message: "Preview generation failed.",
    failedStage,
    retryable: true,
    retryGuidance: "Create a new preview job."
  };
}

export function createUnavailableFailure(): JobFailure {
  return {
    code: "PREVIEW_JOB_UNAVAILABLE",
    message: "Preview job is unavailable.",
    failedStage: "failed",
    retryable: true,
    retryGuidance: "Create a new preview job."
  };
}

function failureCategory(failure: JobFailure): FailureCategory {
  if (failure.code === "PREVIEW_JOB_TIMEOUT") {
    return "timeout";
  }

  if (failure.code === "PREVIEW_JOB_UNAVAILABLE") {
    return "unavailable";
  }

  return "generation";
}

function defaultIdFactory(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `preview_job_${random.replaceAll("-", "").slice(0, 16)}`;
}

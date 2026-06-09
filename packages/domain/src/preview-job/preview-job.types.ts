export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "expired" | "unavailable";

export type JobStage =
  | "request_accepted"
  | "queued"
  | "content_planning"
  | "deck_planning"
  | "design_planning"
  | "html_generation"
  | "html_validation"
  | "repair_or_fallback"
  | "completed"
  | "failed";

export type FailureCategory = "timeout" | "generation" | "unavailable";

export interface PreviewJobRequest {
  sourceContent: string;
  deckBrief: {
    purpose: string;
    audience: string;
    styleDirection?: string;
    chartEmphasis?: string;
    segmentationGuidance?: string;
    language?: string;
  };
  /**
   * Owning account (feature 006). Set when the job is created from an
   * authenticated request so the worker can persist the result to that account.
   * Optional for backward compatibility with jobs serialized before 006.
   */
  accountId?: string;
}

export interface PreviewResult {
  slideDeck: unknown;
  designPlanningResult: unknown;
  previewArtifact: unknown;
  /**
   * 010 (C1/FR-006a): planned chart intents carried from generation so a persisted
   * revision keeps the source facts the renderer needs to redraw charts on edit.
   * Opaque here; null when the upstream result predates this field.
   */
  chartIntents?: unknown;
  /**
   * 010: id of the deck persisted from this result, so the client can navigate into
   * the editor on generation success. Null when persistence was skipped/failed.
   */
  deckId?: string | null;
}

export interface StageTransition {
  stage: JobStage;
  at: string;
}

export interface JobEvidence {
  acceptedAt: string;
  stageTransitions: StageTransition[];
  validationAccepted: boolean;
  fallbackUsed: boolean;
  repairAttempted: boolean;
  timingMs?: Record<string, number>;
  finalStatus: JobStatus;
  failureCategory?: FailureCategory;
}

export interface JobFailure {
  code: "PREVIEW_JOB_TIMEOUT" | "PREVIEW_GENERATION_FAILED" | "PREVIEW_JOB_UNAVAILABLE";
  message: string;
  failedStage: JobStage;
  retryable: boolean;
  retryGuidance: string;
}

export interface PreviewJob {
  id: string;
  status: JobStatus;
  stage: JobStage;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  request: PreviewJobRequest;
  evidence: JobEvidence;
  result?: PreviewResult;
  failure?: JobFailure;
}

export interface CreateInitialJobEvidenceInput {
  acceptedAt: Date;
  validationAccepted: boolean;
}

export function createInitialJobEvidence({
  acceptedAt,
  validationAccepted
}: CreateInitialJobEvidenceInput): JobEvidence {
  const acceptedAtIso = acceptedAt.toISOString();
  return {
    acceptedAt: acceptedAtIso,
    stageTransitions: [{ stage: "request_accepted", at: acceptedAtIso }],
    validationAccepted,
    fallbackUsed: false,
    repairAttempted: false,
    finalStatus: "queued"
  };
}

export interface AppendStageTransitionInput {
  stage: JobStage;
  at: Date;
  finalStatus?: JobStatus;
}

export function appendStageTransition(
  evidence: JobEvidence,
  { stage, at, finalStatus }: AppendStageTransitionInput
): JobEvidence {
  return {
    ...evidence,
    stageTransitions: [...evidence.stageTransitions, { stage, at: at.toISOString() }],
    ...(finalStatus ? { finalStatus } : {})
  };
}

export function isTerminalJobStatus(status: JobStatus): boolean {
  return status === "succeeded" || status === "failed" || status === "expired";
}

import { BadRequestException } from "@nestjs/common";
import {
  validateGeneratePreviewRequest,
  type GeneratePreviewRequestContract
} from "@slides-agent/contracts";

const MAX_JOB_ID_LENGTH = 128;
const SAFE_JOB_ID = /^[A-Za-z0-9_-]+$/u;

/**
 * Runs the shared contract validator and, on failure, throws a uniform 400 with
 * the validator's native `{ code, message, fields }` error. Both POST endpoints
 * use this so the same request contract always fails the same way (the validator
 * stays the single runtime source of truth — no parallel DTO rules to drift).
 */
export function parseGeneratePreviewRequest(input: unknown): GeneratePreviewRequestContract {
  const result = validateGeneratePreviewRequest(input);
  if (!result.ok) {
    throw new BadRequestException(result.error);
  }
  return result.value;
}

/**
 * Bounds the `:jobId` path param before it reaches the store lookup and logs:
 * non-empty, length-capped, and restricted to a safe id charset. Lenient enough
 * that a well-formed-but-unknown id still flows through to a normal 404.
 */
export function assertValidJobId(jobId: string): string {
  if (
    typeof jobId !== "string" ||
    jobId.length === 0 ||
    jobId.length > MAX_JOB_ID_LENGTH ||
    !SAFE_JOB_ID.test(jobId)
  ) {
    throw new BadRequestException({
      code: "INVALID_JOB_ID",
      message: "Invalid preview job id."
    });
  }
  return jobId;
}

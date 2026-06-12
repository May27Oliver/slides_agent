import { BadRequestException } from "@nestjs/common";
import { validateCreatePptxExportRequest } from "@slides-agent/contracts";
import type { CreatePptxExportRequestContract } from "@slides-agent/contracts";

export function parseCreatePptxExportRequest(body: unknown): CreatePptxExportRequestContract {
  const result = validateCreatePptxExportRequest(body);
  if (!result.ok) {
    throw new BadRequestException({
      code: "INVALID_PPTX_EXPORT_REQUEST",
      message: "Invalid PPTX export request.",
      fields: result.issues
    });
  }
  return result.value;
}

const JOB_ID_PATTERN = /^[A-Za-z0-9_-]+$/u;
const MAX_JOB_ID_LENGTH = 128;

/** Same surface rules as the preview job id — opaque token, bounded length. */
export function assertValidPptxJobId(jobId: string): void {
  if (jobId.length === 0 || jobId.length > MAX_JOB_ID_LENGTH || !JOB_ID_PATTERN.test(jobId)) {
    throw new BadRequestException({
      code: "INVALID_PPTX_EXPORT_REQUEST",
      message: "Invalid PPTX export job id."
    });
  }
}

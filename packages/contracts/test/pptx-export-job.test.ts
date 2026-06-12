import { describe, expect, it } from "vitest";
import {
  validateCreatePptxExportRequest,
  validatePptxExportJobStatusResponse
} from "@/pptx-export-job";

/** 015 US2: the three-step async contract — create / poll / download. */
describe("pptx export job contract (015 US2)", () => {
  it("accepts a well-formed create body ({ revision })", () => {
    const result = validateCreatePptxExportRequest({ revision: 3 });
    expect(result.ok).toBe(true);
  });

  it("rejects a missing, non-integer or negative revision", () => {
    expect(validateCreatePptxExportRequest({}).ok).toBe(false);
    expect(validateCreatePptxExportRequest({ revision: 1.5 }).ok).toBe(false);
    expect(validateCreatePptxExportRequest({ revision: -1 }).ok).toBe(false);
    expect(validateCreatePptxExportRequest("nope").ok).toBe(false);
  });

  it("validates a status response with the four states and optional fields", () => {
    const ok = validatePptxExportJobStatusResponse({
      jobId: "pptx_job_1",
      status: "done",
      pageCount: 12,
      downloadUrl: "/api/decks/d1/pptx-exports/pptx_job_1/file",
      createdAt: "2026-06-13T00:00:00.000Z",
      updatedAt: "2026-06-13T00:01:00.000Z"
    });
    expect(ok.ok).toBe(true);

    const failed = validatePptxExportJobStatusResponse({
      jobId: "pptx_job_1",
      status: "failed",
      failure: { reason: "timeout", message: "took too long" },
      createdAt: "2026-06-13T00:00:00.000Z",
      updatedAt: "2026-06-13T00:03:00.000Z"
    });
    expect(failed.ok).toBe(true);
  });

  it("rejects an unknown status or malformed failure", () => {
    expect(
      validatePptxExportJobStatusResponse({
        jobId: "j",
        status: "exploded",
        createdAt: "2026-06-13T00:00:00.000Z",
        updatedAt: "2026-06-13T00:00:00.000Z"
      }).ok
    ).toBe(false);
    expect(
      validatePptxExportJobStatusResponse({
        jobId: "j",
        status: "failed",
        failure: "broke",
        createdAt: "2026-06-13T00:00:00.000Z",
        updatedAt: "2026-06-13T00:00:00.000Z"
      }).ok
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { deserializePreviewJob, serializePreviewJob } from "@slides-agent/domain";
import type { PreviewJob } from "@slides-agent/domain";

function sampleJob(accountId?: string): PreviewJob {
  return {
    id: "preview_job_1",
    status: "succeeded",
    stage: "completed",
    createdAt: new Date("2026-06-05T00:00:00.000Z"),
    updatedAt: new Date("2026-06-05T00:01:00.000Z"),
    expiresAt: new Date("2026-06-05T00:10:00.000Z"),
    request: {
      sourceContent: "x",
      deckBrief: { purpose: "p", audience: "a" },
      ...(accountId ? { accountId } : {})
    },
    evidence: {
      acceptedAt: "2026-06-05T00:00:00.000Z",
      stageTransitions: [],
      validationAccepted: true,
      fallbackUsed: false,
      repairAttempted: false,
      finalStatus: "succeeded"
    }
  };
}

describe("preview job accountId round-trip", () => {
  it("preserves request.accountId through serialize -> JSON -> deserialize", () => {
    const wire = JSON.stringify(serializePreviewJob(sampleJob("user_owner")));
    const back = deserializePreviewJob(wire);
    expect(back.request.accountId).toBe("user_owner");
  });

  it("tolerates jobs serialized before 006 (no accountId)", () => {
    const wire = JSON.stringify(serializePreviewJob(sampleJob(undefined)));
    const back = deserializePreviewJob(wire);
    expect(back.request.accountId).toBeUndefined();
  });
});

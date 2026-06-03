import { describe, expect, it, vi } from "vitest";
import { InMemoryPreviewJobStore } from "../src/modules/slides/in-memory-preview-job-store";
import { InProcessPreviewJobRunner } from "../src/modules/slides/in-process-preview-job-runner";

describe("preview job runner", () => {
  it("updates stages and stores a successful preview result", async () => {
    const store = new InMemoryPreviewJobStore();
    const job = await store.create({
      id: "preview_job_success",
      status: "queued",
      stage: "request_accepted",
      createdAt: new Date("2026-06-02T14:00:00.000Z"),
      updatedAt: new Date("2026-06-02T14:00:00.000Z"),
      expiresAt: new Date("2026-06-02T14:10:00.000Z"),
      request: {
        sourceContent: "Source",
        deckBrief: { purpose: "Review", audience: "Team" }
      },
      evidence: {
        acceptedAt: "2026-06-02T14:00:00.000Z",
        stageTransitions: [{ stage: "request_accepted", at: "2026-06-02T14:00:00.000Z" }],
        validationAccepted: true,
        fallbackUsed: false,
        repairAttempted: false,
        finalStatus: "queued"
      }
    });
    const result = {
      slideDeck: { id: "deck_001" },
      designPlanningResult: { ok: true },
      previewArtifact: {
        html: "<!doctype html><html></html>",
        htmlGenerationValidation: {
          status: "pass",
          selfContained: true,
          slideCountAndOrderPreserved: true,
          contentFidelityPreserved: true,
          designCompliancePreserved: true,
          speakerNotesHidden: true,
          keyboardNavigationPresent: true,
          externalResourceIssues: [],
          contentIssues: [],
          designIssues: [],
          repairAttempted: false,
          fallbackUsed: false
        },
        generationSummary: {
          slideCount: 1,
          sourceFactCount: 1,
          chartIntentCount: 0,
          uncertainClaimCount: 0
        }
      }
    };
    const logger = testLogger();
    const generatePreview = vi.fn().mockImplementation(async (_request, progress) => {
      await progress.onStage("content_planning");
      await progress.onStage("deck_planning");
      await progress.onStage("design_planning");
      await progress.onStage("html_generation");
      await progress.onStage("html_validation");
      return result;
    });
    const runner = new InProcessPreviewJobRunner({
      store,
      slidesService: { generatePreview },
      now: deterministicClock(),
      logger
    });

    await runner.run(job);

    const stored = await store.findById(job.id);
    expect(stored).toMatchObject({
      status: "succeeded",
      stage: "completed",
      result
    });
    expect(stored?.evidence.stageTransitions.map((entry) => entry.stage)).toContain(
      "html_generation"
    );
    expect(logger.messages).toEqual(
      expect.arrayContaining([
        "preview_job_success stage=content_planning status=running",
        "preview_job_success stage=deck_planning status=running",
        "preview_job_success stage=design_planning status=running",
        "preview_job_success stage=html_generation status=running",
        "preview_job_success stage=html_validation status=running",
        "preview_job_success succeeded"
      ])
    );
    expect(generatePreview).toHaveBeenCalledWith(
      job.request,
      expect.objectContaining({
        onStage: expect.any(Function)
      })
    );
  });

  it("maps generation exceptions to sanitized JobFailure", async () => {
    const store = new InMemoryPreviewJobStore();
    const job = await store.create({
      id: "preview_job_failed",
      status: "queued",
      stage: "request_accepted",
      createdAt: new Date("2026-06-02T14:00:00.000Z"),
      updatedAt: new Date("2026-06-02T14:00:00.000Z"),
      expiresAt: new Date("2026-06-02T14:10:00.000Z"),
      request: {
        sourceContent: "Source",
        deckBrief: { purpose: "Review", audience: "Team" }
      },
      evidence: {
        acceptedAt: "2026-06-02T14:00:00.000Z",
        stageTransitions: [{ stage: "request_accepted", at: "2026-06-02T14:00:00.000Z" }],
        validationAccepted: true,
        fallbackUsed: false,
        repairAttempted: false,
        finalStatus: "queued"
      }
    });
    const logger = testLogger();
    const runner = new InProcessPreviewJobRunner({
      store,
      slidesService: {
        generatePreview: vi.fn().mockRejectedValue(new Error("sk-secret raw provider stack"))
      },
      now: deterministicClock(),
      logger
    });

    await runner.run(job);

    const stored = await store.findById(job.id);
    expect(stored?.status).toBe("failed");
    expect(stored?.failure).toEqual({
      code: "PREVIEW_GENERATION_FAILED",
      message: "Preview generation failed.",
      failedStage: "content_planning",
      retryable: true,
      retryGuidance: "Create a new preview job."
    });
    expect(JSON.stringify(stored?.failure)).not.toContain("sk-secret");
    expect(logger.messages).toContain(
      "preview_job_failed failed code=PREVIEW_GENERATION_FAILED stage=content_planning"
    );
    expect(logger.messages.join("\n")).not.toContain("sk-secret");
  });
});

function testLogger() {
  const messages: string[] = [];
  return {
    messages,
    log: (message: string) => messages.push(message),
    error: (message: string) => messages.push(message)
  };
}

function deterministicClock() {
  const dates = [
    "2026-06-02T14:00:01.000Z",
    "2026-06-02T14:00:02.000Z",
    "2026-06-02T14:00:03.000Z",
    "2026-06-02T14:00:04.000Z",
    "2026-06-02T14:00:05.000Z"
  ].map((value) => new Date(value));
  return () => dates.shift() ?? new Date("2026-06-02T14:00:06.000Z");
}

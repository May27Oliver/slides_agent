import { describe, expect, it, vi } from "vitest";
import RedisMock from "ioredis-mock";
import type { PreviewJob } from "@slides-agent/domain";
import { RedisPreviewJobStore } from "@/modules/slides/redis-preview-job-store";
import { runPreviewJobGeneration } from "@/modules/slides/preview-job-execution";

const CREATED_AT = new Date("2026-06-03T10:00:00.000Z");

function queuedJob(id: string): PreviewJob {
  return {
    id,
    status: "queued",
    stage: "request_accepted",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    expiresAt: new Date("2026-06-03T10:10:00.000Z"),
    request: { sourceContent: "Source", deckBrief: { purpose: "Review", audience: "Team" } },
    evidence: {
      acceptedAt: CREATED_AT.toISOString(),
      stageTransitions: [{ stage: "request_accepted", at: CREATED_AT.toISOString() }],
      validationAccepted: true,
      fallbackUsed: false,
      repairAttempted: false,
      finalStatus: "queued"
    }
  };
}

const RESULT = {
  slideDeck: { id: "deck_1" },
  designPlanningResult: { ok: true },
  previewArtifact: { html: "<!doctype html>" }
};

function testLogger() {
  const messages: string[] = [];
  return { messages, log: (m: string) => messages.push(m), error: (m: string) => messages.push(m) };
}

function clock(start = "2026-06-03T10:00:01.000Z") {
  let tick = new Date(start).getTime();
  return () => new Date((tick += 1000));
}

async function seed(store: RedisPreviewJobStore, job: PreviewJob): Promise<PreviewJob> {
  await store.create(job);
  return job;
}

describe("runPreviewJobGeneration", () => {
  it("advances stages and stores a successful result (US2)", async () => {
    const store = new RedisPreviewJobStore({ redis: new RedisMock(), now: clock() });
    const job = await seed(store, queuedJob("preview_job_ok"));
    const logger = testLogger();
    const generatePreview = vi.fn().mockImplementation(async (_request, progress) => {
      await progress.onStage("content_planning");
      await progress.onStage("deck_planning");
      await progress.onStage("design_planning");
      await progress.onStage("html_generation");
      await progress.onStage("html_validation");
      return RESULT;
    });

    await runPreviewJobGeneration({
      store,
      slidesService: { generatePreview },
      job,
      now: clock(),
      logger
    });

    const stored = await store.findById(job.id);
    expect(stored).toMatchObject({ status: "succeeded", stage: "completed", result: RESULT });
    expect(stored?.evidence.stageTransitions.map((e) => e.stage)).toContain("html_generation");
    expect(logger.messages).toContain("preview_job_ok succeeded");
    expect(generatePreview).toHaveBeenCalledWith(
      job.request,
      expect.objectContaining({ onStage: expect.any(Function) })
    );
  });

  it("maps generation exceptions to a sanitized JobFailure (US3)", async () => {
    const store = new RedisPreviewJobStore({ redis: new RedisMock(), now: clock() });
    const job = await seed(store, queuedJob("preview_job_fail"));
    const logger = testLogger();

    await runPreviewJobGeneration({
      store,
      slidesService: {
        generatePreview: vi.fn().mockRejectedValue(new Error("sk-secret raw provider stack"))
      },
      job,
      now: clock(),
      logger
    });

    const stored = await store.findById(job.id);
    expect(stored?.status).toBe("failed");
    expect(stored?.failure?.code).toBe("PREVIEW_GENERATION_FAILED");
    expect(JSON.stringify(stored?.failure)).not.toContain("sk-secret");
    expect(logger.messages.join("\n")).not.toContain("sk-secret");
  });
});

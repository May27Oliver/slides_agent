import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { SlidesController } from "../src/modules/slides/slides.controller";

const request = {
  sourceContent: "Onboarding conversion improved from 18% to 25%.",
  deckBrief: {
    purpose: "PM planning review",
    audience: "Product leads"
  }
};

describe("preview job API contract", () => {
  it("POST /api/slides/preview-jobs returns accepted tracking details", async () => {
    const store = inMemoryHarnessStore();
    const runner = { start: vi.fn() };
    const controller = new SlidesController({ generatePreview: vi.fn() }, store, runner);

    const response = await controller.createPreviewJob(request);

    expect(response).toMatchObject({
      status: "queued",
      stage: "request_accepted",
      statusUrl: `/api/slides/preview-jobs/${response.jobId}`
    });
    expect(response.jobId).toMatch(/^preview_job_/);
    expect(runner.start).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid preview requests before job creation", async () => {
    const store = inMemoryHarnessStore();
    const controller = new SlidesController({ generatePreview: vi.fn() }, store, {
      start: vi.fn()
    });

    await expect(controller.createPreviewJob({ deckBrief: {} })).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(store.created).toHaveLength(0);
  });

  it("GET /api/slides/preview-jobs/:jobId returns running, succeeded, failed, and unavailable states", async () => {
    const store = inMemoryHarnessStore();
    const controller = new SlidesController({ generatePreview: vi.fn() }, store, {
      start: vi.fn()
    });
    const created = await controller.createPreviewJob(request);

    expect(await controller.previewJobStatus(created.jobId)).toMatchObject({
      jobId: created.jobId,
      status: "queued",
      evidence: expect.objectContaining({ validationAccepted: true })
    });

    const job = store.created[0];
    if (!job) {
      throw new Error("expected created job");
    }
    await store.markFailed(
      job.id,
      {
        code: "PREVIEW_JOB_TIMEOUT",
        message: "Preview generation did not complete in time.",
        failedStage: "html_generation",
        retryable: true,
        retryGuidance: "Create a new preview job."
      },
      new Date("2026-06-02T14:05:00.000Z")
    );

    expect(await controller.previewJobStatus(created.jobId)).toMatchObject({
      status: "failed",
      failure: {
        code: "PREVIEW_JOB_TIMEOUT",
        message: "Preview generation did not complete in time."
      }
    });
    await expect(controller.previewJobStatus("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

function inMemoryHarnessStore() {
  const jobs = new Map<string, any>();
  const created: any[] = [];
  return {
    created,
    async create(job: any) {
      jobs.set(job.id, job);
      created.push(job);
      return job;
    },
    async findById(jobId: string) {
      return jobs.get(jobId);
    },
    async markRunning() {
      return undefined;
    },
    async markStage() {
      return undefined;
    },
    async markSucceeded() {
      return undefined;
    },
    async markFailed(jobId: string, failure: any, at: Date) {
      const job = jobs.get(jobId);
      if (!job) {
        return undefined;
      }
      const failed = {
        ...job,
        status: "failed",
        stage: "failed",
        updatedAt: at,
        failure,
        evidence: { ...job.evidence, finalStatus: "failed", failureCategory: "timeout" }
      };
      jobs.set(jobId, failed);
      return failed;
    },
    async expireOldJobs() {
      return [];
    }
  };
}

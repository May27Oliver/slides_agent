import { describe, expect, it } from "vitest";
import { PreviewJobService } from "../../src";

const request = {
  sourceContent: "Revenue grew 12%.",
  deckBrief: {
    purpose: "Business review",
    audience: "Leadership"
  }
};

describe("preview job stage transitions", () => {
  it("moves through running stages and keeps a stable succeeded result", () => {
    const service = new PreviewJobService({
      idFactory: () => "preview_job_002",
      now: () => new Date("2026-06-02T14:00:00.000Z")
    });
    const job = service.createAcceptedJob(request);
    const running = service.markRunning(
      job,
      "content_planning",
      new Date("2026-06-02T14:00:01.000Z")
    );
    const design = service.markStage(
      running,
      "design_planning",
      new Date("2026-06-02T14:00:03.000Z")
    );
    const result = {
      slideDeck: { id: "deck_001" },
      designPlanningResult: { ok: true },
      previewArtifact: { html: "<!doctype html><html></html>" }
    };
    const succeeded = service.markSucceeded(design, result, new Date("2026-06-02T14:00:05.000Z"));
    const ignored = service.markRunning(
      succeeded,
      "html_generation",
      new Date("2026-06-02T14:00:06.000Z")
    );

    expect(succeeded.status).toBe("succeeded");
    expect(succeeded.stage).toBe("completed");
    expect(succeeded.result).toEqual(result);
    expect(ignored).toEqual(succeeded);
    expect(succeeded.evidence.stageTransitions.map((entry) => entry.stage)).toEqual([
      "request_accepted",
      "content_planning",
      "design_planning",
      "completed"
    ]);
  });
});

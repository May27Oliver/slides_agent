// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SlideGenerationFeature } from "@/features/slide-generation/SlideGenerationFeature";

const createPreviewJob = vi.fn();
const fetchPreviewJobStatus = vi.fn();
vi.mock("@/features/slide-generation/preview-job-polling", () => ({
  createPreviewJob: (...a: unknown[]) => createPreviewJob(...a),
  fetchPreviewJobStatus: (...a: unknown[]) => fetchPreviewJobStatus(...a),
  isTerminalPreviewJobStatus: (status: string) =>
    status === "succeeded" || status === "failed" || status === "expired"
}));

afterEach(() => {
  cleanup();
  createPreviewJob.mockReset();
  fetchPreviewJobStatus.mockReset();
});

describe("SlideGenerationFeature → editor navigation (010)", () => {
  it("calls onGenerated with the persisted deckId when the job succeeds", async () => {
    createPreviewJob.mockResolvedValue({
      jobId: "job_1",
      status: "queued",
      stage: "request_accepted",
      statusUrl: "/api/slides/preview-jobs/job_1"
    });
    fetchPreviewJobStatus.mockResolvedValue({
      jobId: "job_1",
      status: "succeeded",
      stage: "completed",
      result: {
        deckId: "deck_new_99",
        slideDeck: { title: "T", slides: [] },
        designPlanningResult: {},
        previewArtifact: {
          html: "<x/>",
          htmlGenerationValidation: {
            status: "pass",
            selfContained: true,
            repairAttempted: false,
            fallbackUsed: false
          },
          generationSummary: {
            slideCount: 0,
            sourceFactCount: 0,
            chartIntentCount: 0,
            uncertainClaimCount: 0
          }
        }
      }
    });
    const onGenerated = vi.fn();

    render(<SlideGenerationFeature onGenerated={onGenerated} />);

    fireEvent.change(screen.getByLabelText("原始內容"), {
      target: { value: "一些足夠長的來源內容用於生成" }
    });
    fireEvent.change(screen.getByLabelText("簡報用途"), { target: { value: "季度回顧" } });
    fireEvent.change(screen.getByLabelText("目標受眾"), { target: { value: "主管" } });
    fireEvent.click(screen.getByRole("button", { name: "生成簡報" }));

    await waitFor(() => expect(onGenerated).toHaveBeenCalledWith("deck_new_99"));
  });

  it("does not navigate when the result carries no deckId (graceful fallback)", async () => {
    createPreviewJob.mockResolvedValue({
      jobId: "job_2",
      status: "queued",
      stage: "request_accepted",
      statusUrl: "/api/slides/preview-jobs/job_2"
    });
    fetchPreviewJobStatus.mockResolvedValue({
      jobId: "job_2",
      status: "succeeded",
      stage: "completed",
      result: {
        slideDeck: { title: "T", slides: [] },
        designPlanningResult: {},
        previewArtifact: {
          html: "<x/>",
          htmlGenerationValidation: {
            status: "pass",
            selfContained: true,
            repairAttempted: false,
            fallbackUsed: false
          },
          generationSummary: {
            slideCount: 0,
            sourceFactCount: 0,
            chartIntentCount: 0,
            uncertainClaimCount: 0
          }
        }
      }
    });
    const onGenerated = vi.fn();

    render(<SlideGenerationFeature onGenerated={onGenerated} />);
    fireEvent.change(screen.getByLabelText("原始內容"), {
      target: { value: "一些足夠長的來源內容用於生成" }
    });
    fireEvent.change(screen.getByLabelText("簡報用途"), { target: { value: "季度回顧" } });
    fireEvent.change(screen.getByLabelText("目標受眾"), { target: { value: "主管" } });
    fireEvent.click(screen.getByRole("button", { name: "生成簡報" }));

    await waitFor(() => expect(fetchPreviewJobStatus).toHaveBeenCalled());
    expect(onGenerated).not.toHaveBeenCalled();
  });
});

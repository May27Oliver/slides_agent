// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PreviewJobProgressPanel } from "@/features/slide-generation/PreviewJobProgressPanel";

describe("preview job flow UI", () => {
  it("shows queued/running progress state after job acceptance", () => {
    render(
      <PreviewJobProgressPanel
        job={{
          jobId: "preview_job_123",
          status: "running",
          stage: "design_planning",
          createdAt: "2026-06-02T14:00:00.000Z",
          updatedAt: "2026-06-02T14:00:08.000Z",
          evidence: {
            stageTransitions: [{ stage: "design_planning", at: "2026-06-02T14:00:08.000Z" }],
            validationAccepted: true,
            fallbackUsed: false,
            repairAttempted: false,
            finalStatus: "running"
          }
        }}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText("正在生成預覽")).toBeTruthy();
    expect(screen.getByText("設計規劃")).toBeTruthy();
    expect(screen.getByText("preview_job_123")).toBeTruthy();
  });

  it("shows safe failed state and retry action", () => {
    render(
      <PreviewJobProgressPanel
        job={{
          jobId: "preview_job_456",
          status: "failed",
          stage: "failed",
          createdAt: "2026-06-02T14:00:00.000Z",
          updatedAt: "2026-06-02T14:05:00.000Z",
          failure: {
            code: "PREVIEW_GENERATION_FAILED",
            message: "OpenAI sk-secret stack trace",
            failedStage: "design_planning",
            retryable: true,
            retryGuidance: "Create a new preview job."
          },
          evidence: {
            stageTransitions: [{ stage: "failed", at: "2026-06-02T14:05:00.000Z" }],
            validationAccepted: true,
            fallbackUsed: false,
            repairAttempted: false,
            finalStatus: "failed",
            failureCategory: "generation"
          }
        }}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText("生成失敗")).toBeTruthy();
    expect(screen.getByRole("button", { name: "重新產生" })).toBeTruthy();
    expect(screen.queryByText(/sk-secret|stack trace/i)).toBeNull();
  });
});

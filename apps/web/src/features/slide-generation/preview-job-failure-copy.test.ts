import { describe, expect, it } from "vitest";
import { previewJobFailureCopy } from "@/features/slide-generation/preview-job-failure-copy";

describe("preview job failure copy", () => {
  it("maps failure codes to safe user-facing copy", () => {
    const timeout = previewJobFailureCopy({
      code: "PREVIEW_JOB_TIMEOUT",
      message: "sk-secret raw provider timeout stack trace model=gpt-internal",
      failedStage: "html_generation",
      retryable: true,
      retryGuidance: "Create a new preview job."
    });

    expect(timeout).toEqual({
      title: "生成逾時",
      message: "這次預覽生成花費超過預期時間，系統已停止處理。",
      actionLabel: "重新產生",
      canRetry: true
    });
    expect(JSON.stringify(timeout)).not.toMatch(/sk-secret|raw provider|stack trace|gpt-internal/i);
  });

  it("returns unavailable copy when the job cannot be found", () => {
    expect(previewJobFailureCopy(undefined, "unavailable")).toEqual({
      title: "無法取得此工作",
      message: "這個預覽工作已不存在或無法查詢。請重新送出生成請求。",
      actionLabel: "重新產生",
      canRetry: true
    });
  });
});

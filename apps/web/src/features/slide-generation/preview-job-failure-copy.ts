import type { PreviewJobFailure } from "@/features/slide-generation/slide-generation.types";

export interface PreviewJobFailureCopy {
  title: string;
  message: string;
  actionLabel: string;
  canRetry: boolean;
}

export function previewJobFailureCopy(
  failure?: PreviewJobFailure,
  state?: "unavailable"
): PreviewJobFailureCopy {
  if (state === "unavailable" || failure?.code === "PREVIEW_JOB_UNAVAILABLE") {
    return {
      title: "無法取得此工作",
      message: "這個預覽工作已不存在或無法查詢。請重新送出生成請求。",
      actionLabel: "重新產生",
      canRetry: true
    };
  }

  if (failure?.code === "PREVIEW_JOB_TIMEOUT") {
    return {
      title: "生成逾時",
      message: "這次預覽生成花費超過預期時間，系統已停止處理。",
      actionLabel: "重新產生",
      canRetry: failure.retryable
    };
  }

  return {
    title: "生成失敗",
    message: "我們無法完成這次預覽生成。你可以稍後重試，或調整輸入內容後再試一次。",
    actionLabel: "重新產生",
    canRetry: failure?.retryable ?? true
  };
}

import { AlertIcon, SparklesIcon } from "@/components/icons";
import { previewJobFailureCopy } from "@/features/slide-generation/preview-job-failure-copy";
import type {
  PreviewJobStage,
  PreviewJobStatusResponse
} from "@/features/slide-generation/slide-generation.types";

interface PreviewJobProgressPanelProps {
  job: PreviewJobStatusResponse;
  onRetry: () => void;
}

const stageLabels: Record<PreviewJobStage, string> = {
  request_accepted: "已接受請求",
  queued: "等待處理",
  content_planning: "內容規劃",
  deck_planning: "簡報規劃",
  design_planning: "設計規劃",
  html_generation: "HTML 生成",
  html_validation: "HTML 驗證",
  repair_or_fallback: "修復或 fallback",
  completed: "完成",
  failed: "失敗"
};

export function PreviewJobProgressPanel({ job, onRetry }: PreviewJobProgressPanelProps) {
  if (job.status === "failed" || job.status === "expired") {
    const copy = previewJobFailureCopy(
      job.failure,
      job.status === "expired" ? "unavailable" : undefined
    );
    return (
      <div className="m-6 rounded-xl border border-accent-400 bg-orange-50 p-5 text-left lg:m-8">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-accent-600">
            <AlertIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold text-ink">{copy.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{copy.message}</p>
            <p className="mt-3 text-xs font-semibold text-ink-soft">{job.jobId}</p>
            {copy.canRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex items-center justify-center rounded-lg bg-accent-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-600"
              >
                {copy.actionLabel}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="m-6 rounded-xl border border-line bg-panel p-5 text-left shadow-sm lg:m-8">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-100 text-brand-700">
          <SparklesIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-extrabold text-ink">正在生成預覽</h2>
          <p className="mt-1 text-sm text-ink-soft">{stageLabels[job.stage]}</p>
          <p className="mt-3 text-xs font-semibold text-ink-soft">{job.jobId}</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-brand-100">
            <div className="h-full w-2/3 rounded-full bg-brand-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

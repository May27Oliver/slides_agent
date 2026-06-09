import { useEffect, useMemo, useRef, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PresentationIcon } from "@/components/icons";
import { PreviewJobProgressPanel } from "@/features/slide-generation/PreviewJobProgressPanel";
import { ResultsPanel } from "@/features/slide-generation/ResultsPanel";
import { SlideGenerationForm } from "@/features/slide-generation/SlideGenerationForm";
import { buildHtmlDownload } from "@/features/slide-generation/download-html";
import {
  createPreviewJob,
  fetchPreviewJobStatus,
  isTerminalPreviewJobStatus
} from "@/features/slide-generation/preview-job-polling";
import type {
  GeneratedPreviewArtifact,
  PreviewJobStatusResponse,
  SlideGenerationRequest
} from "@/features/slide-generation/slide-generation.types";
import { useI18n } from "@/i18n";

interface SlideGenerationFeatureProps {
  initialPreview?: GeneratedPreviewArtifact;
  /** Injected by the protected route as the auth-aware fetch (adds the bearer token, clears on 401). */
  fetchImpl?: typeof fetch;
  /**
   * 010: called with the persisted deckId when generation succeeds. The route wires
   * this to navigation (→ editor). Injected (not useNavigate here) so the component
   * stays renderable outside a Router in tests.
   */
  onGenerated?: (deckId: string) => void;
}

export function SlideGenerationFeature({
  initialPreview,
  fetchImpl = fetch,
  onGenerated
}: SlideGenerationFeatureProps = {}) {
  const { t } = useI18n();
  const [preview, setPreview] = useState<GeneratedPreviewArtifact | undefined>(initialPreview);
  const [previewJob, setPreviewJob] = useState<PreviewJobStatusResponse | undefined>();
  const [lastRequest, setLastRequest] = useState<SlideGenerationRequest | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const htmlDownload = useMemo(
    () => (preview ? buildHtmlDownload(preview.previewArtifact.html) : undefined),
    [preview]
  );
  const abortRef = useRef<AbortController | null>(null);

  // Abort any in-flight polling loop when the component unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function handleSubmit(request: SlideGenerationRequest) {
    // Cancel a previous run so re-submissions never race to set state.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    setIsSubmitting(true);
    setErrorMessage(undefined);
    setPreview(undefined);
    setLastRequest(request);

    try {
      const created = await createPreviewJob(request, fetchImpl, signal);
      setPreviewJob(queuedStatusFromCreateResponse(created));

      let current = await fetchPreviewJobStatus(created.statusUrl, fetchImpl, signal);
      setPreviewJob(current);

      let polls = 0;
      while (!isTerminalPreviewJobStatus(current.status)) {
        if (polls >= MAX_POLLS) {
          throw new Error("Preview job polling exceeded its budget");
        }
        polls += 1;
        await wait(POLL_INTERVAL_MS, signal);
        current = await fetchPreviewJobStatus(created.statusUrl, fetchImpl, signal);
        setPreviewJob(current);
      }

      if (current.status === "succeeded" && current.result) {
        setPreview(current.result);
        setPreviewJob(undefined);
        // 010: jump straight into the editor for the freshly persisted deck. Falls back
        // to the inline preview when no deckId came back (persistence skipped/failed).
        if (current.result.deckId) {
          onGenerated?.(current.result.deckId);
        }
      }
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      setErrorMessage(t("error.generic"));
    } finally {
      // Only the run that still owns the controller may flip the flag back;
      // a superseded run must not clear the new submission's spinner.
      if (abortRef.current === controller) {
        setIsSubmitting(false);
      }
    }
  }

  function handleRetry() {
    if (lastRequest) {
      void handleSubmit(lastRequest);
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-surface text-ink lg:h-screen lg:overflow-hidden">
      <header className="sticky top-0 z-30 shrink-0 border-b border-line bg-panel/85 backdrop-blur">
        <div className="flex w-full items-center justify-between gap-4 px-6 py-3.5 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-sm">
              <PresentationIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-brand-700">
                {t("app.brand")}
              </p>
              <h1 className="truncate text-lg font-extrabold leading-tight text-ink">
                {t("app.title")}
              </h1>
            </div>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="grid w-full flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[minmax(360px,440px)_minmax(0,1fr)]">
        <section
          aria-label={t("form.heading")}
          className="scroll-area border-line lg:h-full lg:min-h-0 lg:overflow-y-auto lg:border-r"
        >
          <SlideGenerationForm
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            errorMessage={errorMessage}
            fetchImpl={fetchImpl}
          />
        </section>

        <section
          aria-label={t("results.title")}
          className="scroll-area bg-surface lg:h-full lg:min-h-0 lg:overflow-y-auto"
        >
          {previewJob ? <PreviewJobProgressPanel job={previewJob} onRetry={handleRetry} /> : null}
          <ResultsPanel preview={preview} htmlDownload={htmlDownload} />
        </section>
      </main>
    </div>
  );
}

function queuedStatusFromCreateResponse(created: {
  jobId: string;
  status: "queued";
  stage: "request_accepted";
  createdAt: string;
  updatedAt: string;
}): PreviewJobStatusResponse {
  return {
    jobId: created.jobId,
    status: created.status,
    stage: created.stage,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
    evidence: {
      stageTransitions: [{ stage: "request_accepted", at: created.createdAt }],
      validationAccepted: true,
      fallbackUsed: false,
      repairAttempted: false,
      finalStatus: "queued"
    }
  };
}

const POLL_INTERVAL_MS = 1000;
// Server caps jobs at 5 min; template-primary runs ~100s. 360 * 1s = 6 min ceiling.
const MAX_POLLS = 360;

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

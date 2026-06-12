import { useCallback, useEffect, useRef, useState } from "react";
import {
  createPptxExport,
  downloadPptxArtifact,
  fetchPptxExportStatus,
  isTerminalPptxExportStatus
} from "@/features/deck-editor/pptx-export-client";
import { useI18n } from "@/i18n";

interface PptxExportButtonProps {
  deckId: string;
  /** The adopted revision number — the ONLY version this button will export. */
  revision: number;
  /** Unsaved edits block the export, same as the HTML download (FR-002). */
  dirty: boolean;
  fetchImpl?: typeof fetch;
  pollIntervalMs?: number;
}

type ExportState =
  | { kind: "idle" }
  | { kind: "polling"; statusUrl: string; status: "queued" | "processing" }
  | { kind: "done" }
  | { kind: "failed" };

/**
 * 015 US2 (FR-003/FR-020): the editor's PPTX entry. Creates an export job for the
 * adopted revision, polls the four-state status without blocking editing, triggers
 * the authenticated download on done, and offers a retry on failure.
 */
export function PptxExportButton({
  deckId,
  revision,
  dirty,
  fetchImpl = fetch,
  pollIntervalMs = 2000
}: PptxExportButtonProps) {
  const { t } = useI18n();
  const [state, setState] = useState<ExportState>({ kind: "idle" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);
  useEffect(() => stopPolling, [stopPolling]);

  // A new save (revision change) or fresh edits reset a finished/failed state.
  useEffect(() => {
    setState((current) => (current.kind === "polling" ? current : { kind: "idle" }));
  }, [revision]);

  const poll = useCallback(
    (statusUrl: string) => {
      stopPolling();
      pollRef.current = setInterval(() => {
        void fetchPptxExportStatus(statusUrl, fetchImpl)
          .then(async (status) => {
            if (!isTerminalPptxExportStatus(status.status)) {
              setState({ kind: "polling", statusUrl, status: status.status as "queued" | "processing" });
              return;
            }
            stopPolling();
            if (status.status === "done" && status.downloadUrl) {
              await downloadPptxArtifact(status.downloadUrl, fetchImpl);
              setState({ kind: "done" });
            } else {
              setState({ kind: "failed" });
            }
          })
          .catch(() => {
            stopPolling();
            setState({ kind: "failed" });
          });
      }, pollIntervalMs);
    },
    [fetchImpl, pollIntervalMs, stopPolling]
  );

  const start = useCallback(() => {
    void createPptxExport(deckId, revision, fetchImpl)
      .then((created) => {
        setState({ kind: "polling", statusUrl: created.statusUrl, status: "queued" });
        poll(created.statusUrl);
      })
      .catch(() => setState({ kind: "failed" }));
  }, [deckId, revision, fetchImpl, poll]);

  if (state.kind === "polling") {
    return (
      <span className="text-xs text-ink-soft" role="status">
        {state.status === "queued" ? t("editor.pptx.queued") : t("editor.pptx.processing")}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      {state.kind === "done" ? (
        <span className="text-xs text-emerald-600" role="status">
          {t("editor.pptx.done")}
        </span>
      ) : null}
      {state.kind === "failed" ? (
        <span className="text-xs text-red-600" role="status">
          {t("editor.pptx.failed")}
        </span>
      ) : null}
      {dirty ? (
        <span
          title={t("editor.download.needSave")}
          className="cursor-not-allowed rounded-lg border border-line px-3 py-1 font-medium text-ink-soft opacity-50"
        >
          {t("editor.download.pptx")}
        </span>
      ) : (
        <button
          type="button"
          onClick={start}
          className="cursor-pointer rounded-lg border border-line px-3 py-1 font-medium text-ink hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
        >
          {state.kind === "failed" ? t("editor.pptx.retry") : t("editor.download.pptx")}
        </button>
      )}
    </span>
  );
}

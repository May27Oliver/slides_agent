import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DeckRevisionContract } from "@slides-agent/contracts";
import type {
  ChartOperation,
  GenerationSummary,
  ManualThemeSelection,
  SelectableTheme,
  SlideDeck
} from "@slides-agent/domain";
import { useI18n } from "@/i18n";
import { renderLivePreview } from "@/features/deck-editor/live-preview-render";

interface LivePreviewProps {
  base: DeckRevisionContract;
  workingDeck: SlideDeck;
  /** Index of the slide being edited — the preview jumps to it (FR sync). */
  selectedIndex: number;
  /** Optional authoritative html (after a save) to display verbatim instead. */
  authoritativeHtml?: string | null;
  /** 011: manual theme override + catalogue, so the live preview re-themes with parity. */
  themeSelection?: ManualThemeSelection;
  themeCandidates?: SelectableTheme[];
  /** 014: pending chart operations — rendered with the same domain pipeline (parity). */
  chartOperations?: readonly ChartOperation[];
  /** 014: latest local render's summary (chart notes / disclosures), null on failure. */
  onSummary?: (summary: GenerationSummary | null) => void;
  debounceMs?: number;
}

/**
 * 010 (US1, FR-005a): right column. Renders the working deck locally with the same
 * domain use-case the server uses on save (debounced, zero network). The preview is
 * kept in sync with the slide being edited (postMessage → the deck runtime's
 * navigation), and can be opened fullscreen with `F`. A local render failure degrades
 * to a soft message — it never blocks editing or saving.
 */
export function LivePreview({
  base,
  workingDeck,
  selectedIndex,
  authoritativeHtml,
  themeSelection,
  themeCandidates,
  chartOperations,
  onSummary,
  debounceMs = 250
}: LivePreviewProps) {
  const { t } = useI18n();
  const [debounced, setDebounced] = useState(workingDeck);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(workingDeck), debounceMs);
    return () => clearTimeout(id);
  }, [workingDeck, debounceMs]);

  const local = useMemo(
    () =>
      renderLivePreview(base, debounced, {
        ...(themeSelection ? { themeSelection } : {}),
        ...(themeCandidates ? { candidates: themeCandidates } : {}),
        ...(chartOperations && chartOperations.length > 0
          ? { chartOperations: [...chartOperations] }
          : {})
      }),
    [base, debounced, themeSelection, themeCandidates, chartOperations]
  );
  const html = authoritativeHtml ?? (local.ok ? local.html : null);

  // 014: surface the local render's summary so the edit panel's chart cards show
  // the same notes/disclosures the server would store.
  const onSummaryRef = useRef(onSummary);
  onSummaryRef.current = onSummary;
  useEffect(() => {
    onSummaryRef.current?.(local.ok ? local.generationSummary : null);
  }, [local]);

  // Tell the deck runtime which slide to show, so the preview tracks the edited slide.
  const syncSelectedSlide = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "deck:goToSlide", index: selectedIndex },
      "*"
    );
  }, [selectedIndex]);

  // On selection change (no re-render): navigate the already-loaded preview.
  useEffect(() => {
    syncSelectedSlide();
  }, [syncSelectedSlide]);

  // F → open the preview fullscreen, unless the user is typing in a field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "f" && event.key !== "F") {
        return;
      }
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) {
        return;
      }
      event.preventDefault();
      void fullscreenRef.current?.requestFullscreen?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section aria-label={t("editor.preview.heading")} className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">{t("editor.preview.heading")}</h2>
        <span className="rounded-md bg-surface px-2 py-0.5 text-xs text-ink-soft">
          {t("editor.preview.fullscreenHint")}
        </span>
      </div>
      {html ? (
        <div ref={fullscreenRef} className="min-h-0 flex-1 bg-[#0b1512]">
          <iframe
            ref={iframeRef}
            onLoad={syncSelectedSlide}
            className="h-full w-full overflow-hidden rounded-2xl border border-line bg-[#0b1512]"
            srcDoc={html}
            title={t("editor.preview.heading")}
            // Untrusted deck HTML gets an opaque origin; allow-scripts keeps keyboard nav.
            sandbox="allow-scripts"
            allow="fullscreen"
            referrerPolicy="no-referrer"
          />
        </div>
      ) : (
        <p className="rounded-2xl border border-line bg-panel px-4 py-6 text-sm text-ink-soft">
          {t("editor.preview.error")}
        </p>
      )}
    </section>
  );
}

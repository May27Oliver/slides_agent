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

// Fixed 16:9 presentation stage the deck renders into; the whole stage is scaled to
// fit the available area, so the preview is a true miniature of the real slide. 1920×1080
// matches the PPTX screenshot capture, so an absolute-px text override (015 US3) occupies
// the SAME fraction of the slide in the preview and the export (WYSIWYG).
const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;

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
  /** 014: the user navigated INSIDE the preview (‹ › / keys / dots) — follow it. */
  onSlideChange?: (index: number) => void;
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
  onSlideChange,
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

  // 014: reverse sync — the deck runtime broadcasts user navigation; only messages
  // from OUR iframe are honoured (the sandboxed deck html is untrusted content).
  const onSlideChangeRef = useRef(onSlideChange);
  onSlideChangeRef.current = onSlideChange;
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as { type?: string; index?: number } | null;
      if (data?.type === "deck:slideChanged" && typeof data.index === "number") {
        onSlideChangeRef.current?.(data.index);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

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

  // 015 US4 (FR-012): render the deck at a FIXED 16:9 presentation stage and scale
  // the whole thing down to fit — a true slide thumbnail. (Resizing the iframe itself
  // instead made the deck's clamp()/vh layout render at the small size, overflow, and
  // clip — so the preview showed a cramped crop, not the whole slide.) A ResizeObserver
  // recomputes the fit scale on layout/fullscreen changes.
  const stageBoxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const box = stageBoxRef.current;
    if (!box) return;
    const measure = () => {
      const { width, height } = box.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setScale(Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT));
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      return; // non-DOM/test env: one static measure is enough
    }
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [html]);

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
        // The fullscreen target centers a fixed 1280×720 stage and clips overflow; the
        // stage is scaled to fit (above), so the FULL slide shows at true 16:9 — no
        // letterbox-vs-content mismatch, no rounded frame (a real slide is full-bleed,
        // matching the PPTX export).
        <div
          ref={fullscreenRef}
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#0b1512]"
        >
          <div ref={stageBoxRef} aria-hidden className="absolute inset-0" />
          <div
            data-testid="preview-stage"
            className="shrink-0 origin-center overflow-hidden"
            style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, transform: `scale(${scale})` }}
          >
            <iframe
              ref={iframeRef}
              onLoad={syncSelectedSlide}
              className="block border-0 bg-[#0b1512]"
              style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
              srcDoc={html}
              title={t("editor.preview.heading")}
              // Untrusted deck HTML gets an opaque origin; allow-scripts keeps keyboard nav.
              sandbox="allow-scripts"
              allow="fullscreen"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      ) : (
        <p className="rounded-2xl border border-line bg-panel px-4 py-6 text-sm text-ink-soft">
          {t("editor.preview.error")}
        </p>
      )}
    </section>
  );
}

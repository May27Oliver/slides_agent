import type { RenderedChartSummaryContract } from "@slides-agent/contracts";
import type { ChartVisualOverride } from "@slides-agent/domain";
import { useI18n, type TranslationKey } from "@/i18n";

const SELECTABLE_VISUALS: ChartVisualOverride[] = [
  "auto",
  "pie_donut",
  "line",
  "bar",
  "metric_card",
  "table"
];

interface ChartEditorCardProps {
  chartIntentId: string;
  /** The chart intent's human title. */
  title: string;
  /** The draft's pending override ("auto" when none). */
  selectedVisual: ChartVisualOverride;
  /** This intent's render evidence from the live preview summary (R10). */
  renderedChart?: RenderedChartSummaryContract;
  /** Other pages (1-based) where the same intent is placed — edits affect them too. */
  sharedPages: number[];
  /** US3 (FR-009): the chart's user-data disclosure from the preview summary. */
  disclosure?: { userPointCount: number; totalPointCount: number };
  onSetVisual: (visual: ChartVisualOverride) => void;
  /** US2: remove button handler; null hides the button (US1 scope). */
  onRemove: (() => void) | null;
  /** US3: the data-point editor table, composed by the page. */
  children?: React.ReactNode;
}

/**
 * 014 (US1, FR-001~004): per-chart editor card — visual selector backed by the
 * structured operations channel. The selector requests a visual; the domain
 * validators still gate what actually renders, and any degradation comes back
 * through the live preview's notes (FR-003, honest disclosure).
 */
export function ChartEditorCard({
  chartIntentId,
  title,
  selectedVisual,
  renderedChart,
  sharedPages,
  disclosure,
  onSetVisual,
  onRemove,
  children
}: ChartEditorCardProps) {
  const { t } = useI18n();
  const selectId = `chart-visual-${chartIntentId}`;
  const notes = renderedChart?.notes ?? [];

  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            {t("editor.chart.heading")}
          </p>
          <p className="truncate text-sm font-medium text-ink">{title}</p>
        </div>
        {onRemove ? (
          <button
            type="button"
            aria-label={t("editor.chart.remove")}
            onClick={onRemove}
            className="shrink-0 rounded border border-line px-2 py-1 text-xs text-red-600 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
          >
            ✕ {t("editor.chart.remove")}
          </button>
        ) : null}
      </div>

      <div className="mt-2">
        <label
          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft"
          htmlFor={selectId}
        >
          {t("editor.chart.visual")}
        </label>
        <select
          id={selectId}
          className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
          value={selectedVisual}
          onChange={(event) => onSetVisual(event.target.value as ChartVisualOverride)}
        >
          {SELECTABLE_VISUALS.map((visual) => (
            <option key={visual} value={visual}>
              {t(`editor.chart.visual.${visual}` as TranslationKey)}
            </option>
          ))}
        </select>
      </div>

      {renderedChart ? (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
          <span>
            {t("editor.chart.current", {
              visual: t(`editor.chart.visual.${renderedChart.visualKind}` as TranslationKey)
            })}
          </span>
          {renderedChart.fallback ? (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700">
              {t("editor.chart.fallback")}
            </span>
          ) : null}
        </p>
      ) : null}

      {notes.length > 0 ? (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5">
          <p className="text-xs font-semibold text-amber-700">{t("editor.chart.notes")}</p>
          <ul className="mt-0.5 list-inside list-disc space-y-0.5">
            {notes.map((note, index) => (
              <li key={index} className="text-xs text-amber-700/90">
                {note.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {disclosure && disclosure.userPointCount > 0 ? (
        <p className="mt-2 rounded bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700">
          {t("editor.chart.disclosure", {
            n: disclosure.userPointCount,
            m: disclosure.totalPointCount
          })}
        </p>
      ) : null}

      {sharedPages.length > 0 ? (
        <p className="mt-2 text-xs text-brand-700">
          {t("editor.chart.sharedHint", { pages: sharedPages.join("、") })}
        </p>
      ) : null}

      {children}
    </div>
  );
}

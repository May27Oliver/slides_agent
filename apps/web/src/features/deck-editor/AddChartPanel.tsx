import type { ChartIntent } from "@slides-agent/domain";
import { useI18n } from "@/i18n";

/** How many source-fact values to preview per intent before truncating. */
const FACT_PREVIEW_LIMIT = 3;

interface AddChartPanelProps {
  /** ALL of the deck's chart intents (placed ones included, clarify 決議). */
  intents: ChartIntent[];
  /** 1-based pages where each intent is already placed (effective, ops replayed). */
  usedPagesByIntent: Record<string, number[]>;
  onAddExisting: (chartIntentId: string) => void;
}

/**
 * 014 (US2, FR-005/FR-016): the add-chart entry for a chartless content slide.
 * Lists every persisted chart intent — already-placed ones carry a 「已用於第 N 頁」
 * badge but stay selectable (shared placement is legal and edits連動 all pages).
 */
export function AddChartPanel({ intents, usedPagesByIntent, onAddExisting }: AddChartPanelProps) {
  const { t } = useI18n();

  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {t("editor.chart.add.heading")} — {t("editor.chart.add.fromSource")}
      </p>

      {intents.length === 0 ? (
        <p className="mt-2 text-xs text-ink-soft">{t("editor.chart.add.empty")}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {intents.map((intent) => {
            const usedPages = usedPagesByIntent[intent.id] ?? [];
            const preview = intent.sourceFacts
              .slice(0, FACT_PREVIEW_LIMIT)
              .map((fact) => fact.value)
              .join("、");
            return (
              <li key={intent.id} className="rounded-lg border border-line bg-panel px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{intent.title}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">{intent.rationale}</p>
                    {preview ? (
                      <p className="mt-0.5 truncate text-xs text-ink-soft/80">
                        {preview}
                        {intent.sourceFacts.length > FACT_PREVIEW_LIMIT ? "…" : ""}
                      </p>
                    ) : null}
                    {usedPages.length > 0 ? (
                      <p className="mt-1 text-xs text-brand-700">
                        {t("editor.chart.add.usedOn", { pages: usedPages.join("、") })}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => onAddExisting(intent.id)}
                    className="shrink-0 rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
                  >
                    {t("editor.chart.add.place")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import { PanelCard } from "@/features/slide-generation/PanelCard";
import { CHART_VISUAL_KIND_LABEL_KEY } from "@/features/slide-generation/chart-visual-kind";
import type { GeneratedPreviewArtifact } from "@/features/slide-generation/slide-generation.types";
import { useI18n } from "@/i18n";

type RenderedCharts = NonNullable<
  GeneratedPreviewArtifact["previewArtifact"]["generationSummary"]["renderedCharts"]
>;

interface UserDataDisclosureItem {
  slideId: string;
  chartIntentId: string;
  userPointCount: number;
  totalPointCount: number;
}

interface RenderedChartsPanelProps {
  renderedCharts?: RenderedCharts | undefined;
  /** 014 (FR-009/FR-010): per-placement user-data disclosures from the summary. */
  userDataDisclosures?: UserDataDisclosureItem[] | undefined;
}

export function RenderedChartsPanel({
  renderedCharts,
  userDataDisclosures
}: RenderedChartsPanelProps) {
  const { t } = useI18n();
  const charts = renderedCharts ?? [];
  const disclosureFor = (slideId: string, chartIntentId: string) =>
    (userDataDisclosures ?? []).find(
      (entry) => entry.slideId === slideId && entry.chartIntentId === chartIntentId
    );

  return (
    <PanelCard title={t("renderedCharts.heading")}>
      {charts.length === 0 ? (
        <p className="text-sm text-ink-soft">{t("renderedCharts.empty")}</p>
      ) : (
        <ul>
          {charts.map((chart) => (
            <li
              key={`${chart.slideId}-${chart.chartIntentId}`}
              className="flex items-start justify-between gap-3 border-b border-line/70 py-1.5 last:border-0"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">
                  {t(CHART_VISUAL_KIND_LABEL_KEY[chart.visualKind])}
                </span>
                <span className="block text-[11px] text-ink-soft">
                  {t("renderedCharts.slide")}: {chart.slideId}
                </span>
                {/* Honest fallback disclosure: only when the renderer truly degraded. */}
                {chart.fallback && chart.notes.length > 0 ? (
                  <span className="mt-0.5 block text-[11px] text-accent-600">
                    {chart.notes.map((note) => note.message).join(" ")}
                  </span>
                ) : null}
                {/* 014: user-data disclosure rides with the chart's row. */}
                {(() => {
                  const disclosure = disclosureFor(chart.slideId, chart.chartIntentId);
                  return disclosure ? (
                    <span className="mt-0.5 block text-[11px] font-medium text-brand-700">
                      {t("editor.chart.disclosure", {
                        n: disclosure.userPointCount,
                        m: disclosure.totalPointCount
                      })}
                    </span>
                  ) : null;
                })()}
              </span>
              {chart.fallback ? (
                <span className="shrink-0 rounded-full border border-accent-400 bg-accent-500/10 px-2 py-0.5 text-[11px] font-bold text-accent-600">
                  {t("renderedCharts.fallback")}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}

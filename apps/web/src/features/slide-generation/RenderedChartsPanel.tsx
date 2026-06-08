import { PanelCard } from "@/features/slide-generation/PanelCard";
import type { GeneratedPreviewArtifact } from "@/features/slide-generation/slide-generation.types";
import { useI18n, type TranslationKey } from "@/i18n";

type RenderedCharts = NonNullable<
  GeneratedPreviewArtifact["previewArtifact"]["generationSummary"]["renderedCharts"]
>;
type VisualKind = RenderedCharts[number]["visualKind"];

const VISUAL_KIND_LABEL_KEY: Record<VisualKind, TranslationKey> = {
  pie_donut: "chart.kind.pie_donut",
  line: "chart.kind.line",
  bar: "chart.kind.bar",
  metric_card: "chart.kind.metric_card",
  metric_group: "chart.kind.metric_group",
  table: "chart.kind.table",
  fallback_text: "chart.kind.fallback_text"
};

interface RenderedChartsPanelProps {
  renderedCharts?: RenderedCharts | undefined;
}

export function RenderedChartsPanel({ renderedCharts }: RenderedChartsPanelProps) {
  const { t } = useI18n();
  const charts = renderedCharts ?? [];

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
                  {t(VISUAL_KIND_LABEL_KEY[chart.visualKind])}
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

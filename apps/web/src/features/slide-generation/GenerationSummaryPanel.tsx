import { PanelCard } from "@/features/slide-generation/PanelCard";
import type { GeneratedPreviewArtifact } from "@/features/slide-generation/slide-generation.types";
import { useI18n } from "@/i18n";

interface GenerationSummaryPanelProps {
  summary: GeneratedPreviewArtifact["previewArtifact"]["generationSummary"];
}

export function GenerationSummaryPanel({ summary }: GenerationSummaryPanelProps) {
  const { t } = useI18n();
  const stats = [
    { label: t("summary.slides"), value: summary.slideCount },
    { label: t("summary.sourceFacts"), value: summary.sourceFactCount },
    { label: t("summary.chartIntents"), value: summary.chartIntentCount },
    { label: t("summary.uncertainClaims"), value: summary.uncertainClaimCount }
  ];

  return (
    <PanelCard title={t("summary.heading")}>
      <dl className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-line bg-surface px-3 py-2.5">
            <dt className="text-xs font-medium text-ink-soft">{stat.label}</dt>
            <dd className="mt-0.5 text-2xl font-extrabold tabular-nums text-brand-700">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
    </PanelCard>
  );
}

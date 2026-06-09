import { DownloadIcon, PresentationIcon } from "@/components/icons";
import { DesignPlanningPanel } from "@/features/slide-generation/DesignPlanningPanel";
import { GenerationSummaryPanel } from "@/features/slide-generation/GenerationSummaryPanel";
import { HtmlGenerationValidationPanel } from "@/features/slide-generation/HtmlGenerationValidationPanel";
import { RenderedChartsPanel } from "@/features/slide-generation/RenderedChartsPanel";
import { ReviewReportPanel } from "@/features/slide-generation/ReviewReportPanel";
import { SlideJsonPanel } from "@/features/slide-generation/SlideJsonPanel";
import { SlidePreviewPanel } from "@/features/slide-generation/SlidePreviewPanel";
import type { HtmlDownload } from "@/features/slide-generation/download-html";
import type { GeneratedPreviewArtifact } from "@/features/slide-generation/slide-generation.types";
import { useI18n } from "@/i18n";

interface ResultsPanelProps {
  preview?: GeneratedPreviewArtifact | undefined;
  htmlDownload?: HtmlDownload | undefined;
}

export function ResultsPanel({ preview, htmlDownload }: ResultsPanelProps) {
  const { t } = useI18n();

  if (!preview) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col gap-5 p-6 lg:p-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-extrabold text-ink">{t("results.title")}</h2>
        {htmlDownload ? (
          <a
            download={htmlDownload.filename}
            href={htmlDownload.href}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2"
          >
            <DownloadIcon className="h-4 w-4" />
            {t("results.download")}
          </a>
        ) : null}
      </div>

      <SlidePreviewPanel preview={preview} />

      <div className="grid gap-5 xl:grid-cols-2">
        <DesignPlanningPanel
          designPlanningResult={preview.designPlanningResult}
          selectedTheme={preview.previewArtifact.generationSummary.selectedTheme}
          themeSelectionWarnings={preview.previewArtifact.generationSummary.themeSelectionWarnings}
        />
        <RenderedChartsPanel
          renderedCharts={preview.previewArtifact.generationSummary.renderedCharts}
        />
        <HtmlGenerationValidationPanel
          validation={preview.previewArtifact.htmlGenerationValidation}
        />
        <GenerationSummaryPanel summary={preview.previewArtifact.generationSummary} />
        <ReviewReportPanel reviewReport={preview.slideDeck.reviewReport} />
      </div>

      <SlideJsonPanel slideDeck={preview.slideDeck} />
    </div>
  );
}

function EmptyState() {
  const { t } = useI18n();
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center px-8 py-16 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-100 text-brand-600">
        <PresentationIcon className="h-8 w-8" />
      </span>
      <h2 className="mt-5 text-lg font-extrabold text-ink">{t("results.empty.title")}</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
        {t("results.empty.body")}
      </p>
    </div>
  );
}

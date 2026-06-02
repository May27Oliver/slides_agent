import { useMemo, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PresentationIcon } from "@/components/icons";
import { ResultsPanel } from "@/features/slide-generation/ResultsPanel";
import { SlideGenerationForm } from "@/features/slide-generation/SlideGenerationForm";
import { buildHtmlDownload } from "@/features/slide-generation/download-html";
import type {
  GeneratedPreviewArtifact,
  SlideGenerationRequest
} from "@/features/slide-generation/slide-generation.types";
import { useI18n } from "@/i18n";

interface SlideGenerationFeatureProps {
  initialPreview?: GeneratedPreviewArtifact;
}

export function SlideGenerationFeature({ initialPreview }: SlideGenerationFeatureProps = {}) {
  const { t } = useI18n();
  const [preview, setPreview] = useState<GeneratedPreviewArtifact | undefined>(initialPreview);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const htmlDownload = useMemo(
    () => (preview ? buildHtmlDownload(preview.previewArtifact.html) : undefined),
    [preview]
  );

  async function handleSubmit(request: SlideGenerationRequest) {
    setIsSubmitting(true);
    setErrorMessage(undefined);

    try {
      const response = await fetch("/api/slides/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error("Preview generation failed");
      }

      setPreview((await response.json()) as GeneratedPreviewArtifact);
    } catch {
      setErrorMessage(t("error.generic"));
    } finally {
      setIsSubmitting(false);
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
          />
        </section>

        <section
          aria-label={t("results.title")}
          className="scroll-area bg-surface lg:h-full lg:min-h-0 lg:overflow-y-auto"
        >
          <ResultsPanel preview={preview} htmlDownload={htmlDownload} />
        </section>
      </main>
    </div>
  );
}

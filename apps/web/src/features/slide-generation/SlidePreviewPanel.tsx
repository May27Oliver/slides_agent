import type { GeneratedPreviewArtifact } from "@/features/slide-generation/slide-generation.types";
import { useI18n } from "@/i18n";

interface SlidePreviewPanelProps {
  preview: GeneratedPreviewArtifact;
}

export function SlidePreviewPanel({ preview }: SlidePreviewPanelProps) {
  const { t } = useI18n();
  const firstSlide = preview.slideDeck.slides?.[0];

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-brand-700">
          {t("preview.heading")}
        </h3>
        <span className="text-xs text-ink-soft">{t("preview.hint")}</span>
      </div>
      <iframe
        className="h-[clamp(420px,52vh,720px)] w-full bg-[#0b1512]"
        srcDoc={preview.previewArtifact.html}
        title={t("preview.iframeTitle")}
        // LLM/template HTML is untrusted: allow-scripts keeps keyboard nav working
        // but, without allow-same-origin, the frame gets an opaque origin with no
        // access to the parent window, storage, cookies, or same-origin API calls.
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
      />
      {firstSlide ? (
        <article className="border-t border-line px-5 py-4">
          <h4 className="text-base font-bold text-ink">{firstSlide.title}</h4>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{firstSlide.message}</p>
        </article>
      ) : null}
    </section>
  );
}

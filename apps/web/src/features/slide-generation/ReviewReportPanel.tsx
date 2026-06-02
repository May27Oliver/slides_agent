import { PanelCard } from "@/features/slide-generation/PanelCard";
import type { GeneratedPreviewArtifact } from "@/features/slide-generation/slide-generation.types";
import { useI18n } from "@/i18n";

interface ReviewReportPanelProps {
  reviewReport: GeneratedPreviewArtifact["slideDeck"]["reviewReport"];
}

export function ReviewReportPanel({ reviewReport }: ReviewReportPanelProps) {
  const { t } = useI18n();

  return (
    <PanelCard title={t("review.heading")}>
      <div className="space-y-3">
        <ReportList label={t("review.assumptions")} items={reviewReport?.assumptions ?? []} />
        <ReportList
          label={t("review.omitted")}
          items={reviewReport?.omittedOrCompressedContent ?? []}
        />
        <ReportList label={t("review.uncertain")} items={reviewReport?.uncertainClaims ?? []} />
        <ReportList label={t("review.humanNotes")} items={reviewReport?.humanReviewNotes ?? []} />
      </div>
    </PanelCard>
  );
}

function ReportList({ label, items }: { label: string; items: string[] }) {
  const { t } = useI18n();
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wide text-ink-soft">{label}</h4>
      {items.length > 0 ? (
        <ul className="mt-1.5 space-y-1">
          {items.map((item, index) => (
            <li
              key={`${label}-${index}`}
              className="flex gap-2 text-sm text-ink before:mt-2 before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-400"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-ink-soft/70">{t("review.none")}</p>
      )}
    </div>
  );
}

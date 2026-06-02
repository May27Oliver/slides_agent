import { DefinitionRow, IssueList, PanelCard } from "@/features/slide-generation/PanelCard";
import type { GeneratedPreviewArtifact } from "@/features/slide-generation/slide-generation.types";
import { useI18n } from "@/i18n";

interface HtmlGenerationValidationPanelProps {
  validation: GeneratedPreviewArtifact["previewArtifact"]["htmlGenerationValidation"];
}

export function HtmlGenerationValidationPanel({ validation }: HtmlGenerationValidationPanelProps) {
  const { t } = useI18n();
  const yesNo = (value: boolean | undefined) => (value ? t("common.yes") : t("common.no"));

  return (
    <PanelCard title={t("validation.heading")}>
      <dl>
        <DefinitionRow term={t("validation.status")}>
          <StatusBadge status={validation.status} />
        </DefinitionRow>
        <DefinitionRow term={t("validation.selfContained")}>
          {yesNo(validation.selfContained)}
        </DefinitionRow>
        <DefinitionRow term={t("validation.speakerNotes")}>
          {yesNo(validation.speakerNotesHidden)}
        </DefinitionRow>
        <DefinitionRow term={t("validation.keyboardNav")}>
          {yesNo(validation.keyboardNavigationPresent)}
        </DefinitionRow>
        <DefinitionRow term={t("validation.fallback")}>
          {yesNo(validation.fallbackUsed)}
        </DefinitionRow>
      </dl>
      <IssueList
        label={t("validation.externalIssues")}
        items={validation.externalResourceIssues ?? []}
      />
      <IssueList label={t("validation.contentIssues")} items={validation.contentIssues ?? []} />
      <IssueList label={t("validation.designIssues")} items={validation.designIssues ?? []} />
    </PanelCard>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isPass = status === "pass";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
        isPass ? "bg-brand-100 text-brand-700" : "bg-orange-100 text-accent-600"
      }`}
    >
      {status}
    </span>
  );
}

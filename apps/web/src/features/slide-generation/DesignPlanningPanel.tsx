import { DefinitionRow, IssueList, PanelCard } from "@/features/slide-generation/PanelCard";
import type { GeneratedPreviewArtifact } from "@/features/slide-generation/slide-generation.types";
import { useI18n } from "@/i18n";

interface DesignPlanningPanelProps {
  designPlanningResult: GeneratedPreviewArtifact["designPlanningResult"];
}

export function DesignPlanningPanel({ designPlanningResult }: DesignPlanningPanelProps) {
  const { t } = useI18n();
  const designSystem = designPlanningResult.designSystem;
  const firstPattern = designPlanningResult.slidePatternAssignments?.[0];

  return (
    <PanelCard title={t("design.heading")}>
      <dl>
        <DefinitionRow term={t("design.theme")}>{designSystem?.themeName ?? "—"}</DefinitionRow>
        <DefinitionRow term={t("design.density")}>{designSystem?.visualDensity ?? "—"}</DefinitionRow>
        <DefinitionRow term={t("design.chartStyle")}>{designSystem?.chartStyle ?? "—"}</DefinitionRow>
        <DefinitionRow term={t("design.pattern")}>{firstPattern?.primaryPattern ?? "—"}</DefinitionRow>
      </dl>
      <IssueList
        label={t("design.issues")}
        items={designPlanningResult.consistencyValidation?.issues ?? []}
      />
    </PanelCard>
  );
}

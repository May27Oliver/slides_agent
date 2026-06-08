import { DefinitionRow, IssueList, PanelCard } from "@/features/slide-generation/PanelCard";
import type { GeneratedPreviewArtifact } from "@/features/slide-generation/slide-generation.types";
import { useI18n, type TranslationKey } from "@/i18n";

type SelectedTheme = NonNullable<
  GeneratedPreviewArtifact["previewArtifact"]["generationSummary"]["selectedTheme"]
>;

interface DesignPlanningPanelProps {
  designPlanningResult: GeneratedPreviewArtifact["designPlanningResult"];
  // 009/FR-005: the applied-theme tokens come from the response result evidence
  // (generationSummary.selectedTheme) — never fabricated from the planning request.
  selectedTheme?: SelectedTheme | undefined;
}

export function DesignPlanningPanel({
  designPlanningResult,
  selectedTheme
}: DesignPlanningPanelProps) {
  const { t } = useI18n();
  const firstPattern = designPlanningResult.slidePatternAssignments?.[0];

  const themeName = selectedTheme?.kitName ?? "—";
  const density = selectedTheme?.visualDensity ?? "—";

  return (
    <PanelCard title={t("design.heading")}>
      <dl>
        <DefinitionRow term={t("design.theme")}>{themeName}</DefinitionRow>
        <DefinitionRow term={t("design.density")}>{density}</DefinitionRow>
        {selectedTheme ? (
          <>
            <DefinitionRow term={t("design.fonts")}>
              {`${selectedTheme.fonts.heading} / ${selectedTheme.fonts.body}`}
            </DefinitionRow>
            <DefinitionRow term={t("design.radius")}>
              {`${selectedTheme.structureFeatures.radiusPx}px`}
            </DefinitionRow>
          </>
        ) : null}
        <DefinitionRow term={t("design.pattern")}>
          {firstPattern?.primaryPattern ?? "—"}
        </DefinitionRow>
      </dl>

      {selectedTheme ? (
        <>
          <span
            aria-label={`${selectedTheme.kitName} ${t("design.palette")}`}
            className="mt-3 flex h-7 overflow-hidden border border-line"
          >
            {selectedTheme.accentHues.map((hue) => (
              <span
                key={hue.base}
                title={`${hue.name} ${hue.base}`}
                className="h-full flex-1"
                style={{ backgroundColor: hue.base }}
              />
            ))}
          </span>

          <EffectChips features={selectedTheme.structureFeatures} />

          {selectedTheme.fallback ? (
            <div className="mt-2">
              <p className="text-[11px] font-semibold text-accent-600">
                {t("design.fallbackNote")}
              </p>
              <FallbackAxes ids={selectedTheme.ids} />
            </div>
          ) : null}
        </>
      ) : null}

      <IssueList
        label={t("design.issues")}
        items={designPlanningResult.consistencyValidation?.issues ?? []}
      />
    </PanelCard>
  );
}

/** The three theme axes, in display order, with their i18n label keys. */
const THEME_AXES: ReadonlyArray<{ key: keyof SelectedTheme["ids"]; labelKey: TranslationKey }> = [
  { key: "style", labelKey: "design.axis.style" },
  { key: "palette", labelKey: "design.axis.palette" },
  { key: "font", labelKey: "design.axis.font" }
];

/**
 * 009/US2 scenario 4: honest per-axis fallback disclosure. Reads the result
 * evidence `selectedTheme.ids` — a `null` id means that axis had no candidate and
 * fell back to the default kit. Hit axes are shown neutral; fell-back axes carry
 * the accent "退回" marker, so the panel never hides which axis was defaulted.
 */
function FallbackAxes({ ids }: { ids: SelectedTheme["ids"] }) {
  const { t } = useI18n();
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {THEME_AXES.map((axis) => {
        const fellBack = ids[axis.key] === null;
        return (
          <span
            key={axis.key}
            className={
              fellBack
                ? "rounded-full border border-accent-400 bg-accent-500/10 px-2 py-0.5 text-[11px] font-bold text-accent-600"
                : "rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-bold text-ink-soft"
            }
          >
            {t(axis.labelKey)}
            {fellBack ? ` · ${t("design.axis.fellBack")}` : null}
          </span>
        );
      })}
    </div>
  );
}

/** Chips for the structure effects the kit actually applies (no fabrication). */
function EffectChips({ features }: { features: SelectedTheme["structureFeatures"] }) {
  const { t } = useI18n();
  const chips: Array<{ key: string; label: string }> = [];
  if (features.shadow) chips.push({ key: "shadow", label: t("design.feature.shadow") });
  if (features.backdropBlurPx !== undefined)
    chips.push({ key: "blur", label: t("design.feature.blur") });
  if (features.glow) chips.push({ key: "glow", label: t("design.feature.glow") });
  if (features.texture) chips.push({ key: "texture", label: t("design.feature.texture") });
  if (features.animation) chips.push({ key: "animation", label: t("design.feature.animation") });
  if (chips.length === 0) {
    return null;
  }
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-bold text-ink-soft"
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}

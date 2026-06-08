import { useId } from "react";
import type { ChartPreset, ChartPresetKey } from "@/features/slide-generation/chart-presets";
import { CHART_VISUAL_KIND_LABEL_KEY } from "@/features/slide-generation/chart-visual-kind";
import { useI18n } from "@/i18n";

interface ChartPresetPreviewProps {
  presets: readonly ChartPreset[];
  selectedKey: ChartPresetKey;
  onSelect: (key: ChartPresetKey) => void;
}

export function ChartPresetPreview({ presets, selectedKey, onSelect }: ChartPresetPreviewProps) {
  const { t } = useI18n();
  // Unique radio-group name per instance so two previews never merge selection.
  const groupName = useId();

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {presets.map((preset) => {
        const active = selectedKey === preset.key;

        return (
          <label
            key={preset.key}
            className={`group relative flex cursor-pointer flex-col gap-2 rounded-xl border p-3.5 text-left transition duration-150 focus-within:ring-2 focus-within:ring-brand-400 focus-within:ring-offset-2 ${
              active
                ? "border-brand-500 bg-brand-50 text-brand-900 shadow-sm ring-1 ring-inset ring-brand-500/30"
                : "border-line bg-white text-ink hover:border-brand-300 hover:bg-brand-50/40 hover:shadow-sm"
            }`}
          >
            <input
              type="radio"
              name={groupName}
              checked={active}
              onChange={() => onSelect(preset.key)}
              className="sr-only"
            />

            <span className="flex items-start justify-between gap-2">
              <span className="text-sm font-extrabold text-ink">{t(preset.key)}</span>
              {preset.exampleVisualKinds.length > 0 ? (
                <span className="flex flex-wrap justify-end gap-1">
                  {preset.exampleVisualKinds.map((kind) => (
                    <span
                      key={kind}
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                        active
                          ? "border-brand-200 bg-white text-brand-800"
                          : "border-line bg-surface text-ink-soft"
                      }`}
                    >
                      {t(CHART_VISUAL_KIND_LABEL_KEY[kind])}
                    </span>
                  ))}
                </span>
              ) : null}
            </span>

            <span className="text-[11px] leading-relaxed text-ink-soft">
              {t(preset.descriptionKey)}
            </span>
          </label>
        );
      })}
    </div>
  );
}

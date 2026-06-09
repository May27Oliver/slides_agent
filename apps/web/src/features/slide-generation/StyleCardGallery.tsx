import { useId } from "react";
import type { StylePresetKey, StylePresetPreview } from "@/features/slide-generation/style-presets";
import { useI18n } from "@/i18n";

interface StyleCardGalleryProps {
  presets: readonly StylePresetPreview[];
  selectedKey: StylePresetKey | "";
  onSelect: (key: StylePresetKey) => void;
}

export function StyleCardGallery({ presets, selectedKey, onSelect }: StyleCardGalleryProps) {
  const { t } = useI18n();
  // Unique radio-group name per instance so two galleries on one page never merge.
  const groupName = useId();

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {presets.map((preset) => {
        const active = selectedKey === preset.key;
        const paletteLabel = `${t(preset.key)} ${t("form.design.stylePresetPalette")}`;

        return (
          <label
            key={preset.key}
            className={`group relative flex cursor-pointer flex-col gap-3 rounded-xl border p-4 text-left transition duration-150 focus-within:ring-2 focus-within:ring-brand-400 focus-within:ring-offset-2 ${
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

            <span className="min-w-0">
              <span className="block text-sm font-extrabold text-ink">{t(preset.key)}</span>
              <span className="mt-1 block text-[11px] font-semibold text-ink-soft">
                {t("form.design.stylePresetDensity")}: {t(preset.densityLabelKey)}
              </span>
            </span>

            <span aria-label={paletteLabel} className="flex h-7 overflow-hidden border border-line">
              {preset.palette.map((color) => (
                <span
                  key={color}
                  title={color}
                  className="h-full flex-1"
                  style={{ backgroundColor: color }}
                />
              ))}
            </span>

            <span className="flex flex-wrap gap-1.5">
              {preset.featureKeys.map((featureKey) => (
                <span
                  key={featureKey}
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                    active
                      ? "border-brand-200 bg-white text-brand-800"
                      : "border-line bg-surface text-ink-soft"
                  }`}
                >
                  {t(featureKey)}
                </span>
              ))}
            </span>
          </label>
        );
      })}
    </div>
  );
}

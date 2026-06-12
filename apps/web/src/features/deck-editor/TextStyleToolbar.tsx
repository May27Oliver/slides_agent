import type { TextColorToken, TextSizeLevel, TextStyleOverride } from "@slides-agent/domain";
import type { TextStylePatch } from "@/features/deck-editor/editable-slide-draft";
import { useI18n } from "@/i18n";

interface TextStyleToolbarProps {
  /** Field name for the group's aria-label (e.g. the title field's label). */
  label: string;
  value: TextStyleOverride | undefined;
  /**
   * Single-property merge patch: `{ sizeLevel: "L" }` sets, `{ sizeLevel: undefined }`
   * clears that axis (the draft's merge semantics, FR-011 single-property reset).
   */
  onPatch: (patch: TextStylePatch) => void;
  /** Full reset: the whole field entry disappears (FR-011). */
  onReset: () => void;
}

const SIZE_LEVELS: TextSizeLevel[] = ["S", "M", "L", "XL"];

// Editor-side representative swatches for the four theme ROLE tokens (FR-008). The
// real color resolves inside the deck via CSS variables; these only identify the role.
const COLOR_TOKENS: Array<{ token: TextColorToken; swatchClass: string }> = [
  { token: "text", swatchClass: "bg-ink" },
  { token: "accent", swatchClass: "bg-brand-700" },
  { token: "muted", swatchClass: "bg-ink-soft" },
  { token: "heading", swatchClass: "bg-black" }
];

/**
 * 015 US3: compact per-field style controls — S/M/L/XL steps + four theme color
 * tokens (no free hex). Re-picking the active value toggles that axis off.
 */
export function TextStyleToolbar({ label, value, onPatch, onReset }: TextStyleToolbarProps) {
  const { t } = useI18n();
  const hasOverride = Boolean(value?.sizeLevel || value?.colorToken);

  return (
    <div
      role="group"
      aria-label={`${t("editor.textStyle.heading")} ${label}`}
      className="flex items-center gap-1"
    >
      {SIZE_LEVELS.map((size) => {
        const active = value?.sizeLevel === size;
        return (
          <button
            key={size}
            type="button"
            aria-pressed={active}
            aria-label={`${t("editor.textStyle.size")} ${size}`}
            onClick={() => onPatch({ sizeLevel: active ? undefined : size })}
            className={[
              "cursor-pointer rounded px-1.5 py-0.5 text-[11px] font-semibold transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700",
              active
                ? "bg-brand-700 text-white"
                : "border border-line text-ink-soft hover:bg-surface hover:text-ink"
            ].join(" ")}
          >
            {size}
          </button>
        );
      })}
      <span aria-hidden className="mx-0.5 h-4 w-px bg-line" />
      {COLOR_TOKENS.map(({ token, swatchClass }) => {
        const active = value?.colorToken === token;
        return (
          <button
            key={token}
            type="button"
            aria-pressed={active}
            aria-label={`${t("editor.textStyle.color")} ${t(`editor.textStyle.color.${token}`)}`}
            title={t(`editor.textStyle.color.${token}`)}
            onClick={() => onPatch({ colorToken: active ? undefined : token })}
            className={[
              "flex h-5 w-5 cursor-pointer items-center justify-center rounded-full transition-shadow",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700",
              active ? "ring-2 ring-brand-700 ring-offset-1" : "hover:ring-2 hover:ring-line"
            ].join(" ")}
          >
            <span aria-hidden className={`h-3.5 w-3.5 rounded-full ${swatchClass}`} />
          </button>
        );
      })}
      {hasOverride ? (
        <button
          type="button"
          onClick={onReset}
          className="ml-1 cursor-pointer rounded px-1.5 py-0.5 text-[11px] text-ink-soft underline-offset-2 hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
        >
          {t("editor.textStyle.reset")}
        </button>
      ) : null}
    </div>
  );
}

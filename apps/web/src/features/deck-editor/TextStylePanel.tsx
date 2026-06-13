import { useEffect } from "react";
import { HexColorInput, HexColorPicker } from "react-colorful";
import { TEXT_SIZE_PX_MAX, TEXT_SIZE_PX_MIN, type TextStyleOverride } from "@slides-agent/domain";
import type { TextStylePatch } from "@/features/deck-editor/editable-slide-draft";
import { useI18n } from "@/i18n";

interface TextStylePanelProps {
  /** Label of the field being edited (title / message / bullet N); null = closed. */
  target: { label: string; value: TextStyleOverride | undefined } | null;
  /** 015: selectable font families (from the builtin font catalogue). */
  fonts: readonly string[];
  /** Google Fonts stylesheet that loads every catalogue family, so options render in face. */
  fontPreviewHref: string | null;
  onPatch: (patch: TextStylePatch) => void;
  onReset: () => void;
  onClose: () => void;
}

const FONT_PREVIEW_LINK_ID = "text-style-font-preview";

// Sensible starting size for the slider when the field has no override yet (the live
// preview is the source of truth; the user drags from here to take effect).
const DEFAULT_SLIDER_PX = 48;
const DEFAULT_PICK_COLOR = "#7170FF";

/**
 * 015 US3: the right slide-out style editor — a free hex color picker (saturation +
 * hue, like the reference) and an absolute px size slider, for one text field. Stays
 * docked at the right with the live preview still visible, so edits show immediately.
 */
export function TextStylePanel({
  target,
  fonts,
  fontPreviewHref,
  onPatch,
  onReset,
  onClose
}: TextStylePanelProps) {
  const { t } = useI18n();
  const open = target !== null;
  const value = target?.value;
  const hasStyle = Boolean(value?.sizePx || value?.color || value?.fontFamily);

  // Load every catalogue family once (idempotent <link> in <head>) so the dropdown
  // options can render in their own face. The browser lazy-downloads only painted ones.
  useEffect(() => {
    if (!open || !fontPreviewHref || typeof document === "undefined") {
      return;
    }
    if (document.getElementById(FONT_PREVIEW_LINK_ID)) {
      return;
    }
    const link = document.createElement("link");
    link.id = FONT_PREVIEW_LINK_ID;
    link.rel = "stylesheet";
    link.href = fontPreviewHref;
    document.head.appendChild(link);
  }, [open, fontPreviewHref]);

  return (
    <aside
      aria-hidden={!open}
      aria-label={t("editor.textStyle.heading")}
      className={[
        "absolute inset-y-0 right-0 z-40 flex w-[360px] max-w-[90vw] flex-col border-l border-line bg-panel shadow-2xl transition-transform duration-200",
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      ].join(" ")}
    >
      {target ? (
        <>
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                {t("editor.textStyle.heading")}
              </p>
              <p className="truncate text-sm font-semibold text-ink">{target.label}</p>
            </div>
            <button
              type="button"
              aria-label={t("editor.textStyle.close")}
              onClick={onClose}
              className="cursor-pointer rounded-lg border border-line px-2 py-1 text-sm text-ink-soft hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
            >
              ✕
            </button>
          </header>

          <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
            {/* FONT FAMILY */}
            <section className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                {t("editor.textStyle.font")}
              </span>
              <select
                aria-label={t("editor.textStyle.font")}
                value={value?.fontFamily ?? ""}
                onChange={(e) =>
                  onPatch({ fontFamily: e.target.value === "" ? undefined : e.target.value })
                }
                className="w-full cursor-pointer rounded-lg border border-line bg-panel px-2 py-1.5 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
                style={value?.fontFamily ? { fontFamily: `'${value.fontFamily}', sans-serif` } : {}}
              >
                <option value="">{t("editor.textStyle.fontDefault")}</option>
                {fonts.map((family) => (
                  <option
                    key={family}
                    value={family}
                    style={{ fontFamily: `'${family}', sans-serif` }}
                  >
                    {family}
                  </option>
                ))}
              </select>
            </section>

            {/* COLOR */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  {t("editor.textStyle.color")}
                </span>
                {value?.color ? (
                  <button
                    type="button"
                    onClick={() => onPatch({ color: undefined })}
                    className="cursor-pointer text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
                  >
                    {t("editor.textStyle.clear")}
                  </button>
                ) : null}
              </div>
              <HexColorPicker
                color={value?.color ?? DEFAULT_PICK_COLOR}
                onChange={(color) => onPatch({ color })}
                style={{ width: "100%" }}
              />
              <label className="flex items-center gap-2 text-sm">
                <span className="text-ink-soft">#</span>
                <HexColorInput
                  aria-label={t("editor.textStyle.color")}
                  color={value?.color ?? ""}
                  onChange={(color) => onPatch({ color })}
                  prefixed={false}
                  className="w-28 rounded-lg border border-line bg-panel px-2 py-1 font-mono text-sm uppercase text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
                />
              </label>
            </section>

            {/* SIZE */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  {t("editor.textStyle.size")}
                </span>
                {value?.sizePx ? (
                  <button
                    type="button"
                    onClick={() => onPatch({ sizePx: undefined })}
                    className="cursor-pointer text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
                  >
                    {t("editor.textStyle.clear")}
                  </button>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  aria-label={t("editor.textStyle.size")}
                  min={TEXT_SIZE_PX_MIN}
                  max={TEXT_SIZE_PX_MAX}
                  value={value?.sizePx ?? DEFAULT_SLIDER_PX}
                  onChange={(e) => onPatch({ sizePx: Number(e.target.value) })}
                  className="h-1 flex-1 cursor-pointer accent-brand-700"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    aria-label={`${t("editor.textStyle.size")} px`}
                    min={TEXT_SIZE_PX_MIN}
                    max={TEXT_SIZE_PX_MAX}
                    value={value?.sizePx ?? ""}
                    placeholder={t("editor.textStyle.auto")}
                    onChange={(e) =>
                      onPatch({
                        sizePx: e.target.value === "" ? undefined : Number(e.target.value)
                      })
                    }
                    className="w-16 rounded-lg border border-line bg-panel px-2 py-1 text-right text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
                  />
                  <span className="text-xs text-ink-soft">PX</span>
                </div>
              </div>
            </section>
          </div>

          <footer className="border-t border-line px-4 py-3">
            <button
              type="button"
              onClick={onReset}
              disabled={!hasStyle}
              className="w-full cursor-pointer rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface disabled:cursor-default disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
            >
              {t("editor.textStyle.reset")}
            </button>
          </footer>
        </>
      ) : null}
    </aside>
  );
}

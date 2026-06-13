import type { TextStyleOverride } from "@/deck/deck.types";

/** The three override-able text fields (kept for call-site clarity / future per-field rules). */
export type TextStyleField = "title" | "message" | "bullet";

/**
 * 015 (FR-007/FR-008): the SINGLE source of truth that turns a TextStyleOverride into
 * an inline style fragment. Used by the template renderer — which both the server save
 * path and the client live preview run — so style parity can never drift.
 *
 * Values are absolute (free color picker + px slider): `sizePx` → `font-size:<n>px`,
 * `color` → `color:<hex>`. Both are measured in the 1920×1080 presentation space the
 * preview and PPTX export share, so the px is WYSIWYG. Absent fields emit nothing
 * (the theme default applies).
 */
export function textStyleInlineStyle(
  override: TextStyleOverride | undefined,
  _field: TextStyleField
): string {
  if (!override) {
    return "";
  }
  const parts: string[] = [];
  if (typeof override.sizePx === "number" && Number.isFinite(override.sizePx)) {
    parts.push(`font-size:${override.sizePx}px`);
  }
  if (override.color) {
    parts.push(`color:${override.color}`);
  }
  return parts.join(";");
}

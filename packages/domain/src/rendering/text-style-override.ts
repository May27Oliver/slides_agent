import type { TextStyleOverride } from "@/deck/deck.types";

/** The three override-able text fields, each scaling its own theme type variable. */
export type TextStyleField = "title" | "message" | "bullet";

/**
 * 015 (FR-007/FR-008, research R3): the SINGLE source of truth that turns a
 * TextStyleOverride into an inline style fragment. Used by the template renderer —
 * which both the server save path and the client live preview run — so style parity
 * can never drift. Sizes scale the field's own `--type-*` variable; colors are theme
 * palette role variables, so a re-theme re-resolves both automatically.
 *
 * Size M emits nothing (it IS the theme default). An absent colorToken emits nothing;
 * `text` is a real override (e.g. message defaults to --muted, not --text).
 */
export function textStyleInlineStyle(
  override: TextStyleOverride | undefined,
  field: TextStyleField
): string {
  if (!override) {
    return "";
  }
  const parts: string[] = [];
  const factor = override.sizeLevel ? SIZE_FACTORS[override.sizeLevel] : undefined;
  if (factor !== undefined) {
    parts.push(`font-size:calc(var(--type-${field}) * ${factor})`);
  }
  if (override.colorToken) {
    parts.push(`color:var(--${override.colorToken})`);
  }
  return parts.join(";");
}

/** S/M/L/XL → multiplier over the theme base size; M is the default (no override). */
const SIZE_FACTORS: Record<string, number | undefined> = {
  S: 0.85,
  M: undefined,
  L: 1.25,
  XL: 1.6
};

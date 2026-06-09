/**
 * 011: the manual theme-override wire vocabulary + its validation, shared by BOTH
 * entry points (preview request + edit-revision request) so the type AND the
 * type-check rules live once (No-drift). These structurally mirror the domain
 * `ManualThemeSelection` / `ThemeSelectionWarning` at the decoupled contract↔domain
 * boundary (same house style as `SelectedThemeSummaryContract`).
 */

/** Per-axis manual override; all optional (absent ⇒ keyword baseline, no change). */
export interface ThemeSelectionContract {
  fontId?: string;
  paletteId?: string;
  styleId?: string;
}

/** Evidence an axis could not be applied and fell back to the default kit. */
export interface ThemeSelectionWarningContract {
  axis: "font" | "palette" | "style";
  requestedId?: string;
  reason: "invalid_id" | "base_unresolved";
}

// Theme ids are short slugs (e.g. "palette-10-violet"); cap to bound abuse. A
// well-formed id that is not in the catalogue is NOT rejected here — it is surfaced
// downstream as a `themeSelectionWarnings` fallback. This only rejects wrong types /
// absurd lengths (contract §2).
export const MAX_THEME_ID_CHARS = 200;

const AXES = ["fontId", "paletteId", "styleId"] as const;

export type ParseThemeSelectionResult =
  | { ok: true; value?: ThemeSelectionContract }
  | { ok: false; fields: string[] };

/**
 * Validates the optional manual theme override. `undefined` ⇒ ok with no value.
 * A non-object, or any axis that is a non-string / over-length value ⇒ a malformed
 * request carrying the offending field path(s). Empty-string axes are dropped.
 */
export function parseThemeSelection(value: unknown): ParseThemeSelectionResult {
  if (value === undefined) {
    return { ok: true };
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, fields: ["themeSelection"] };
  }

  const record = value as Record<string, unknown>;
  const selection: ThemeSelectionContract = {};
  const fields: string[] = [];
  for (const axis of AXES) {
    const raw = record[axis];
    if (raw === undefined) {
      continue;
    }
    if (typeof raw !== "string" || raw.length > MAX_THEME_ID_CHARS) {
      fields.push(`themeSelection.${axis}`);
      continue;
    }
    if (raw.length > 0) {
      selection[axis] = raw;
    }
  }

  if (fields.length > 0) {
    return { ok: false, fields };
  }
  return Object.keys(selection).length > 0 ? { ok: true, value: selection } : { ok: true };
}

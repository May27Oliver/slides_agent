/**
 * 011: manual per-axis theme selection. Canonical home for the shared vocabulary
 * — `applyThemeSelection` (domain), the API request parser, and the web picker all
 * import these from here, so the *logic* and *shapes* live once (No-drift). The
 * wire contract (`GeneratePreviewRequestContract.themeSelection`) restates the
 * `ManualThemeSelection` shape structurally at the deliberately-decoupled
 * contract↔domain boundary — the same boundary-mirror the repo already uses for
 * `SelectedThemeSummaryContract` ↔ `SelectedThemeSummary`. See
 * specs/011-theme-selection/data-model.md §1/§2/§8.
 */

import type { SelectableTheme, SelectedTheme, ThemeKind } from "@/design/theme.types";

/**
 * Per-axis override. Each axis is optional — only the axes the user actually
 * picked are set; the rest keep the keyword `selectTheme` baseline. An empty /
 * absent selection means "behave exactly as today" (CR-004 backward compatible).
 */
export interface ManualThemeSelection {
  readonly fontId?: string;
  readonly paletteId?: string;
  readonly styleId?: string;
}

/**
 * Honest read-only evidence that an axis could not be applied and fell back to the
 * default (NOT to baseline). `invalid_id`: a user override id is not in the current
 * selectable catalogue (disabled / deleted / typo — indistinguishable under the
 * active=true filter). `base_unresolved`: a baseline axis id is null or unresolvable
 * (e.g. editing a legacy deck). Carried in `GenerationSummary.themeSelectionWarnings`;
 * `[]` means every axis applied as requested. data-model §8.
 */
export interface ThemeSelectionWarning {
  readonly axis: ThemeKind;
  /** The user override id (omitted when the failing axis was a baseline axis). */
  readonly requestedId?: string;
  readonly reason: "invalid_id" | "base_unresolved";
}

/**
 * Result of `applyThemeSelection`: the composed theme plus per-axis warnings. The
 * caller persists `selectedTheme` (three axis ids) and surfaces `warnings` as
 * generation evidence — without this the caller cannot tell which axis fell back.
 */
export interface ApplyThemeResult {
  readonly selectedTheme: SelectedTheme;
  readonly warnings: ThemeSelectionWarning[];
}

/**
 * 011 browse read shape (data-model §5): a `SelectableTheme` enriched with the
 * human-facing `name`/`description` the picker needs. `styleKit` stays the SAME
 * trusted-builtin *partial* kit as `SelectableTheme.styleKit` (NO swatch-reduced
 * parallel projection) so the web client can `composeKit` + re-render for live
 * WYSIWYG (010 parity); the client extracts swatches from it. Returned by
 * `ThemeStore.listBrowsable()` and served verbatim by `GET /api/themes`.
 */
export interface BrowsableTheme extends SelectableTheme {
  readonly name: string;
  readonly description?: string;
}

/** Browse catalogue grouped by axis. The wire response of `GET /api/themes`. */
export interface ThemeCatalog {
  readonly font: BrowsableTheme[];
  readonly palette: BrowsableTheme[];
  readonly style: BrowsableTheme[];
}

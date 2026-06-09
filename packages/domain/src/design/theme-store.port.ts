/**
 * ThemeStore is the domain↔DB boundary for builtin themes (feature 007). The
 * adapter (DrizzleThemeStore) reads PostgreSQL; the domain stays SQL-free and the
 * pure `selectTheme` receives the candidate list rather than querying. See
 * specs/007-design-theme-system/contracts/theme-selection.md (DR-006).
 */

import type { BrowsableTheme } from "@/design/theme-selection.types";
import type { SelectableTheme } from "@/design/theme.types";

export interface ThemeStore {
  /**
   * Returns the selectable builtin themes across all three kinds.
   * Default filter: scope='builtin', active=true,
   * applies_to in (presentation, universal), and `style` kind excludes
   * support='raw'. Ordered by id (stable) so selectTheme's
   * "no-match / tie -> first candidate" is reproducible and the `00`-prefixed
   * safe default sorts first (DR-004).
   */
  listSelectable(): Promise<SelectableTheme[]>;

  /**
   * 011: same builtin catalogue as `listSelectable` (identical filter + order),
   * enriched with the human-facing `name`/`description` the browse UI needs. The
   * `styleKit` is the SAME trusted-builtin partial kit — no swatch-reduced parallel
   * projection — so the web client can `composeKit` + live-render. Served by
   * `GET /api/themes`. data-model §5.
   */
  listBrowsable(): Promise<BrowsableTheme[]>;
}

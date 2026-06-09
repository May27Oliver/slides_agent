/**
 * Derives the stable `kitName` ("style+palette+font" of the non-null axis ids, or
 * "default") for a composed kit. Extracted so `selectTheme` (keyword baseline) and
 * `applyThemeSelection` (011 manual override) produce IDENTICAL names from the same
 * ids — single source, no parity drift.
 */
export function composeKitName(ids: {
  readonly style: string | null;
  readonly palette: string | null;
  readonly font: string | null;
}): string {
  const parts = [ids.style, ids.palette, ids.font].filter((id): id is string => id !== null);
  return parts.length > 0 ? parts.join("+") : "default";
}

import type {
  BrowsableTheme,
  ManualThemeSelection,
  ThemeCatalog
} from "@slides-agent/domain";
import type { TranslationKey } from "@/i18n";

/** The three selection axes, with their catalog group + ManualThemeSelection key. */
export const THEME_AXES = [
  { kind: "font", group: "font", idKey: "fontId", labelKey: "theme.axis.font" },
  { kind: "palette", group: "palette", idKey: "paletteId", labelKey: "theme.axis.palette" },
  { kind: "style", group: "style", idKey: "styleId", labelKey: "theme.axis.style" }
] as const satisfies ReadonlyArray<{
  kind: BrowsableTheme["kind"];
  group: keyof ThemeCatalog;
  idKey: keyof ManualThemeSelection;
  labelKey: TranslationKey;
}>;

export type ThemeAxis = (typeof THEME_AXES)[number];

/** Resolve a selected axis id to its theme name, or null when unset/unresolvable. */
export function resolveThemeName(
  catalog: ThemeCatalog | null,
  axis: ThemeAxis,
  id: string | undefined
): string | null {
  if (!catalog || !id) {
    return null;
  }
  return catalog[axis.group].find((theme) => theme.id === id)?.name ?? null;
}

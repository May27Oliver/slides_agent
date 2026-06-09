import type { DesignStyleKit } from "@/design/design-style-kit.types";
import type { VisualDensity } from "@/design/design.types";
import type { SelectedTheme } from "@/design/theme.types";
import type {
  SelectedThemeStructureFeatures,
  SelectedThemeSummary
} from "@/design/selected-theme-summary.types";
import { FALLBACK_HUE, safeCssValue, safeHex } from "@/rendering/sanitize";

const FALLBACK_FONT = "system-ui, sans-serif";

/**
 * 009: public-safe projection of the theme `selectTheme` + `composeKit` produced
 * into the readonly `SelectedThemeSummary` result evidence surfaced in
 * `generationSummary.selectedTheme`. Pure and decision-free: it only reads the
 * composed kit + the design planner's visual density, never re-decides anything,
 * and never fabricates absent fields. It does NOT pass values through verbatim:
 * colour/font tokens are sanitized (`safeHex`/`safeCssValue`) to safe fallbacks so
 * the JSON evidence is safe to drop straight into a style attribute downstream.
 */
export function projectSelectedThemeSummary(
  selected: SelectedTheme,
  visualDensity?: VisualDensity
): SelectedThemeSummary {
  const kit = selected.styleKit;
  return {
    kitName: kit.kitName,
    ids: { ...selected.ids },
    fallback: selected.fallback,
    // Sanitize at the projection boundary so the JSON evidence is safe for a
    // future panel to drop straight into a style attribute (009 FR-014 / security):
    // a tampered DB theme cannot smuggle CSS through `base`/`heading`/`body`.
    accentHues: kit.accentHues.map((hue) => ({
      name: hue.name,
      base: safeHex(hue.base, FALLBACK_HUE)
    })),
    fonts: {
      heading: safeCssValue(kit.fonts.heading, FALLBACK_FONT),
      body: safeCssValue(kit.fonts.body, FALLBACK_FONT)
    },
    ...(visualDensity ? { visualDensity } : {}),
    structureFeatures: projectStructureFeatures(kit)
  };
}

/** Projects the kit's effects/background into renderable structure flags. */
function projectStructureFeatures(kit: DesignStyleKit): SelectedThemeStructureFeatures {
  const { effects, background } = kit;
  return {
    radiusPx: effects.cardRadiusPx,
    shadow: hasShadow(effects.cardShadow),
    ...(effects.cardBackdropBlurPx !== undefined
      ? { backdropBlurPx: effects.cardBackdropBlurPx }
      : {}),
    ...(effects.glow ? { glow: true } : {}),
    ...(background.textureOverlay ? { texture: background.textureOverlay } : {}),
    ...(background.gradientAnimation
      ? {
          animation: {
            preset: background.gradientAnimation.preset,
            durationMs: background.gradientAnimation.durationMs
          }
        }
      : {})
  };
}

/** A card shadow counts only when it actually paints something. */
function hasShadow(cardShadow: string): boolean {
  const value = cardShadow.trim().toLowerCase();
  return value.length > 0 && value !== "none";
}

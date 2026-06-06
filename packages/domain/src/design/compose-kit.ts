import { defaultDesignStyleKit } from "@/design/default-design-style-kit";
import type { DesignStyleKit } from "@/design/design-style-kit.types";
import type { FontStyleKit, PaletteStyleKit, StyleStyleKit } from "@/design/theme.types";

export interface ComposeKitParts {
  readonly style?: StyleStyleKit;
  readonly palette?: PaletteStyleKit;
  readonly font?: FontStyleKit;
}

/**
 * Merges the three partial kits (one per selection axis) into a complete,
 * renderable DesignStyleKit. Layered over defaultDesignStyleKit():
 * default → style (structure: effects/motion/typeScale/patterns/background
 * overlays) → palette (colour: accentHues/gradient/surface/border/background css)
 * → font (families). Any missing axis leaves that part at the default. See
 * specs/007-design-theme-system/contracts/theme-selection.md.
 */
export function composeKit(parts: ComposeKitParts): DesignStyleKit {
  const base = defaultDesignStyleKit();
  const { style, palette, font } = parts;

  const effects: DesignStyleKit["effects"] = {
    ...base.effects,
    ...(style
      ? {
          cardRadiusPx: style.effects.cardRadiusPx,
          cardShadow: style.effects.cardShadow,
          ...(style.effects.cardBackdropBlurPx !== undefined
            ? { cardBackdropBlurPx: style.effects.cardBackdropBlurPx }
            : {}),
          ...(style.effects.glow !== undefined ? { glow: style.effects.glow } : {})
        }
      : {}),
    ...(palette
      ? {
          cardSurface: palette.cardSurface,
          cardBorder: palette.cardBorder,
          accentGradient: palette.accentGradient
        }
      : {}),
    // A style may reclaim the card border when it is structural (brutalism's frame),
    // overriding the palette's colour-axis border.
    ...(style?.effects.cardBorder !== undefined ? { cardBorder: style.effects.cardBorder } : {})
  };

  const background: DesignStyleKit["background"] = {
    css: palette ? palette.background.css : base.background.css,
    ...(style?.backgroundStructure?.textureOverlay !== undefined
      ? { textureOverlay: style.backgroundStructure.textureOverlay }
      : {}),
    ...(style?.backgroundStructure?.gradientAnimation !== undefined
      ? { gradientAnimation: style.backgroundStructure.gradientAnimation }
      : {}),
    ...(style?.backgroundStructure?.ambient !== undefined
      ? { ambient: style.backgroundStructure.ambient }
      : {})
  };

  return {
    ...base,
    fonts: font ? font.fonts : base.fonts,
    typeScale: style?.typeScale ? { ...base.typeScale, ...style.typeScale } : base.typeScale,
    motion: style ? style.motion : base.motion,
    effects,
    background,
    accentHues: palette ? palette.accentHues : base.accentHues,
    patternLayouts: style?.patternLayouts ?? base.patternLayouts,
    antiPatterns: style?.antiPatterns ?? base.antiPatterns
  };
}

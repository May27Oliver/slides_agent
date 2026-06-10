import type { BrowsableTheme } from "@slides-agent/domain";
import { extractSwatch } from "@/features/theme-picker/theme-swatch";

/**
 * 011: the kind-specific lightweight swatch — colour chips (palette) / font sample
 * (font) / a radius chip (style) — derived from the theme's partial styleKit at the
 * use boundary (`extractSwatch` already drops CSS-unsafe values). Shared by the
 * browse modal rows AND the always-on summary so the picker never renders two swatch
 * implementations (No-drift). `size` keeps a tidy box in dense lists vs the summary.
 */
export function ThemeSwatchView({
  theme,
  size = "md"
}: {
  theme: BrowsableTheme;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-6 w-6" : "h-9 w-9";
  const swatch = extractSwatch(theme);

  // Purely decorative — every usage shows the theme name as text alongside, so the
  // swatch is hidden from assistive tech (avoids reading "Aa" / colour spans).
  if (!swatch) {
    return (
      <span
        aria-hidden="true"
        className={`${box} shrink-0 rounded-lg border border-line bg-surface`}
      />
    );
  }
  if (swatch.kind === "palette") {
    return (
      <span
        aria-hidden="true"
        className={`flex ${box} shrink-0 overflow-hidden rounded-lg border border-line`}
        style={swatch.background ? { background: swatch.background } : undefined}
      >
        {swatch.colors.slice(0, 4).map((color, index) => (
          <span key={index} className="flex-1" style={{ backgroundColor: color }} />
        ))}
      </span>
    );
  }
  if (swatch.kind === "font") {
    return (
      <span
        aria-hidden="true"
        className={`grid ${box} shrink-0 place-items-center rounded-lg border border-line bg-white font-bold text-ink ${size === "sm" ? "text-xs" : "text-lg"}`}
        style={{ fontFamily: swatch.heading }}
      >
        Aa
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${box} shrink-0 border border-line bg-white`}
      style={{
        borderRadius: swatch.radiusPx != null ? `${Math.min(swatch.radiusPx, 18)}px` : "8px"
      }}
    />
  );
}

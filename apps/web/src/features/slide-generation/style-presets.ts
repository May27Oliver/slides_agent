import type { TranslationKey } from "@/i18n";

export type StylePresetKey =
  | "preset.style.professional"
  | "preset.style.warm"
  | "preset.style.vibrant"
  | "preset.style.elegant"
  | "preset.style.tech"
  | "preset.style.minimal";

export interface StylePresetPreview {
  key: StylePresetKey;
  styleDirection: string;
  // Plain arrays: the card only iterates these (never indexes a fixed position),
  // and the count policy (>=6 tonally-ordered swatches, 2-3 chips) is enforced by
  // style-presets.test.ts. The palette is ordered (dark->light / warm->cool) so the
  // gapless swatch strip reads as a cinematic colour ramp.
  palette: readonly string[];
  featureKeys: readonly TranslationKey[];
  densityLabelKey: TranslationKey;
}

// Each preset's styleDirection is a curated keyword phrase that reliably selects
// a coherent design kit (font pairing + palette) in the backend's
// selectDesignStyleKit. The phrase is decoupled from translated UI labels so
// switching languages never changes which design kit a preset maps to.
export const stylePresets: readonly StylePresetPreview[] = [
  {
    key: "preset.style.professional",
    styleDirection: "professional business corporate 商務",
    palette: ["#0B1F33", "#1E3A8A", "#2563EB", "#3B82F6", "#93C5FD", "#E0F2FE"],
    featureKeys: [
      "preset.style.professional.feature.structure",
      "preset.style.professional.feature.trust",
      "preset.style.professional.feature.data"
    ],
    densityLabelKey: "preset.style.density.mediumHigh"
  },
  {
    key: "preset.style.warm",
    styleDirection: "warm friendly approachable 暖 親切",
    palette: ["#3F2A1D", "#92400E", "#B45309", "#F59E0B", "#FCD34D", "#FDE68A"],
    featureKeys: [
      "preset.style.warm.feature.human",
      "preset.style.warm.feature.soft",
      "preset.style.warm.feature.inviting"
    ],
    densityLabelKey: "preset.style.density.medium"
  },
  {
    key: "preset.style.vibrant",
    styleDirection: "playful creative vibrant 活潑 創意",
    palette: ["#4C1D95", "#7C3AED", "#EC4899", "#F472B6", "#22D3EE", "#67E8F9"],
    featureKeys: [
      "preset.style.vibrant.feature.bold",
      "preset.style.vibrant.feature.playful",
      "preset.style.vibrant.feature.creative"
    ],
    densityLabelKey: "preset.style.density.rich"
  },
  {
    key: "preset.style.elegant",
    styleDirection: "elegant luxury editorial 優雅 高級",
    palette: ["#18181B", "#7F1D1D", "#A16207", "#CA8A04", "#E7E5E4", "#F5F5F4"],
    featureKeys: [
      "preset.style.elegant.feature.editorial",
      "preset.style.elegant.feature.refined",
      "preset.style.elegant.feature.premium"
    ],
    densityLabelKey: "preset.style.density.medium"
  },
  {
    key: "preset.style.tech",
    styleDirection: "tech startup developer 科技",
    palette: ["#0F172A", "#134E4A", "#14B8A6", "#38BDF8", "#7DD3FC", "#E2E8F0"],
    featureKeys: [
      "preset.style.tech.feature.system",
      "preset.style.tech.feature.sharp",
      "preset.style.tech.feature.product"
    ],
    densityLabelKey: "preset.style.density.high"
  },
  {
    key: "preset.style.minimal",
    styleDirection: "minimal geometric clean 簡潔",
    palette: ["#111827", "#374151", "#6B7280", "#9CA3AF", "#D1D5DB", "#F9FAFB"],
    featureKeys: [
      "preset.style.minimal.feature.clean",
      "preset.style.minimal.feature.sparse",
      "preset.style.minimal.feature.focused"
    ],
    densityLabelKey: "preset.style.density.low"
  }
];

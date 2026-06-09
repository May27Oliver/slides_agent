import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES, translations } from "@/i18n/translations";
import { stylePresets } from "@/features/slide-generation/style-presets";

const existingStyleDirections = [
  "professional business corporate 商務",
  "warm friendly approachable 暖 親切",
  "playful creative vibrant 活潑 創意",
  "elegant luxury editorial 優雅 高級",
  "tech startup developer 科技",
  "minimal geometric clean 簡潔"
];

describe("style presets", () => {
  it("keeps the existing backend styleDirection keywords unchanged", () => {
    expect(stylePresets.map((preset) => preset.styleDirection)).toEqual(existingStyleDirections);
  });

  it("provides preview metadata for every preset", () => {
    expect(stylePresets).toHaveLength(6);

    for (const preset of stylePresets) {
      // >=6 tonally-ordered swatches so the strip reads as a cinematic colour ramp.
      expect(preset.palette.length).toBeGreaterThanOrEqual(6);
      expect(preset.featureKeys.length).toBeGreaterThanOrEqual(2);
      expect(preset.featureKeys.length).toBeLessThanOrEqual(3);
      expect(preset.densityLabelKey).toBeTruthy();
    }
  });

  it("has translated labels for all preview copy in every supported locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const preset of stylePresets) {
        expect(translations[locale][preset.key]).toBeTruthy();
        expect(translations[locale][preset.densityLabelKey]).toBeTruthy();

        for (const featureKey of preset.featureKeys) {
          expect(translations[locale][featureKey]).toBeTruthy();
        }
      }
    }
  });
});

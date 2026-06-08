import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES, translations } from "@/i18n/translations";
import { chartPresets } from "@/features/slide-generation/chart-presets";

describe("chart presets", () => {
  it("covers the four existing chart-emphasis presets in order", () => {
    expect(chartPresets.map((preset) => preset.key)).toEqual([
      "preset.chart.none",
      "preset.chart.comparison",
      "preset.chart.trend",
      "preset.chart.metric"
    ]);
  });

  it("maps each preset to its representative 008 visual kinds (none stays empty)", () => {
    const byKey = Object.fromEntries(
      chartPresets.map((preset) => [preset.key, preset.exampleVisualKinds])
    );

    expect(byKey["preset.chart.none"]).toEqual([]);
    expect(byKey["preset.chart.comparison"]).toEqual(["bar", "pie_donut"]);
    expect(byKey["preset.chart.trend"]).toEqual(["line"]);
    expect(byKey["preset.chart.metric"]).toEqual(["metric_card"]);
  });

  it("emits a language-decoupled chartEmphasis keyword (empty only for none)", () => {
    for (const preset of chartPresets) {
      if (preset.key === "preset.chart.none") {
        expect(preset.chartEmphasis).toBe("");
      } else {
        expect(preset.chartEmphasis.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("has a translated name + preview description for every preset in every locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const preset of chartPresets) {
        expect(translations[locale][preset.key]).toBeTruthy();
        expect(translations[locale][preset.descriptionKey]).toBeTruthy();
      }
    }
  });
});

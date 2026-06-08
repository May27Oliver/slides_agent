import type { ChartVisualKind } from "@/features/slide-generation/chart-visual-kind";
import type { TranslationKey } from "@/i18n";

export type ChartPresetKey =
  | "preset.chart.none"
  | "preset.chart.comparison"
  | "preset.chart.trend"
  | "preset.chart.metric";

export interface ChartPreset {
  key: ChartPresetKey;
  // Curated keyword phrase emitted as the request's `chartEmphasis`. Bilingual and
  // decoupled from the translated label, so switching languages never changes the
  // tendency the backend planner receives. Empty for "none" → no emphasis at all.
  chartEmphasis: string;
  // One-line preview copy (i18n key). Describes the tendency without promising a
  // chart — the backend still decides chartability from the actual content.
  descriptionKey: TranslationKey;
  // Representative 008 visual kinds this preset tends to guide toward (示意, may be
  // empty for "none"). Drawn from the same union the rendered-charts panel uses.
  exampleVisualKinds: readonly ChartVisualKind[];
}

// The four chart presets mirror the existing chartEmphasis tendencies; selecting
// one still only writes free-text `chartEmphasis` guidance — it never forces a
// chart type. Order matches the legacy preset chips (none first).
export const chartPresets: readonly ChartPreset[] = [
  {
    key: "preset.chart.none",
    chartEmphasis: "",
    descriptionKey: "preset.chart.none.desc",
    exampleVisualKinds: []
  },
  {
    key: "preset.chart.comparison",
    chartEmphasis: "comparison ranking 比較 排名",
    descriptionKey: "preset.chart.comparison.desc",
    exampleVisualKinds: ["bar", "pie_donut"]
  },
  {
    key: "preset.chart.trend",
    chartEmphasis: "trend over time 趨勢 時間",
    descriptionKey: "preset.chart.trend.desc",
    exampleVisualKinds: ["line"]
  },
  {
    key: "preset.chart.metric",
    chartEmphasis: "key metric highlight 指標 重點數字",
    descriptionKey: "preset.chart.metric.desc",
    exampleVisualKinds: ["metric_card"]
  }
];

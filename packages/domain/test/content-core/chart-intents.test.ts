import { describe, expect, it } from "vitest";
import { ChartIntentPlanner } from "@/content-core/chart-intent-planner";
import type { SourceFact } from "@/deck/types";
import { readJsonFixture } from "../support/fixtures";

interface ExpectedChartIntentsFixture {
  chartIntents: Array<{
    id: string;
    sourceFacts: string[];
    recommendedVisuals: string[];
  }>;
}

describe("layered chart intent decisions", () => {
  it("detects numeric visualization opportunities before applying user chart emphasis", () => {
    const expected = readJsonFixture<ExpectedChartIntentsFixture>("expected-chart-intents.json");
    const sourceFacts: SourceFact[] = [
      {
        id: "fact_conversion_before",
        kind: "metric",
        value: "18%",
        sourceText: "Onboarding conversion 從 18% 提升到 25%"
      },
      {
        id: "fact_conversion_after",
        kind: "metric",
        value: "25%",
        sourceText: "Onboarding conversion 從 18% 提升到 25%"
      },
      {
        id: "fact_response_before",
        kind: "metric",
        value: "12 小時",
        sourceText: "客服首次回覆時間從 12 小時降到 4 小時"
      },
      {
        id: "fact_response_after",
        kind: "metric",
        value: "4 小時",
        sourceText: "客服首次回覆時間從 12 小時降到 4 小時"
      },
      {
        id: "fact_deadline",
        kind: "date",
        value: "2026-08-15",
        sourceText: "Dashboard MVP 需在 2026-08-15 前完成"
      },
      {
        id: "fact_resource",
        kind: "constraint",
        value: "0.5 FTE",
        sourceText: "Design resource 只有 0.5 FTE"
      }
    ];

    const result = new ChartIntentPlanner().plan({
      sourceFacts,
      chartEmphasis: "把 conversion、回覆時間、deadline 和 resource risk 做成容易比較的視覺重點"
    });

    expect(result.intents).toHaveLength(expected.chartIntents.length);
    for (const expectedIntent of expected.chartIntents) {
      expect(result.intents).toContainEqual(
        expect.objectContaining({
          id: expectedIntent.id,
          recommendedVisuals: expect.arrayContaining(expectedIntent.recommendedVisuals),
          userEmphasisMatched: true
        })
      );
    }
  });
});

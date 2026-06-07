import { describe, expect, it } from "vitest";
import { ChartIntentPlanner } from "@/content-core/chart-intent-planner";
import type { SourceFact, SourceFactKind } from "@/deck/deck.types";

let counter = 0;
function fact(
  value: string,
  sourceText: string,
  sectionId: string,
  kind: SourceFactKind = "metric"
): SourceFact {
  counter += 1;
  return { id: `f${counter}`, kind, value, sourceText, sourceSectionId: sectionId };
}

function plan(facts: SourceFact[]) {
  return new ChartIntentPlanner().plan({ sourceFacts: facts }).intents;
}

describe("ChartIntentPlanner (US6 — generalizing, arbitrary content)", () => {
  it("turns a same-unit multi-category group into a comparison intent (→ bar)", () => {
    const intents = plan([
      fact("$1.1M", "北美：$1.1M", "s_region"),
      fact("$0.6M", "歐洲：$0.6M", "s_region"),
      fact("$0.4M", "亞太：$0.4M", "s_region"),
      fact("$0.2M", "拉丁美洲：$0.2M", "s_region")
    ]);
    expect(intents).toHaveLength(1);
    expect(intents[0]!.recommendedVisuals).toEqual(["comparison"]);
    expect(intents[0]!.sourceFacts.map((f) => f.value)).toEqual([
      "$1.1M",
      "$0.6M",
      "$0.4M",
      "$0.2M"
    ]);
  });

  it("turns a same-unit time series into a timeline intent (→ line)", () => {
    const intents = plan([
      fact("$1.0M", "Q1 2026 新增訂單 $1.0M", "s_q"),
      fact("$1.4M", "Q2 2026 新增訂單 $1.4M", "s_q"),
      fact("$1.9M", "Q3 2026 新增訂單 $1.9M", "s_q"),
      fact("$2.6M", "Q4 2026 新增訂單 $2.6M", "s_q")
    ]);
    expect(intents).toHaveLength(1);
    expect(intents[0]!.recommendedVisuals).toEqual(["timeline"]);
  });

  it("turns a percentage part-to-whole (sum≈100) into a comparison intent (→ pie)", () => {
    const intents = plan([
      fact("52%", "行動裝置：52%", "s_dev"),
      fact("33%", "桌機：33%", "s_dev"),
      fact("15%", "平板：15%", "s_dev")
    ]);
    expect(intents).toHaveLength(1);
    expect(intents[0]!.recommendedVisuals).toEqual(["comparison"]);
  });

  it("keeps a same-line before/after percentage pair as a comparison (→ bar, not pie)", () => {
    const line = "Onboarding conversion 從 18% 提升到 25%";
    const intents = plan([fact("18%", line, "s_goal"), fact("25%", line, "s_goal")]);
    expect(intents).toHaveLength(1);
    expect(intents[0]!.recommendedVisuals).toEqual(["comparison"]);
  });

  it("refuses to chart unrelated percentages (different lines, not summing ~100)", () => {
    const intents = plan([
      fact("18%", "年增率 18%", "s_overview"),
      fact("112%", "淨收入留存率 112%", "s_overview")
    ]);
    expect(intents).toHaveLength(0);
  });

  it("produces no intent when there is no chartable numeric series", () => {
    const intents = plan([
      fact("顯著成長", "整體顯著成長", "s_text"),
      fact("dashboard MVP", "只做 dashboard MVP", "s_dec", "decision")
    ]);
    expect(intents).toHaveLength(0);
  });

  it("does not depend on hardcoded sample values (planner groups arbitrary metric facts)", () => {
    // This exercises planner grouping once SourceFacts already exist. End-to-end
    // extraction of arbitrary "number + short unit" tokens is a later extractor task.
    const intents = plan([
      fact("820 users", "團隊 A：820 users", "s_team"),
      fact("1,140 users", "團隊 B：1,140 users", "s_team")
    ]);
    expect(intents).toHaveLength(1);
    expect(intents[0]!.recommendedVisuals).toEqual(["comparison"]);
    expect(intents[0]!.sourceFacts).toHaveLength(2);
  });

  it("groups by section so each topic gets its own intent", () => {
    const intents = plan([
      fact("$1.1M", "北美：$1.1M", "s_region"),
      fact("$0.6M", "歐洲：$0.6M", "s_region"),
      fact("52%", "行動：52%", "s_dev"),
      fact("48%", "桌機：48%", "s_dev")
    ]);
    expect(intents).toHaveLength(2);
  });

  it("titles an intent from its source section heading when provided", () => {
    const result = new ChartIntentPlanner().plan({
      sourceFacts: [
        fact("$1.1M", "北美：$1.1M", "s_region"),
        fact("$0.6M", "歐洲：$0.6M", "s_region")
      ],
      sections: [{ id: "s_region", heading: "各區域營收貢獻" }]
    });
    expect(result.intents[0]!.title).toBe("各區域營收貢獻");
  });

  it("forwards user chart emphasis into the rationale", () => {
    const result = new ChartIntentPlanner().plan({
      sourceFacts: [fact("$1M", "A：$1M", "s"), fact("$2M", "B：$2M", "s")],
      chartEmphasis: "強調區域差異"
    });
    expect(result.intents[0]!.rationale).toContain("強調區域差異");
  });
});

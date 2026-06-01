import { describe, expect, it } from "vitest";
import { loadPendingModule } from "../support/pending-module";

interface SemanticTitlePlannerModule {
  planSemanticSlideTitles(sections: SemanticTitleInputSection[]): SemanticTitleResult[];
}

interface SemanticTitleInputSection {
  id: string;
  heading: string;
  text: string;
}

interface SemanticTitleResult {
  sourceSectionId: string;
  title: string;
}

describe("semantic slide titles", () => {
  it("summarizes slide meaning instead of copying the original section heading", async () => {
    const { planSemanticSlideTitles } = await loadPendingModule<SemanticTitlePlannerModule>(
      "@/content-core/semantic-title-planner"
    );

    const titles = planSemanticSlideTitles([
      {
        id: "goals",
        heading: "目標",
        text: [
          "Onboarding conversion 從 18% 提升到 25%",
          "客服首次回覆時間從 12 小時降到 4 小時",
          "Dashboard MVP 需在 2026-08-15 前完成"
        ].join("\n")
      }
    ]);

    expect(titles).toEqual([
      {
        sourceSectionId: "goals",
        title: "Q3 planning focuses on conversion, response time, and MVP delivery"
      }
    ]);
    expect(titles[0]?.title).not.toBe("目標");
  });
});

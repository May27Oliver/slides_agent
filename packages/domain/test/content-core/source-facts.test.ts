import { describe, expect, it } from "vitest";
import { extractSourceFacts } from "@slides-agent/domain";
import { readJsonFixture, readRootFixture } from "../support/fixtures";

interface ExpectedSourceFactsFixture {
  facts: Array<{ value: string; sourceText: string }>;
}

describe("source fact extraction", () => {
  it("preserves important facts, numbers, decisions, risks, and constraints from the source", async () => {
    const sourceContent = readRootFixture("planning-brief.md");
    const expected = readJsonFixture<ExpectedSourceFactsFixture>("expected-source-facts.json");

    const facts = extractSourceFacts(sourceContent);

    for (const expectedFact of expected.facts) {
      expect(facts).toContainEqual(
        expect.objectContaining({
          value: expectedFact.value,
          sourceText: expectedFact.sourceText
        })
      );
    }

    expect(facts.map((fact) => fact.value)).toEqual(
      expect.arrayContaining([
        "18%",
        "25%",
        "12 小時",
        "4 小時",
        "2026-08-15",
        "dashboard MVP",
        "full CRM integration",
        "0.5 FTE"
      ])
    );
  });

  it("extracts currency amounts as chartable metric facts (008 US6)", () => {
    const facts = extractSourceFacts("# 區域營收\n\n- 北美：$1.1M\n- 歐洲：$0.6M\n- 亞太：$0.4M\n");
    expect(facts.map((fact) => fact.value)).toEqual(
      expect.arrayContaining(["$1.1M", "$0.6M", "$0.4M"])
    );
    for (const fact of facts) {
      expect(fact.kind).toBe("metric");
    }
  });

  it("gives each prose fact a sentence-scoped sourceText, not the whole paragraph", () => {
    // A mixed-metric paragraph: a stray "2026" must not bleed onto the 112% fact,
    // or the chart planner would force an unrelated 18%→112% timeline.
    const facts = extractSourceFacts(
      "# 年度總覽\n\n截至 2026 年底，較前一年成長 18%。淨收入留存率維持在 112%，顯示體質改善。\n"
    );
    const growth = facts.find((fact) => fact.value === "18%");
    const retention = facts.find((fact) => fact.value === "112%");
    expect(growth?.sourceText).toContain("2026");
    expect(growth?.sourceText).not.toContain("112%");
    expect(retention?.sourceText).not.toContain("2026");
    expect(retention?.sourceText).not.toContain("18%");
  });
});

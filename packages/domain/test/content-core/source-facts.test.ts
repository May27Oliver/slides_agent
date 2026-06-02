import { describe, expect, it } from "vitest";
import type { SourceFact } from "@/deck/deck.types";
import { readJsonFixture, readRootFixture } from "../support/fixtures";
import { loadPendingModule } from "../support/pending-module";

interface SourceFactExtractorModule {
  extractSourceFacts(sourceContent: string): SourceFact[];
}

interface ExpectedSourceFactsFixture {
  facts: Array<{ value: string; sourceText: string }>;
}

describe("source fact extraction", () => {
  it("preserves important facts, numbers, decisions, risks, and constraints from the source", async () => {
    const { extractSourceFacts } = await loadPendingModule<SourceFactExtractorModule>(
      "@/content-core/source-fact-extractor"
    );
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
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildChartMatrix, type ChartMatrixCase } from "../scripts/preview-chart-matrix";
import expectedVisuals from "./fixtures/chart-matrix-visuals.json";

const matrix = buildChartMatrix();

/**
 * Source-of-truth enabled style ids, read straight from the committed seed the
 * script consumes — NOT from `matrix.styleIds`. Asserting coverage against this
 * (rather than the matrix's own report) is what makes the completeness check
 * non-tautological: if buildChartMatrix silently drops an enabled style, the
 * matrix and its self-report would agree, but this independent set would not.
 */
function enabledStyleIdsFromSeed(): string[] {
  const seeds = JSON.parse(
    readFileSync(new URL("../src/infra/db/seeds/theme-styles.json", import.meta.url), "utf8")
  ) as Array<{ id: string; support: string }>;
  return seeds.filter((seed) => seed.support === "full").map((seed) => seed.id);
}

/** Style × visual combinations present in the expected set but missing from cases. */
function findMissing(cases: ChartMatrixCase[], styleIds: string[], visuals: string[]): string[] {
  const present = new Set(cases.map((entry) => `${entry.styleId}::${entry.chartVisual}`));
  const missing: string[] = [];
  for (const styleId of styleIds) {
    for (const visual of visuals) {
      if (!present.has(`${styleId}::${visual}`)) {
        missing.push(`${styleId}::${visual}`);
      }
    }
  }
  return missing;
}

describe("chart preview matrix completeness", () => {
  it("renders at least one enabled style and every expected chart visual", () => {
    expect(matrix.styleIds.length).toBeGreaterThan(0);
    expect([...matrix.visuals].sort()).toEqual([...expectedVisuals.visuals].sort());
  });

  it("covers exactly the styles enabled in the seed source of truth", () => {
    const expected = enabledStyleIdsFromSeed();
    expect(expected.length).toBeGreaterThan(0);
    expect([...matrix.styleIds].sort()).toEqual([...expected].sort());
  });

  it("covers every style × visual combination", () => {
    expect(matrix.cases).toHaveLength(matrix.styleIds.length * expectedVisuals.visuals.length);
    expect(findMissing(matrix.cases, matrix.styleIds, expectedVisuals.visuals)).toEqual([]);
  });

  it("detects a missing style × visual combination", () => {
    const dropped = matrix.cases.slice(1);
    const missing = findMissing(dropped, matrix.styleIds, expectedVisuals.visuals);
    expect(missing.length).toBeGreaterThan(0);
  });

  it("renders each sample as its intended visual (no unexpected fallback)", () => {
    const fallbacks = matrix.cases.filter((entry) => !entry.ok);
    expect(fallbacks.map((entry) => entry.file)).toEqual([]);
  });
});

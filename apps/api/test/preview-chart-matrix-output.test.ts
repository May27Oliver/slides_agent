import { describe, expect, it } from "vitest";
import { buildChartMatrix } from "../scripts/preview-chart-matrix";

const matrix = buildChartMatrix();

describe("chart preview matrix output is self-contained", () => {
  it("emits no external resources or event handlers in any chart fragment", () => {
    for (const entry of matrix.cases) {
      expect(entry.chartHtml, entry.file).not.toMatch(/<script|<link|url\(http|onclick=/iu);
    }
  });

  it("produces a non-blank document carrying the expected visual for each case", () => {
    for (const entry of matrix.cases) {
      expect(entry.docHtml.length, entry.file).toBeGreaterThan(500);
      expect(entry.docHtml, entry.file).toContain(`data-chart-visual="${entry.chartVisual}"`);
    }
  });

  it("adds no external <script src=> chart runtime to the document", () => {
    for (const entry of matrix.cases) {
      expect(entry.docHtml, entry.file).not.toMatch(/<script[^>]*\bsrc=/iu);
    }
  });
});

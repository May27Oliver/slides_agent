import { describe, expect, it } from "vitest";
import { parseMetricValue, periodLabel } from "@/content-core/metric-fact-parser";

describe("parseMetricValue", () => {
  it("parses currency with a magnitude suffix and preserves the display", () => {
    const parsed = parseMetricValue("$2.3M");
    expect(parsed).not.toBeNull();
    expect(parsed!.display).toBe("$2.3M");
    expect(parsed!.numericValue).toBeCloseTo(2.3);
    expect(parsed!.prefix).toBe("$");
    expect(parsed!.suffix).toBe("M");
    expect(parsed!.unit).toBe("$M");
  });

  it("parses a percentage", () => {
    const parsed = parseMetricValue("45%");
    expect(parsed!.numericValue).toBe(45);
    expect(parsed!.unit).toBe("%");
  });

  it("parses thousands separators without rewriting the display", () => {
    const parsed = parseMetricValue("1,200 users");
    expect(parsed!.numericValue).toBe(1200);
    expect(parsed!.unit).toBe("users");
    expect(parsed!.display).toBe("1,200 users");
  });

  it("returns null for text without a leading number", () => {
    expect(parseMetricValue("顯著成長")).toBeNull();
    expect(parseMetricValue("Q3 2026")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseMetricValue("   ")).toBeNull();
  });

  it("parses a negative value", () => {
    const parsed = parseMetricValue("-5%");
    expect(parsed!.numericValue).toBe(-5);
    expect(parsed!.unit).toBe("%");
  });
});

describe("periodLabel", () => {
  it("extracts the period token from a sentence", () => {
    expect(periodLabel("Q1 2026 新增訂單金額為 $1.0M")).toBe("Q1 2026");
    expect(periodLabel("2026 年營收")).toBe("2026 年");
    expect(periodLabel("北美：$1.1M")).toBeNull();
  });
});

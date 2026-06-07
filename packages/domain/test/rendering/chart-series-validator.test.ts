import { describe, expect, it } from "vitest";
import { extractChartSeries } from "@/rendering/chart-series-extractor";
import {
  validateBarSeries,
  validateLineSeries,
  validatePieSeries
} from "@/rendering/chart-series-validator";
import { barFacts, fact, intent, pieFacts, timeFacts } from "./chart-rendering-fixtures";

function series(facts: ReturnType<typeof fact>[], treatment: "chart" | "timeline") {
  return extractChartSeries({ intent: intent({ sourceFacts: facts }), treatment });
}

describe("chart series validators", () => {
  it("accepts a valid percentage pie", () => {
    expect(validatePieSeries(series(pieFacts, "chart")).ok).toBe(true);
  });

  it("rejects a pie with a negative value", () => {
    const negative = [
      fact({ value: "60%", sourceText: "A 60%" }),
      fact({ value: "-10%", sourceText: "B -10%" })
    ];
    const result = validatePieSeries(series(negative, "chart"));
    expect(result.ok).toBe(false);
    expect(result.notes[0]!.code).toBe("invalid_pie_total");
  });

  it("rejects a pie whose total is not positive", () => {
    const zeros = [
      fact({ value: "0", sourceText: "A 0" }),
      fact({ value: "0", sourceText: "B 0" })
    ];
    const result = validatePieSeries(series(zeros, "chart"));
    expect(result.ok).toBe(false);
    expect(result.notes[0]!.code).toBe("invalid_pie_total");
  });

  it("accepts an ordered time series for line but rejects unsortable data", () => {
    expect(validateLineSeries(series(timeFacts, "timeline")).ok).toBe(true);
    const unsortable = validateLineSeries(series(pieFacts, "timeline"));
    expect(unsortable.ok).toBe(false);
    expect(unsortable.notes[0]!.code).toBe("time_sort_failed");
  });

  it("accepts a same-unit bar but rejects mixed units", () => {
    expect(validateBarSeries(series(barFacts, "chart")).ok).toBe(true);
    const mixed = [
      fact({ value: "$2.3M", sourceText: "營收 $2.3M" }),
      fact({ value: "45%", sourceText: "成長 45%" })
    ];
    const result = validateBarSeries(series(mixed, "chart"));
    expect(result.ok).toBe(false);
    expect(result.notes[0]!.code).toBe("unit_mismatch");
  });

  it("rejects any chart with fewer than two points", () => {
    const single = series([fact({ value: "$2.3M" })], "chart");
    expect(validateBarSeries(single).notes[0]!.code).toBe("series_insufficient");
  });
});

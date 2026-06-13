import { describe, expect, it } from "vitest";
import {
  validateEditRevisionRequest,
  type InvalidEditContract,
  type RevisionConflictContract
} from "@/deck";

describe("edit revision contract (010 US1)", () => {
  it("accepts a well-formed { baseRevision, slideDeck } body", () => {
    const result = validateEditRevisionRequest({
      baseRevision: 2,
      slideDeck: { id: "d", slides: [{ id: "s1" }] }
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a missing or non-integer baseRevision", () => {
    expect(validateEditRevisionRequest({ slideDeck: { slides: [] } }).ok).toBe(false);
    expect(validateEditRevisionRequest({ baseRevision: 1.5, slideDeck: { slides: [] } }).ok).toBe(
      false
    );
    expect(validateEditRevisionRequest({ baseRevision: -1, slideDeck: { slides: [] } }).ok).toBe(
      false
    );
  });

  it("rejects a slideDeck without a slides array", () => {
    expect(validateEditRevisionRequest({ baseRevision: 1, slideDeck: {} }).ok).toBe(false);
    expect(validateEditRevisionRequest({ baseRevision: 1, slideDeck: null }).ok).toBe(false);
    expect(validateEditRevisionRequest("nope").ok).toBe(false);
  });

  it("rejects a slide missing a string id (would corrupt the stored deck)", () => {
    const result = validateEditRevisionRequest({
      baseRevision: 1,
      slideDeck: { slides: [{ title: "no id" }] }
    });
    expect(result.ok).toBe(false);
  });

  it("rejects oversized text fields (storage/CPU abuse guard)", () => {
    const huge = "x".repeat(5000);
    const result = validateEditRevisionRequest({
      baseRevision: 1,
      slideDeck: { slides: [{ id: "s1", title: huge }] }
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.includes("title too long"))).toBe(true);
  });

  it("accepts an optional themeSelection (011) and rejects a malformed one", () => {
    expect(
      validateEditRevisionRequest({
        baseRevision: 2,
        slideDeck: { id: "d", slides: [{ id: "s1" }] },
        themeSelection: { paletteId: "palette-10" }
      }).ok
    ).toBe(true);

    const bad = validateEditRevisionRequest({
      baseRevision: 2,
      slideDeck: { id: "d", slides: [{ id: "s1" }] },
      themeSelection: { paletteId: 123 }
    });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.issues).toContain("themeSelection.paletteId");
  });

  // 014: chartOperations — contracts validate shape and cheap request-size caps;
  // deeper semantics (ids, ownership, numeric meaning) live in the domain.
  describe("chartOperations (014)", () => {
    const body = (chartOperations: unknown) => ({
      baseRevision: 2,
      slideDeck: { id: "d", slides: [{ id: "s1" }] },
      chartOperations
    });

    it("accepts all four well-formed operation kinds", () => {
      const result = validateEditRevisionRequest(
        body([
          { op: "set_visual", chartIntentId: "chart-0", visual: "line" },
          { op: "remove_chart", slideId: "s1", chartIntentId: "chart-0" },
          {
            op: "add_chart",
            slideId: "s1",
            source: { kind: "existing_intent", chartIntentId: "chart-1" }
          },
          {
            op: "add_chart",
            slideId: "s1",
            source: {
              kind: "user_data",
              title: "手動圖",
              visual: "bar",
              points: [{ label: "A", valueText: "1", unit: "%" }]
            }
          },
          {
            op: "edit_data",
            chartIntentId: "chart-0",
            title: "改標題",
            points: [
              { kind: "original", sourceFactId: "fact_1" },
              {
                kind: "user",
                point: { label: "B", valueText: "2", unit: null },
                replacesFactId: "fact_2"
              }
            ]
          }
        ])
      );
      expect(result.ok).toBe(true);
    });

    it("accepts an absent chartOperations (existing requests keep working)", () => {
      expect(
        validateEditRevisionRequest({
          baseRevision: 2,
          slideDeck: { id: "d", slides: [{ id: "s1" }] }
        }).ok
      ).toBe(true);
    });

    it("rejects a non-array chartOperations", () => {
      expect(validateEditRevisionRequest(body("nope")).ok).toBe(false);
      expect(validateEditRevisionRequest(body({})).ok).toBe(false);
    });

    it("rejects more than 50 operations", () => {
      const ops = Array.from({ length: 51 }, () => ({
        op: "set_visual",
        chartIntentId: "c",
        visual: "bar"
      }));
      const result = validateEditRevisionRequest(body(ops));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.issues.some((issue) => issue.includes("50"))).toBe(true);
    });

    it("rejects oversized nested point arrays before walking every item", () => {
      const points = Array.from({ length: 13 }, (_, index) => ({
        label: `p${index}`,
        valueText: `${index}`,
        unit: null
      }));

      const add = validateEditRevisionRequest(
        body([
          {
            op: "add_chart",
            slideId: "s1",
            source: { kind: "user_data", title: "手動圖", visual: "bar", points }
          }
        ])
      );
      expect(add.ok).toBe(false);
      if (!add.ok) {
        expect(add.issues).toContain("chartOperations[0].source.points exceeds 12");
      }

      const edit = validateEditRevisionRequest(
        body([
          {
            op: "edit_data",
            chartIntentId: "chart-0",
            points: points.map((point) => ({ kind: "user", point }))
          }
        ])
      );
      expect(edit.ok).toBe(false);
      if (!edit.ok) {
        expect(edit.issues).toContain("chartOperations[0].points exceeds 12");
      }
    });

    it("rejects an unknown op kind and a non-object item", () => {
      expect(validateEditRevisionRequest(body([{ op: "explode" }])).ok).toBe(false);
      expect(validateEditRevisionRequest(body(["nope"])).ok).toBe(false);
    });

    it("rejects per-op missing/mistyped fields", () => {
      // set_visual: missing chartIntentId / unknown visual value.
      expect(validateEditRevisionRequest(body([{ op: "set_visual", visual: "bar" }])).ok).toBe(
        false
      );
      expect(
        validateEditRevisionRequest(
          body([{ op: "set_visual", chartIntentId: "c", visual: "donut3d" }])
        ).ok
      ).toBe(false);
      // remove_chart: missing slideId.
      expect(
        validateEditRevisionRequest(body([{ op: "remove_chart", chartIntentId: "c" }])).ok
      ).toBe(false);
      // add_chart: bad source kind / missing points array.
      expect(
        validateEditRevisionRequest(
          body([{ op: "add_chart", slideId: "s1", source: { kind: "magic" } }])
        ).ok
      ).toBe(false);
      expect(
        validateEditRevisionRequest(
          body([
            {
              op: "add_chart",
              slideId: "s1",
              source: { kind: "user_data", title: "t", visual: "bar" }
            }
          ])
        ).ok
      ).toBe(false);
      // edit_data: points items must be original/user records with the right nesting.
      expect(
        validateEditRevisionRequest(body([{ op: "edit_data", chartIntentId: "c", points: [{}] }]))
          .ok
      ).toBe(false);
      expect(
        validateEditRevisionRequest(
          body([
            {
              op: "edit_data",
              chartIntentId: "c",
              points: [{ kind: "user", point: { label: "x", valueText: 5, unit: null } }]
            }
          ])
        ).ok
      ).toBe(false);
      expect(
        validateEditRevisionRequest(
          body([
            {
              op: "edit_data",
              chartIntentId: "c",
              points: [{ kind: "user", point: { label: "x", valueText: "5", unit: 7 } }]
            }
          ])
        ).ok
      ).toBe(false);
    });

    it("issue messages point at the failing operation index", () => {
      const result = validateEditRevisionRequest(
        body([{ op: "set_visual", chartIntentId: "c", visual: "bar" }, { op: "explode" }])
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.issues.some((issue) => issue.includes("chartOperations[1]"))).toBe(true);
    });
  });

  it("uses the repo's top-level error shape (not a nested { error })", () => {
    // Type-level assertion: error contracts are flat { code, message, ... }.
    const conflict: RevisionConflictContract = {
      code: "REVISION_CONFLICT",
      message: "stale",
      currentRevision: 4
    };
    const invalid: InvalidEditContract = {
      code: "INVALID_EDIT",
      message: "bad",
      fields: ["slideDeck"]
    };
    expect(conflict.code).toBe("REVISION_CONFLICT");
    expect(conflict.currentRevision).toBe(4);
    expect(invalid.code).toBe("INVALID_EDIT");
    expect(invalid.fields).toEqual(["slideDeck"]);
  });

  // 015 (FR-013): outline ids + textStyleOverrides ride the slideDeck — shape-checked
  // here (bounded px + #RRGGBB hex are the DoS boundary); merge semantics in the domain.
  describe("outline ids + textStyleOverrides (015)", () => {
    function body(slide: Record<string, unknown>) {
      return { baseRevision: 1, slideDeck: { id: "d", slides: [{ id: "s1", ...slide }] } };
    }

    it("accepts a legacy slide without ids or overrides (backward compat)", () => {
      expect(validateEditRevisionRequest(body({ outline: [{ text: "t" }] })).ok).toBe(true);
    });

    it("accepts well-formed ids and overrides (px + hex)", () => {
      const result = validateEditRevisionRequest(
        body({
          outline: [{ id: "b1", text: "t" }],
          textStyleOverrides: {
            title: { sizePx: 120, color: "#7170FF" },
            message: { color: "#F7F8F8" },
            outlineById: { b1: { sizePx: 40 } }
          }
        })
      );
      expect(result.ok).toBe(true);
    });

    it("rejects an empty-string outline id", () => {
      expect(validateEditRevisionRequest(body({ outline: [{ id: "", text: "t" }] })).ok).toBe(
        false
      );
    });

    it("rejects an out-of-range sizePx", () => {
      expect(
        validateEditRevisionRequest(body({ textStyleOverrides: { title: { sizePx: 9999 } } })).ok
      ).toBe(false);
      expect(
        validateEditRevisionRequest(body({ textStyleOverrides: { title: { sizePx: 2 } } })).ok
      ).toBe(false);
      expect(
        validateEditRevisionRequest(body({ textStyleOverrides: { title: { sizePx: "big" } } })).ok
      ).toBe(false);
    });

    it("rejects a malformed color (not #RRGGBB hex)", () => {
      expect(
        validateEditRevisionRequest(body({ textStyleOverrides: { message: { color: "red" } } })).ok
      ).toBe(false);
      expect(
        validateEditRevisionRequest(body({ textStyleOverrides: { message: { color: "#fff" } } })).ok
      ).toBe(false);
      expect(
        validateEditRevisionRequest(
          body({ textStyleOverrides: { message: { color: "rgb(1,2,3)" } } })
        ).ok
      ).toBe(false);
    });

    it("rejects a non-object textStyleOverrides / outlineById", () => {
      expect(validateEditRevisionRequest(body({ textStyleOverrides: "loud" })).ok).toBe(false);
      expect(
        validateEditRevisionRequest(body({ textStyleOverrides: { outlineById: [] } })).ok
      ).toBe(false);
    });

    it("rejects an oversized outlineById map (DoS boundary, same cap as bullets)", () => {
      const big: Record<string, { sizePx: number }> = {};
      for (let i = 0; i < 101; i += 1) {
        big[`b${i}`] = { sizePx: 40 };
      }
      expect(
        validateEditRevisionRequest(body({ textStyleOverrides: { outlineById: big } })).ok
      ).toBe(false);
    });
  });
});

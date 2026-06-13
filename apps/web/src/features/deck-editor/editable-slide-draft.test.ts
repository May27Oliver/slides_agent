import { describe, expect, it } from "vitest";
import type { Slide, SlideDeck } from "@slides-agent/domain";
import { EditableSlideDraft } from "@/features/deck-editor/editable-slide-draft";

function slide(id: string, over: Partial<Slide> = {}): Slide {
  return {
    id,
    slideKind: "content",
    type: "content",
    title: `Title ${id}`,
    message: `Message ${id}`,
    // Fixture bullets carry ids so the lazy backfill doesn't consume the id sequence.
    outline: [{ id: `${id}-b1`, text: "b1", sourceTrace: ["t"], emphasis: "evidence" }],
    layout: "title-bullets",
    layoutIntent: { priority: "message_first", density: "medium", emphasis: "narrative" },
    contentBlocks: [],
    sourceTrace: ["s"],
    speakerNotesDraft: "notes",
    ...over
  };
}

function deck(slides: Slide[]): SlideDeck {
  return {
    id: "d",
    title: "Deck",
    purpose: "p",
    audience: "a",
    slides,
    reviewReport: { humanReviewNotes: [] } as unknown as SlideDeck["reviewReport"]
  };
}

const seq = () => {
  let n = 0;
  return () => `new-${++n}`;
};

function draftOf(slides: Slide[]) {
  return EditableSlideDraft.fromRevision(2, deck(slides), seq());
}

describe("EditableSlideDraft (010 US1)", () => {
  it("edits grounded text fields immutably (original draft unchanged)", () => {
    const original = draftOf([slide("s1")]);
    const edited = original
      .setTitle("s1", "New title")
      .setMessage("s1", "New message")
      .setNotes("s1", "New notes")
      .setOutlineText("s1", 0, "New bullet");

    expect(edited.slide("s1")!.title).toBe("New title");
    expect(edited.slide("s1")!.message).toBe("New message");
    expect(edited.slide("s1")!.speakerNotesDraft).toBe("New notes");
    expect(edited.slide("s1")!.outline[0]!.text).toBe("New bullet");
    // immutability
    expect(original.slide("s1")!.title).toBe("Title s1");
  });

  it("adds, removes and reorders bullets", () => {
    const d = draftOf([slide("s1")])
      .addBullet("s1")
      .addBullet("s1", 0);
    expect(d.slide("s1")!.outline.map((o) => o.text)).toEqual(["", "b1", ""]);

    const removed = d.removeBullet("s1", 1);
    expect(removed.slide("s1")!.outline.length).toBe(2);

    const moved = draftOf([
      slide("s1", {
        outline: [
          { text: "a", sourceTrace: [], emphasis: "context" },
          { text: "b", sourceTrace: [], emphasis: "context" }
        ]
      })
    ]).moveBullet("s1", 0, 1);
    expect(moved.slide("s1")!.outline.map((o) => o.text)).toEqual(["b", "a"]);
  });

  it("adds a pure-text new slide after a given slide with empty contentBlocks", () => {
    const d = draftOf([slide("s1"), slide("s2")]).addSlide("s1");
    expect(d.slides.map((s) => s.id)).toEqual(["s1", "new-1", "s2"]);
    const added = d.slide("new-1")!;
    expect(added.contentBlocks).toEqual([]);
    expect(added.outline).toEqual([]);
  });

  it("removes and reorders whole slides", () => {
    const d = draftOf([slide("s1"), slide("s2"), slide("s3")]);
    expect(d.removeSlide("s2").slides.map((s) => s.id)).toEqual(["s1", "s3"]);
    expect(d.moveSlide(2, 0).slides.map((s) => s.id)).toEqual(["s3", "s1", "s2"]);
  });

  it("serialises to the { baseRevision, slideDeck } request contract", () => {
    const d = draftOf([slide("s1")]).setTitle("s1", "X");
    const req = d.toRequest();
    expect(req.baseRevision).toBe(2);
    expect((req.slideDeck as SlideDeck).slides[0]!.title).toBe("X");
    // No chart edits → the field is absent (existing requests stay byte-identical).
    expect("chartOperations" in req).toBe(false);
  });

  // 014 US1: chart visual operations on the draft.
  describe("chart operations (014)", () => {
    it("setChartVisual records a set_visual op; later calls on the same intent replace it", () => {
      const original = draftOf([slide("s1")]);
      const once = original.setChartVisual("chart-0", "line");
      expect(once.chartOperations).toEqual([
        { op: "set_visual", chartIntentId: "chart-0", visual: "line" }
      ]);

      const twice = once.setChartVisual("chart-0", "bar");
      expect(twice.chartOperations).toEqual([
        { op: "set_visual", chartIntentId: "chart-0", visual: "bar" }
      ]);

      const other = twice.setChartVisual("chart-1", "table");
      expect(other.chartOperations).toHaveLength(2);

      // immutability: the originals are untouched.
      expect(original.chartOperations).toEqual([]);
      expect(once.chartOperations).toHaveLength(1);
    });

    it("resetChartEdits removes every op for that intent only", () => {
      const d = draftOf([slide("s1")])
        .setChartVisual("chart-0", "line")
        .setChartVisual("chart-1", "table")
        .resetChartEdits("chart-0");
      expect(d.chartOperations).toEqual([
        { op: "set_visual", chartIntentId: "chart-1", visual: "table" }
      ]);
    });

    it("chartVisualOf reads the pending override (auto when none)", () => {
      const d = draftOf([slide("s1")]).setChartVisual("chart-0", "metric_card");
      expect(d.chartVisualOf("chart-0")).toBe("metric_card");
      expect(d.chartVisualOf("chart-9")).toBe("auto");
    });

    it("chart ops survive unrelated text edits and serialise into the request", () => {
      const d = draftOf([slide("s1")])
        .setChartVisual("chart-0", "pie_donut")
        .setTitle("s1", "Edited")
        .addBullet("s1");
      expect(d.chartOperations).toHaveLength(1);
      const req = d.toRequest();
      expect(req.chartOperations).toEqual([
        { op: "set_visual", chartIntentId: "chart-0", visual: "pie_donut" }
      ]);
    });

    it("removeChart / addChartFromIntent record ops and the effective placement follows", () => {
      const withChart = slide("s1", {
        contentBlocks: [{ kind: "chart_placeholder", content: {}, chartIntentId: "chart-0" }]
      });
      const d = draftOf([withChart, slide("s2")]);
      expect(d.placedChartId("s1")).toBe("chart-0");
      expect(d.placedChartId("s2")).toBeNull();

      const removed = d.removeChart("s1", "chart-0");
      expect(removed.chartOperations).toEqual([
        { op: "remove_chart", slideId: "s1", chartIntentId: "chart-0" }
      ]);
      expect(removed.placedChartId("s1")).toBeNull();
      // contentBlocks stay pristine (010 read-only wall) — only the ops change.
      expect(removed.slide("s1")!.contentBlocks).toHaveLength(1);

      const added = removed.addChartFromIntent("s2", "chart-1");
      expect(added.placedChartId("s2")).toBe("chart-1");
      expect(added.chartOperations).toHaveLength(2);
    });

    it("re-adding the removed intent cancels the pending removal (no redundant ops)", () => {
      const withChart = slide("s1", {
        contentBlocks: [{ kind: "chart_placeholder", content: {}, chartIntentId: "chart-0" }]
      });
      const d = draftOf([withChart])
        .removeChart("s1", "chart-0")
        .addChartFromIntent("s1", "chart-0");
      expect(d.chartOperations).toEqual([]);
      expect(d.placedChartId("s1")).toBe("chart-0");
    });

    it("removing a pending add cancels it instead of stacking remove on add", () => {
      const d = draftOf([slide("s1")])
        .addChartFromIntent("s1", "chart-1")
        .removeChart("s1", "chart-1");
      expect(d.chartOperations).toEqual([]);
      expect(d.placedChartId("s1")).toBeNull();
    });

    it("moving a chart in one request keeps both ops (remove + add on another slide)", () => {
      const withChart = slide("s1", {
        contentBlocks: [{ kind: "chart_placeholder", content: {}, chartIntentId: "chart-0" }]
      });
      const d = draftOf([withChart, slide("s2")])
        .removeChart("s1", "chart-0")
        .addChartFromIntent("s2", "chart-0");
      expect(d.chartOperations).toHaveLength(2);
      expect(d.placedChartId("s1")).toBeNull();
      expect(d.placedChartId("s2")).toBe("chart-0");
    });

    it("removing a slide prunes stale chart ops and remaps pending user_data ids", () => {
      const d = draftOf([slide("s1"), slide("s2")])
        .addChartFromUserData("s1", {
          title: "刪除的圖",
          visual: "bar",
          points: [{ label: "A", valueText: "1", unit: null }]
        })
        .addChartFromUserData("s2", {
          title: "保留的圖",
          visual: "line",
          points: [{ label: "B", valueText: "2", unit: null }]
        })
        .setChartVisual("chart_user_r2_1", "table");

      const removed = d.removeSlide("s1");

      expect(removed.slides.map((s) => s.id)).toEqual(["s2"]);
      expect(removed.chartOperations).toEqual([
        {
          op: "add_chart",
          slideId: "s2",
          source: {
            kind: "user_data",
            title: "保留的圖",
            visual: "line",
            points: [{ label: "B", valueText: "2", unit: null }]
          }
        },
        { op: "set_visual", chartIntentId: "chart_user_r2_0", visual: "table" }
      ]);
      expect(removed.placedChartId("s2")).toBe("chart_user_r2_0");
    });

    it("predicts the deterministic id for a pending user_data add", () => {
      const d = draftOf([slide("s1")]).addChartFromUserData("s1", {
        title: "手動圖",
        visual: "bar",
        points: [{ label: "A", valueText: "1", unit: null }]
      });
      // baseRevision = 2, opIndex = 0 → the id the domain will mint.
      expect(d.placedChartId("s1")).toBe("chart_user_r2_0");
    });

    it("editChartData records a full-list op; a later edit on the same intent replaces it", () => {
      const original = draftOf([slide("s1")]);
      const once = original.editChartData("chart-0", [
        { kind: "original", sourceFactId: "f1" },
        { kind: "user", point: { label: "新點", valueText: "42", unit: "%" } }
      ]);
      expect(once.chartDataOf("chart-0")).toEqual({
        points: [
          { kind: "original", sourceFactId: "f1" },
          { kind: "user", point: { label: "新點", valueText: "42", unit: "%" } }
        ]
      });

      const twice = once.editChartData(
        "chart-0",
        [{ kind: "original", sourceFactId: "f1" }],
        "新標題"
      );
      expect(twice.chartOperations.filter((op) => op.op === "edit_data")).toHaveLength(1);
      expect(twice.chartDataOf("chart-0")).toEqual({
        points: [{ kind: "original", sourceFactId: "f1" }],
        title: "新標題"
      });
      // set_visual ops on the same intent survive an edit_data (different kinds merge independently).
      const mixed = twice.setChartVisual("chart-0", "bar");
      expect(mixed.chartOperations).toHaveLength(2);
      expect(mixed.chartDataOf("chart-0")).not.toBeNull();
    });

    it("chartDataOf returns null when no data edit is pending", () => {
      expect(draftOf([slide("s1")]).chartDataOf("chart-0")).toBeNull();
    });

    it("resetChartEdits clears data edits together with visual ops for the intent", () => {
      const d = draftOf([slide("s1")])
        .setChartVisual("chart-0", "bar")
        .editChartData("chart-0", [{ kind: "original", sourceFactId: "f1" }])
        .resetChartEdits("chart-0");
      expect(d.chartOperations).toEqual([]);
      expect(d.chartDataOf("chart-0")).toBeNull();
    });

    it("fromRevision restores persisted chart operations (localStorage draft path)", () => {
      const restored = EditableSlideDraft.fromRevision(2, deck([slide("s1")]), seq(), [
        { op: "set_visual", chartIntentId: "chart-0", visual: "bar" }
      ]);
      expect(restored.chartOperations).toHaveLength(1);
      expect(restored.chartVisualOf("chart-0")).toBe("bar");
    });
  });

  // 015 US3 (FR-015/FR-016): stable bullet ids + per-field text style overrides.
  describe("outline ids + text styles (015)", () => {
    it("fromRevision lazily backfills missing outline ids (stable within the session, text untouched)", () => {
      const d = draftOf([
        slide("s1", {
          outline: [
            { text: "has id", sourceTrace: ["t"], emphasis: "evidence", id: "keep-me" },
            { text: "no id", sourceTrace: ["t"], emphasis: "evidence" }
          ]
        })
      ]);
      const outline = d.slide("s1")!.outline;
      expect(outline[0]!.id).toBe("keep-me"); // existing id untouched
      expect(outline[1]!.id).toBeTruthy(); // backfilled
      expect(outline[1]!.text).toBe("no id"); // text untouched
      // Stable: reading again yields the same id (backfill happens once).
      expect(d.slide("s1")!.outline[1]!.id).toBe(outline[1]!.id);
    });

    it("addBullet mints a fresh id; ids stay unique across duplicates", () => {
      const d = draftOf([slide("s1")])
        .addBullet("s1")
        .addBullet("s1");
      const ids = d.slide("s1")!.outline.map((o) => o.id);
      expect(ids.every(Boolean)).toBe(true);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("sets and merges field styles immutably", () => {
      const d0 = draftOf([slide("s1")]);
      const d1 = d0.setTitleStyle("s1", { sizePx: 120 });
      const d2 = d1.setTitleStyle("s1", { color: "#7170FF" }); // merges, not replaces
      expect(d0.slide("s1")!.textStyleOverrides).toBeUndefined();
      expect(d2.slide("s1")!.textStyleOverrides?.title).toEqual({
        sizePx: 120,
        color: "#7170FF"
      });
    });

    it("single-property reset clears one axis; full reset clears the field entry", () => {
      const styled = draftOf([slide("s1")])
        .setTitleStyle("s1", { sizePx: 90, color: "#888888" })
        .setMessageStyle("s1", { color: "#7170FF" });
      const sizeCleared = styled.setTitleStyle("s1", { sizePx: undefined });
      expect(sizeCleared.slide("s1")!.textStyleOverrides?.title).toEqual({ color: "#888888" });
      const fullReset = styled.resetFieldStyle("s1", "title");
      expect(fullReset.slide("s1")!.textStyleOverrides?.title).toBeUndefined();
      expect(fullReset.slide("s1")!.textStyleOverrides?.message).toEqual({
        color: "#7170FF"
      });
    });

    it("styles an outline bullet by its id and follows reorder", () => {
      const d = draftOf([
        slide("s1", {
          outline: [
            { id: "a", text: "first", sourceTrace: [], emphasis: "context" },
            { id: "b", text: "second", sourceTrace: [], emphasis: "context" }
          ]
        })
      ])
        .setOutlineStyle("s1", "b", { sizePx: 40 })
        .moveBullet("s1", 1, 0); // b moves to front
      const s = d.slide("s1")!;
      expect(s.outline[0]!.id).toBe("b");
      expect(s.textStyleOverrides?.outlineById).toEqual({ b: { sizePx: 40 } });
    });

    it("removing a bullet drops its style entry (no orphans)", () => {
      const d = draftOf([
        slide("s1", {
          outline: [
            { id: "a", text: "first", sourceTrace: [], emphasis: "context" },
            { id: "b", text: "second", sourceTrace: [], emphasis: "context" }
          ]
        })
      ])
        .setOutlineStyle("s1", "a", { color: "#7170FF" })
        .setOutlineStyle("s1", "b", { color: "#888888" })
        .removeBullet("s1", 0); // removes a
      expect(d.slide("s1")!.textStyleOverrides?.outlineById).toEqual({
        b: { color: "#888888" }
      });
    });

    it("serialises ids and overrides into the request slideDeck", () => {
      const d = draftOf([slide("s1")]).setTitleStyle("s1", { sizePx: 64 });
      const body = d.toRequest();
      const requestSlide = (body.slideDeck as SlideDeck).slides[0]!;
      expect(requestSlide.textStyleOverrides?.title).toEqual({ sizePx: 64 });
      expect(requestSlide.outline.every((o) => o.id)).toBe(true);
    });
  });
});

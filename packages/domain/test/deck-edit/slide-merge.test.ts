import { describe, expect, it } from "vitest";
import { mergeEditedDeck } from "@/deck-edit/slide-merge";
import type {
  ContentBlock,
  LayoutIntent,
  Slide,
  SlideDeck,
  SlideOutlineItem
} from "@/deck/deck.types";

const LAYOUT_INTENT: LayoutIntent = {
  priority: "message_first",
  density: "medium",
  emphasis: "narrative"
};

function outlineItem(text: string, trace: string[] = ["fact-1"]): SlideOutlineItem {
  return { text, sourceTrace: trace, emphasis: "evidence" };
}

function slide(overrides: Partial<Slide> & { id: string }): Slide {
  return {
    slideKind: "content",
    type: "content",
    title: "Base title",
    message: "Base message",
    outline: [outlineItem("Base bullet")],
    layout: "title-bullets",
    layoutIntent: LAYOUT_INTENT,
    contentBlocks: [],
    sourceTrace: ["section-1"],
    speakerNotesDraft: "Base notes",
    ...overrides
  };
}

function deck(slides: Slide[]): SlideDeck {
  return {
    id: "deck-1",
    title: "Deck title",
    subtitle: "Deck subtitle",
    purpose: "p",
    audience: "a",
    slides,
    reviewReport: {
      humanReviewNotes: [],
      uncertainClaims: [],
      sourceCoverage: []
    } as unknown as SlideDeck["reviewReport"]
  };
}

const chartBlock: ContentBlock = {
  kind: "chart_placeholder",
  content: { caption: "Revenue" },
  chartIntentId: "chart-0"
};

describe("mergeEditedDeck (010 US1)", () => {
  it("applies whitelisted text on a retained slide and takes read-only fields from base", () => {
    const base = deck([slide({ id: "s1", contentBlocks: [chartBlock] })]);
    const edited = deck([
      slide({
        id: "s1",
        title: "Edited title",
        message: "Edited message",
        speakerNotesDraft: "Edited notes",
        outline: [outlineItem("Base bullet")],
        // Client echoes back read-only fields unchanged.
        contentBlocks: [chartBlock]
      })
    ]);

    const result = mergeEditedDeck(base, edited);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const merged = result.slideDeck.slides[0]!;
    expect(merged.title).toBe("Edited title");
    expect(merged.message).toBe("Edited message");
    expect(merged.speakerNotesDraft).toBe("Edited notes");
    // Read-only block + non-editable fields are taken from base verbatim.
    expect(merged.contentBlocks).toEqual([chartBlock]);
    expect(merged.type).toBe("content");
    expect(merged.layout).toBe("title-bullets");
    expect(merged.sourceTrace).toEqual(["section-1"]);
    // Deck-level title/subtitle preserved from base (I2: not editable this batch).
    expect(result.slideDeck.title).toBe("Deck title");
    expect(result.slideDeck.subtitle).toBe("Deck subtitle");
  });

  it("rejects tampering with a retained slide's read-only contentBlocks", () => {
    const base = deck([slide({ id: "s1", contentBlocks: [chartBlock] })]);
    const tampered: ContentBlock = { ...chartBlock, chartIntentId: "chart-INJECTED" };
    const edited = deck([slide({ id: "s1", contentBlocks: [tampered] })]);

    const result = mergeEditedDeck(base, edited);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejection).toBe("INVALID_EDIT");
  });

  it("rejects tampering with a retained slide's non-editable fields (type/layout/layoutIntent)", () => {
    const base = deck([slide({ id: "s1" })]);
    const edited = deck([slide({ id: "s1", type: "metrics" })]);
    expect(mergeEditedDeck(base, edited).ok).toBe(false);

    const edited2 = deck([slide({ id: "s1", layout: "cover" })]);
    expect(mergeEditedDeck(base, edited2).ok).toBe(false);

    const edited3 = deck([
      slide({ id: "s1", layoutIntent: { ...LAYOUT_INTENT, density: "high" } })
    ]);
    expect(mergeEditedDeck(base, edited3).ok).toBe(false);
  });

  it("adds a pure-text new slide with server defaults and empty sourceTrace", () => {
    const base = deck([slide({ id: "s1" })]);
    const edited = deck([
      slide({ id: "s1" }),
      slide({
        id: "new-1",
        title: "Brand new",
        message: "Fresh",
        outline: [outlineItem("New bullet", ["should-be-cleared"])],
        contentBlocks: [],
        sourceTrace: ["client-claimed"]
      })
    ]);

    const result = mergeEditedDeck(base, edited);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const added = result.slideDeck.slides[1]!;
    expect(added.title).toBe("Brand new");
    expect(added.contentBlocks).toEqual([]);
    expect(added.sourceTrace).toEqual([]); // server default, client value not trusted
    expect(added.outline[0]!.sourceTrace).toEqual([]); // new bullet → no fabricated source
    expect(added.outline[0]!.emphasis).toBe("context"); // neutral default
    expect(added.type).toBe("content");
    expect(added.layoutIntent).toEqual(LAYOUT_INTENT);
  });

  it("rejects a new slide that smuggles in content blocks (chart injection)", () => {
    const base = deck([slide({ id: "s1" })]);
    const edited = deck([slide({ id: "s1" }), slide({ id: "new-1", contentBlocks: [chartBlock] })]);
    const result = mergeEditedDeck(base, edited);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejection).toBe("INVALID_EDIT");
  });

  it("reorders, drops and keeps slides by id following the edited order", () => {
    const base = deck([slide({ id: "s1" }), slide({ id: "s2" }), slide({ id: "s3" })]);
    // Drop s2, reorder s3 before s1.
    const edited = deck([slide({ id: "s3" }), slide({ id: "s1" })]);
    const result = mergeEditedDeck(base, edited);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slideDeck.slides.map((s) => s.id)).toEqual(["s3", "s1"]);
  });

  it("preserves sourceTrace/emphasis for unchanged bullets, clears them for rewritten/new ones", () => {
    const base = deck([
      slide({
        id: "s1",
        outline: [
          outlineItem("Kept bullet", ["fact-keep"]),
          outlineItem("Will rewrite", ["fact-old"])
        ]
      })
    ]);
    const edited = deck([
      slide({
        id: "s1",
        outline: [
          outlineItem("Kept bullet", ["client-ignored"]), // text unchanged → reuse base trace
          outlineItem("Rewritten now", ["client-ignored"]) // text changed → cleared
        ]
      })
    ]);

    const result = mergeEditedDeck(base, edited);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const o = result.slideDeck.slides[0]!.outline;
    expect(o[0]).toEqual({ text: "Kept bullet", sourceTrace: ["fact-keep"], emphasis: "evidence" });
    expect(o[1]).toEqual({ text: "Rewritten now", sourceTrace: [], emphasis: "context" });
  });

  it("maps duplicate bullet text FIFO against the base pool", () => {
    const base = deck([
      slide({
        id: "s1",
        outline: [outlineItem("dup", ["trace-A"]), outlineItem("dup", ["trace-B"])]
      })
    ]);
    const edited = deck([
      slide({
        id: "s1",
        outline: [outlineItem("dup", []), outlineItem("dup", []), outlineItem("dup", [])]
      })
    ]);
    const result = mergeEditedDeck(base, edited);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const traces = result.slideDeck.slides[0]!.outline.map((o) => o.sourceTrace);
    // First two consume the FIFO pool; the third is a "new" duplicate → cleared.
    expect(traces).toEqual([["trace-A"], ["trace-B"], []]);
  });
});

/**
 * 015 US3 (FR-015/FR-016): outline ids and textStyleOverrides ride the SAME merge.
 * Two independent tracks (R1): the bullet `id` is taken from the edited deck
 * verbatim (the binding key the client backfilled); sourceTrace/emphasis still come
 * from the text-FIFO fidelity match against base — a rewritten bullet keeps its id
 * but loses its trace.
 */
describe("mergeEditedDeck outline ids + text style overrides (015 US3)", () => {
  function bullet(id: string, text: string, trace: string[] = []): SlideOutlineItem {
    return { id, text, sourceTrace: trace, emphasis: "evidence" };
  }

  it("keeps edited ids while restoring trace by text (base has no ids)", () => {
    const base = deck([
      slide({
        id: "s1",
        outline: [outlineItem("Kept bullet", ["fact-keep"]), outlineItem("Will rewrite", ["x"])]
      })
    ]);
    const edited = deck([
      slide({
        id: "s1",
        outline: [bullet("b1", "Kept bullet"), bullet("b2", "Rewritten now")]
      })
    ]);

    const result = mergeEditedDeck(base, edited);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const o = result.slideDeck.slides[0]!.outline;
    // id track: edited is authoritative. trace track: text-FIFO against base.
    expect(o[0]).toEqual({
      id: "b1",
      text: "Kept bullet",
      sourceTrace: ["fact-keep"],
      emphasis: "evidence"
    });
    expect(o[1]).toEqual({ id: "b2", text: "Rewritten now", sourceTrace: [], emphasis: "context" });
  });

  it("keeps duplicate-text bullets' distinct ids intact", () => {
    const base = deck([slide({ id: "s1", outline: [outlineItem("dup", ["trace-A"])] })]);
    const edited = deck([slide({ id: "s1", outline: [bullet("b1", "dup"), bullet("b2", "dup")] })]);
    const result = mergeEditedDeck(base, edited);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slideDeck.slides[0]!.outline.map((o) => o.id)).toEqual(["b1", "b2"]);
  });

  it("whitelists textStyleOverrides on a retained slide", () => {
    const base = deck([slide({ id: "s1", outline: [outlineItem("Base bullet")] })]);
    const edited = deck([
      slide({
        id: "s1",
        outline: [bullet("b1", "Base bullet")],
        textStyleOverrides: {
          title: { sizeLevel: "XL", colorToken: "accent" },
          outlineById: { b1: { colorToken: "muted" } }
        }
      })
    ]);
    const result = mergeEditedDeck(base, edited);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slideDeck.slides[0]!.textStyleOverrides).toEqual({
      title: { sizeLevel: "XL", colorToken: "accent" },
      outlineById: { b1: { colorToken: "muted" } }
    });
  });

  it("normalizes away default-only entries and orphaned outline keys", () => {
    const base = deck([slide({ id: "s1", outline: [outlineItem("Base bullet")] })]);
    const edited = deck([
      slide({
        id: "s1",
        outline: [bullet("b1", "Base bullet")],
        textStyleOverrides: {
          title: { sizeLevel: "M" }, // default-only → stripped
          message: {}, // empty → stripped
          outlineById: {
            b1: { sizeLevel: "L" },
            ghost: { sizeLevel: "XL" } // no such bullet id → orphan, dropped
          }
        }
      })
    ]);
    const result = mergeEditedDeck(base, edited);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slideDeck.slides[0]!.textStyleOverrides).toEqual({
      outlineById: { b1: { sizeLevel: "L" } }
    });
  });

  it("omits textStyleOverrides entirely when everything normalizes away", () => {
    const base = deck([slide({ id: "s1" })]);
    const edited = deck([
      slide({
        id: "s1",
        outline: [outlineItem("Base bullet")],
        textStyleOverrides: { title: { sizeLevel: "M" }, outlineById: {} }
      })
    ]);
    const result = mergeEditedDeck(base, edited);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slideDeck.slides[0]!.textStyleOverrides).toBeUndefined();
  });

  it("does not resurrect base overrides after a full reset (edited carries none)", () => {
    const base = deck([
      slide({
        id: "s1",
        outline: [outlineItem("Base bullet")],
        textStyleOverrides: { title: { sizeLevel: "XL" } } // persisted by an earlier save
      })
    ]);
    const edited = deck([slide({ id: "s1", outline: [outlineItem("Base bullet")] })]);
    const result = mergeEditedDeck(base, edited);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slideDeck.slides[0]!.textStyleOverrides).toBeUndefined();
  });

  it("keeps the read-only wall intact (overrides are NOT a tamper)", () => {
    const base = deck([slide({ id: "s1", contentBlocks: [chartBlock] })]);
    // textStyleOverrides + ids are editable; contentBlocks tampering still rejects.
    const styledOk = deck([
      slide({
        id: "s1",
        contentBlocks: [chartBlock],
        textStyleOverrides: { title: { colorToken: "accent" } }
      })
    ]);
    expect(mergeEditedDeck(base, styledOk).ok).toBe(true);

    const tampered = deck([
      slide({
        id: "s1",
        contentBlocks: [{ ...chartBlock, chartIntentId: "chart-INJECTED" }],
        textStyleOverrides: { title: { colorToken: "accent" } }
      })
    ]);
    expect(mergeEditedDeck(base, tampered).ok).toBe(false);
  });

  it("carries ids and normalized overrides on a NEW slide too", () => {
    const base = deck([slide({ id: "s1" })]);
    const edited = deck([
      slide({ id: "s1" }),
      slide({
        id: "new-1",
        outline: [bullet("nb1", "New bullet")],
        contentBlocks: [],
        textStyleOverrides: {
          message: { sizeLevel: "S" },
          outlineById: { nb1: { colorToken: "accent" }, ghost: { sizeLevel: "XL" } }
        }
      })
    ]);
    const result = mergeEditedDeck(base, edited);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const added = result.slideDeck.slides[1]!;
    expect(added.outline[0]!.id).toBe("nb1");
    expect(added.textStyleOverrides).toEqual({
      message: { sizeLevel: "S" },
      outlineById: { nb1: { colorToken: "accent" } }
    });
  });
});

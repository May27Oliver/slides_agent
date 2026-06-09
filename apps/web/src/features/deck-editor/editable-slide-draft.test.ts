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
    outline: [{ text: "b1", sourceTrace: ["t"], emphasis: "evidence" }],
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
    const d = draftOf([slide("s1")]).addBullet("s1").addBullet("s1", 0);
    expect(d.slide("s1")!.outline.map((o) => o.text)).toEqual(["", "b1", ""]);

    const removed = d.removeBullet("s1", 1);
    expect(removed.slide("s1")!.outline.length).toBe(2);

    const moved = draftOf([slide("s1", { outline: [
      { text: "a", sourceTrace: [], emphasis: "context" },
      { text: "b", sourceTrace: [], emphasis: "context" }
    ] })]).moveBullet("s1", 0, 1);
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
  });
});

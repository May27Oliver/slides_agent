import { describe, expect, it } from "vitest";
import type { SlideDeck } from "@slides-agent/domain";
import {
  type DeckDraft,
  classifyDraft,
  clearDraft,
  loadDraft,
  saveDraft
} from "@/features/deck-editor/deck-draft-storage";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    }
  } as Storage;
}

const draft = (over: Partial<DeckDraft> = {}): DeckDraft => ({
  deckId: "d1",
  baseRevision: 2,
  slideDeck: { slides: [] } as unknown as SlideDeck,
  savedAt: "2026-06-09T10:00:00.000Z",
  ...over
});

describe("deck-draft-storage (010 US3)", () => {
  it("round-trips a draft and clears it (keyed by deckId)", () => {
    const storage = memoryStorage();
    saveDraft(draft(), storage);
    expect(loadDraft("d1", storage)?.baseRevision).toBe(2);
    clearDraft("d1", storage);
    expect(loadDraft("d1", storage)).toBeNull();
  });

  it("degrades silently when storage is unavailable", () => {
    expect(() => saveDraft(draft(), null)).not.toThrow();
    expect(loadDraft("d1", null)).toBeNull();
  });

  it("classifies restorable when same base and newer than current", () => {
    expect(
      classifyDraft(draft({ baseRevision: 2, savedAt: "2026-06-09T10:00:00.000Z" }), {
        revision: 2,
        createdAt: "2026-06-09T09:00:00.000Z"
      })
    ).toBe("restorable");
  });

  it("classifies conflict when the base differs from current", () => {
    expect(
      classifyDraft(draft({ baseRevision: 1 }), { revision: 3, createdAt: "2026-06-09T09:00:00.000Z" })
    ).toBe("conflict");
  });

  it("classifies none when older than current or absent", () => {
    expect(
      classifyDraft(draft({ baseRevision: 2, savedAt: "2026-06-09T08:00:00.000Z" }), {
        revision: 2,
        createdAt: "2026-06-09T09:00:00.000Z"
      })
    ).toBe("none");
    expect(classifyDraft(null, { revision: 1, createdAt: "x" })).toBe("none");
  });
});

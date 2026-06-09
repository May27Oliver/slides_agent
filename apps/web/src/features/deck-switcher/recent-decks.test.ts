import { describe, expect, it } from "vitest";
import type { DeckSummaryContract } from "@slides-agent/contracts";
import {
  RECENT_DECKS_LIMIT,
  filterDecksByTitle,
  recentDecks,
  switcherDecks
} from "@/features/deck-switcher/recent-decks";

function deck(id: string, title: string, updatedAt: string): DeckSummaryContract {
  return { id, title, status: "ready", updatedAt };
}

const decks: DeckSummaryContract[] = Array.from({ length: 12 }, (_, i) =>
  deck(`d${i}`, i === 3 ? "Quarterly Review" : `Deck ${i}`, `2026-06-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`)
);

describe("recent-decks (010 US2)", () => {
  it("RECENT_DECKS_LIMIT defaults to 8", () => {
    expect(RECENT_DECKS_LIMIT).toBe(8);
  });

  it("recentDecks returns the newest N, newest first", () => {
    const recent = recentDecks(decks);
    expect(recent.length).toBe(8);
    expect(recent[0]!.id).toBe("d11"); // 2026-06-12 is newest
    expect(recent[7]!.id).toBe("d4");
  });

  it("filterDecksByTitle matches case-insensitively across the full set", () => {
    expect(filterDecksByTitle(decks, "quarterly").map((d) => d.id)).toEqual(["d3"]);
    expect(filterDecksByTitle(decks, "  ").length).toBe(12); // blank → all
  });

  it("switcherDecks shows recent N without a query and full matches with one", () => {
    expect(switcherDecks(decks, "").length).toBe(8);
    // "Quarterly Review" (d3) is older than the recent-8 window but still findable.
    expect(switcherDecks(decks, "quarterly").map((d) => d.id)).toEqual(["d3"]);
  });
});

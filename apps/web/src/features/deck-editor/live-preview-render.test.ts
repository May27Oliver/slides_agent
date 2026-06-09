import { describe, expect, it } from "vitest";
import { applyDeckEdit } from "@slides-agent/domain";
import type { DeckRevision, SlideDeck } from "@slides-agent/domain";
import { renderLivePreview } from "@/features/deck-editor/live-preview-render";
import { EditableSlideDraft } from "@/features/deck-editor/editable-slide-draft";
import { fixtureRevision, fixtureSlideDeck } from "@/features/deck-editor/test-fixtures";

describe("renderLivePreview (010 US1, FR-005a parity)", () => {
  it("imports + runs the domain renderer in the browser env (T002 smoke)", () => {
    const result = renderLivePreview(fixtureRevision, fixtureSlideDeck);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain("<!doctype html>");
  });

  it("is byte-identical to what the server would store (same applyDeckEdit)", () => {
    const working = EditableSlideDraft.fromRevision(1, fixtureSlideDeck)
      .setTitle("slide_001", "Edited preview title")
      .toRequest().slideDeck as SlideDeck;

    const client = renderLivePreview(fixtureRevision, working);
    // The server runs the identical use-case on the identical inputs.
    const server = applyDeckEdit(fixtureRevision as unknown as DeckRevision, working);

    expect(client.ok).toBe(true);
    expect(server.ok).toBe(true);
    if (!client.ok || !server.ok) return;
    expect(client.html).toBe(server.payload.html);
    expect(client.html).toContain("Edited preview title");
  });

  it("degrades softly (ok=false) on a rejected edit instead of throwing", () => {
    const empty: SlideDeck = { ...fixtureSlideDeck, slides: [] };
    const result = renderLivePreview(fixtureRevision, empty);
    expect(result.ok).toBe(false);
  });
});

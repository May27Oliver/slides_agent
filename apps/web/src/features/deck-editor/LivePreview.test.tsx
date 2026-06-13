// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { SlideDeck } from "@slides-agent/domain";
import { LivePreview } from "@/features/deck-editor/LivePreview";
import { fixtureRevision, fixtureSlideDeck } from "@/features/deck-editor/test-fixtures";

afterEach(cleanup);

const srcdocOf = () =>
  (screen.getByTitle("即時預覽") as HTMLIFrameElement).getAttribute("srcdoc");

/**
 * 015 US4 (FR-012): the deck renders into a FIXED 16:9 stage that is scaled to fit,
 * so the whole slide shows at true proportions — and the frame is full-bleed (no
 * rounded corners), matching the PPTX export.
 */
describe("LivePreview 16:9 scaled stage (015 US4)", () => {
  it("renders the iframe inside a fixed 1920x1080 stage, centered with overflow clipped", () => {
    render(
      <LivePreview deckId="d1" base={fixtureRevision} workingDeck={fixtureSlideDeck} selectedIndex={0} />
    );

    const stage = screen.getByTestId("preview-stage");
    const iframe = screen.getByTitle("即時預覽") as HTMLIFrameElement;
    expect(stage.contains(iframe)).toBe(true);
    expect(stage.style.width).toBe("1920px");
    expect(stage.style.height).toBe("1080px");
    expect(stage.style.transform).toContain("scale(");

    const viewport = stage.parentElement!;
    expect(viewport.className).toContain("items-center");
    expect(viewport.className).toContain("overflow-hidden");
    expect(iframe.className).not.toContain("rounded");
  });
});

/**
 * 016 (FR-001/FR-006): editing within the same frame does NOT change `srcDoc` (no iframe
 * reload — edits stream as postMessage patches); a re-theme DOES change `srcDoc` (global
 * CSS needs a reload). srcDoc stability is the observable proxy for "no full reload".
 */
describe("LivePreview frameKey reload-vs-patch (016)", () => {
  function editedTitle(title: string): SlideDeck {
    return {
      ...fixtureSlideDeck,
      slides: fixtureSlideDeck.slides.map((s, i) => (i === 0 ? { ...s, title } : s))
    };
  }

  it("keeps srcDoc unchanged when only the deck content is edited (same frameKey)", () => {
    const { rerender } = render(
      <LivePreview
        deckId="d1"
        base={fixtureRevision}
        workingDeck={fixtureSlideDeck}
        selectedIndex={0}
        debounceMs={0}
      />
    );
    const before = srcdocOf();
    expect(before).toBeTruthy();

    act(() => {
      rerender(
        <LivePreview
          deckId="d1"
          base={fixtureRevision}
          workingDeck={editedTitle("Edited in place")}
          selectedIndex={0}
          debounceMs={0}
        />
      );
    });
    // No reload: the document handed to the iframe is the same (edit goes via patch).
    expect(srcdocOf()).toBe(before);
  });

  it("changes srcDoc (reload) when the theme axis changes", () => {
    const { rerender } = render(
      <LivePreview
        deckId="d1"
        base={fixtureRevision}
        workingDeck={fixtureSlideDeck}
        selectedIndex={0}
        debounceMs={0}
      />
    );
    const before = srcdocOf();

    act(() => {
      rerender(
        <LivePreview
          deckId="d1"
          base={fixtureRevision}
          workingDeck={fixtureSlideDeck}
          selectedIndex={0}
          themeSelection={{ paletteId: "palette-99" }}
          debounceMs={0}
        />
      );
    });
    expect(srcdocOf()).not.toBe(before);
  });
});

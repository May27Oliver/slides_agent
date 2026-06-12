// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LivePreview } from "@/features/deck-editor/LivePreview";
import { fixtureRevision, fixtureSlideDeck } from "@/features/deck-editor/test-fixtures";

afterEach(cleanup);

/**
 * 015 US4 (FR-012): the preview iframe sits inside a 16:9 letterbox container, so the
 * deck (100vw×100vh inside the iframe) keeps the real slide aspect instead of being
 * stretched to whatever shape the editor column happens to have.
 */
describe("LivePreview 16:9 letterbox (015 US4)", () => {
  it("wraps the iframe in a centered 16:9-constrained box", () => {
    render(
      <LivePreview base={fixtureRevision} workingDeck={fixtureSlideDeck} selectedIndex={0} />
    );

    const letterbox = screen.getByTestId("preview-letterbox");
    const iframe = screen.getByTitle("即時預覽");
    expect(letterbox.contains(iframe)).toBe(true);

    // The box is constrained to 16:9 by the paired max-width/max-height calcs
    // (container-query units), with the parent centering the leftover space.
    expect(letterbox.className).toContain("16/9");
    expect(letterbox.className).toContain("9/16");
    const parent = letterbox.parentElement!;
    expect(parent.className).toContain("items-center");
    expect(parent.className).toContain("justify-center");
  });
});

// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LivePreview } from "@/features/deck-editor/LivePreview";
import { fixtureRevision, fixtureSlideDeck } from "@/features/deck-editor/test-fixtures";

afterEach(cleanup);

/**
 * 015 US4 (FR-012): the deck renders into a FIXED 16:9 stage that is scaled to fit,
 * so the whole slide shows at true proportions — and the frame is full-bleed (no
 * rounded corners), matching the PPTX export.
 */
describe("LivePreview 16:9 scaled stage (015 US4)", () => {
  it("renders the iframe inside a fixed 1280x720 stage, centered with overflow clipped", () => {
    render(<LivePreview base={fixtureRevision} workingDeck={fixtureSlideDeck} selectedIndex={0} />);

    const stage = screen.getByTestId("preview-stage");
    const iframe = screen.getByTitle("即時預覽") as HTMLIFrameElement;
    expect(stage.contains(iframe)).toBe(true);

    // The stage is the true presentation size; a scale() transform fits it to the box.
    expect(stage.style.width).toBe("1280px");
    expect(stage.style.height).toBe("720px");
    expect(stage.style.transform).toContain("scale(");

    // The viewport that clips/centers the scaled stage.
    const viewport = stage.parentElement!;
    expect(viewport.className).toContain("items-center");
    expect(viewport.className).toContain("justify-center");
    expect(viewport.className).toContain("overflow-hidden");

    // Full-bleed: a real slide has no rounded frame (the PPTX export is square too).
    expect(iframe.className).not.toContain("rounded");
  });
});

// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { buildDeckRuntimeScript } from "@/rendering/deck-runtime-script";

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

function slide(id: string, label: string): string {
  return `<section class="slide" data-slide-id="${id}"><h2 class="slide-title anim" style="--d:1">${label}</h2></section>`;
}

/** Mounts a minimal deck document and runs the runtime IIFE against it. */
function mountDeck(sections: string[]): void {
  document.body.innerHTML = `
    <main class="deck">
      <div class="progress" id="progress"></div>
      <div class="sidedots" id="sidedots"></div>
      ${sections.join("\n")}
      <div class="controls"><button id="prevBtn"></button><button id="nextBtn"></button></div>
    </main>`;
  // The runtime is an IIFE string; executing it wires up the live document.
  new Function(buildDeckRuntimeScript())();
}

function patch(message: { slidesHtml: string; index: number; fontsHref?: string | null }): void {
  // source MUST be window.parent (=== window in jsdom top) — the runtime now strictly
  // rejects messages whose source is not its direct parent (deep-review M1).
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { type: "deck:patchSlides", ...message },
      source: window
    })
  );
}

/**
 * 016 (FR-001/002/003/004/009): the runtime swaps the slide sections in place on a
 * deck:patchSlides message — no document reload — keeping the current index, rebuilding
 * dots, suppressing entrance animation, and managing the override-fonts link.
 */
describe("deck runtime deck:patchSlides (016)", () => {
  it("replaces slide sections in place, keeping progress/sidedots/controls", () => {
    mountDeck([slide("a", "A"), slide("b", "B")]);
    patch({ slidesHtml: [slide("x", "X"), slide("y", "Y"), slide("z", "Z")].join("\n"), index: 2 });

    const sections = Array.from(document.querySelectorAll(".slide"));
    expect(sections.map((s) => s.getAttribute("data-slide-id"))).toEqual(["x", "y", "z"]);
    // chrome elements survive the swap.
    expect(document.querySelector(".controls")).not.toBeNull();
    expect(document.getElementById("sidedots")).not.toBeNull();
    // active slide follows the requested index; dots rebuilt to the new count.
    expect(sections[2]!.classList.contains("active")).toBe(true);
    expect(document.querySelectorAll("#sidedots button").length).toBe(3);
  });

  it("clamps the index when the new slide set is shorter", () => {
    mountDeck([slide("a", "A"), slide("b", "B"), slide("c", "C")]);
    patch({ slidesHtml: slide("only", "Only"), index: 2 });
    const sections = Array.from(document.querySelectorAll(".slide"));
    expect(sections.length).toBe(1);
    expect(sections[0]!.classList.contains("active")).toBe(true);
  });

  it("adds .deck-static to suppress entrance-animation replay", () => {
    mountDeck([slide("a", "A")]);
    patch({ slidesHtml: slide("a", "A2"), index: 0 });
    expect(document.querySelector(".deck")!.classList.contains("deck-static")).toBe(true);
  });

  it("creates / updates / removes the override-fonts link by href (no churn on same href)", () => {
    mountDeck([slide("a", "A")]);
    const href = "https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap";
    patch({ slidesHtml: slide("a", "A"), index: 0, fontsHref: href });
    const link = document.getElementById("override-fonts") as HTMLLinkElement;
    expect(link?.getAttribute("href")).toBe(href);

    // Same href again → same node, not replaced (no re-fetch).
    patch({ slidesHtml: slide("a", "A"), index: 0, fontsHref: href });
    expect(document.getElementById("override-fonts")).toBe(link);

    // null → removed.
    patch({ slidesHtml: slide("a", "A"), index: 0, fontsHref: null });
    expect(document.getElementById("override-fonts")).toBeNull();
  });
});

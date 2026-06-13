import { chromium } from "playwright";
import type {
  SlideScreenshotter,
  SlideScreenshotterOptions
} from "@/modules/pptx-export-jobs/slide-screenshotter.port";

/**
 * 015 US2 (research R2): the real headless-chromium adapter. Loads the revision's
 * self-contained html, walks every `section[data-slide-id]` via the deck runtime's
 * own `deck:goToSlide` postMessage channel, and screenshots each slide once the
 * entrance animations settle. One browser per export — exports are single-flight
 * per account and capped at 60 pages, so a persistent browser pool is not worth
 * its complexity here.
 */
export class PlaywrightSlideScreenshotter implements SlideScreenshotter {
  async capture(html: string, options: SlideScreenshotterOptions): Promise<Buffer[]> {
    // --no-sandbox: required inside the docker worker (no user namespaces).
    const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    try {
      const page = await browser.newPage({
        viewport: { width: options.width, height: options.height }
      });
      await page.setContent(html, { waitUntil: "load" });
      // Web fonts change line wraps — wait for them before measuring anything.
      await page.evaluate(() => (document as { fonts?: { ready: Promise<unknown> } }).fonts?.ready);

      // Freeze entrance + chart animations to their FINAL state before any shot. Charts
      // draw over ~1–2.2s (line 1.25s, pie slices up to ~2.2s); a short per-slide settle
      // would otherwise capture a half-drawn line / partial donut. The deck's own
      // `.deck-static` rule sets `animation:none!important`, and a chart's non-animated
      // base state IS its completed state (stroke-dashoffset:0), so this yields settled,
      // timing-independent screenshots (FR-004 visual parity).
      await page.evaluate(() => {
        document.querySelector(".deck")?.classList.add("deck-static");
      });

      const slideCount = await page.locator("section[data-slide-id]").count();
      const shots: Buffer[] = [];
      for (let index = 0; index < slideCount; index += 1) {
        await page.evaluate((slideIndex) => {
          window.postMessage({ type: "deck:goToSlide", index: slideIndex }, "*");
        }, index);
        // Correctness over timing: wait for THIS slide's finite animations to actually
        // finish (entrance + chart draw/sweep — pie slices run up to ~2.2s). The looping
        // background gradient (iterations:Infinity) never finishes, so exclude it.
        // deck-static normally neutralises these (→ resolves instantly); this is the
        // build-/timing-independent guarantee that no half-drawn chart is captured.
        await page.evaluate(async (capMs) => {
          // Let the slide-change apply and any (delayed) animations register first.
          await new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(() => r(undefined)))
          );
          const all = (document as { getAnimations?: () => Animation[] }).getAnimations?.() ?? [];
          const finite = all.filter((a) => a.effect?.getComputedTiming().iterations !== Infinity);
          const settle = Promise.all(finite.map((a) => a.finished.catch(() => undefined)));
          const cap = new Promise((resolve) => setTimeout(resolve, capMs));
          await Promise.race([settle, cap]); // never hang past the cap
        }, options.settleMs * 6);
        await page.waitForTimeout(options.settleMs);
        shots.push(await page.screenshot({ type: "png" }));
      }
      return shots;
    } finally {
      await browser.close();
    }
  }
}

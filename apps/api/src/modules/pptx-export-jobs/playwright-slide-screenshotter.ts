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

      const slideCount = await page.locator("section[data-slide-id]").count();
      const shots: Buffer[] = [];
      for (let index = 0; index < slideCount; index += 1) {
        await page.evaluate((slideIndex) => {
          window.postMessage({ type: "deck:goToSlide", index: slideIndex }, "*");
        }, index);
        await page.waitForTimeout(options.settleMs);
        shots.push(await page.screenshot({ type: "png" }));
      }
      return shots;
    } finally {
      await browser.close();
    }
  }
}

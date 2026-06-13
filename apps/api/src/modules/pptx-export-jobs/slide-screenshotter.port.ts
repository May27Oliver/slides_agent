/**
 * 015 US2: the headless-rendering capability the export execution depends on —
 * given a self-contained deck html, return one PNG per slide at the requested
 * viewport. The Playwright adapter implements it; unit tests fake it so the
 * execution's state flow and cleanup are testable without a real browser.
 */
export interface SlideScreenshotterOptions {
  width: number;
  height: number;
  /** Per-slide settle delay (entrance animations) before the shot. */
  settleMs: number;
}

export interface SlideScreenshotter {
  capture(html: string, options: SlideScreenshotterOptions): Promise<Buffer[]>;
}

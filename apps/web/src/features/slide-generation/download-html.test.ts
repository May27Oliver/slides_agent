import { describe, expect, it } from "vitest";
import { buildHtmlDownload } from "@/features/slide-generation/download-html";

describe("HTML download helper", () => {
  it("builds a self-contained HTML data URL without backend references", () => {
    const download = buildHtmlDownload("<!doctype html><html><body>slides</body></html>");

    expect(download.filename).toMatch(/^preview-slides-\d{8}-\d{6}\.html$/u);
    expect(download.href).toContain("data:text/html;charset=utf-8,");
    expect(download.href).toContain("%3C!doctype%20html%3E");
    expect(download.href).not.toContain("/api/");
  });

  it("encodes a local timestamp into the filename", () => {
    const download = buildHtmlDownload("<html></html>", { now: new Date(2026, 5, 3, 14, 32, 5) });

    expect(download.filename).toBe("preview-slides-20260603-143205.html");
  });

  // 015 US1 (FR-001): editor download names the file after the deck + revision.
  it("names the file <sanitized-title>-rev<N>-<timestamp>.html when deckTitle/revision given", () => {
    const download = buildHtmlDownload("<html></html>", {
      deckTitle: "Q3 營收報告",
      revision: 7,
      now: new Date(2026, 5, 13, 9, 5, 1)
    });

    expect(download.filename).toBe("Q3-營收報告-rev7-20260613-090501.html");
  });

  it("sanitizes illegal filename characters and collapses whitespace in the title", () => {
    const download = buildHtmlDownload("<html></html>", {
      deckTitle: ' a/b\\c:d*e?f"g<h>i|j   k ',
      revision: 12,
      now: new Date(2026, 0, 2, 3, 4, 5)
    });

    expect(download.filename).toBe("a-b-c-d-e-f-g-h-i-j-k-rev12-20260102-030405.html");
  });

  it("falls back to 'deck' when the sanitized title is empty", () => {
    const download = buildHtmlDownload("<html></html>", {
      deckTitle: "///",
      revision: 3,
      now: new Date(2026, 0, 2, 3, 4, 5)
    });

    expect(download.filename).toBe("deck-rev3-20260102-030405.html");
  });
});

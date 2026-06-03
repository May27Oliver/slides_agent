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
    const download = buildHtmlDownload("<html></html>", new Date(2026, 5, 3, 14, 32, 5));

    expect(download.filename).toBe("preview-slides-20260603-143205.html");
  });
});

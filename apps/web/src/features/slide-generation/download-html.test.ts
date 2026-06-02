import { describe, expect, it } from "vitest";
import { buildHtmlDownload } from "@/features/slide-generation/download-html";

describe("HTML download helper", () => {
  it("builds a self-contained HTML data URL without backend references", () => {
    const download = buildHtmlDownload("<!doctype html><html><body>slides</body></html>");

    expect(download.filename).toBe("preview-slides.html");
    expect(download.href).toContain("data:text/html;charset=utf-8,");
    expect(download.href).toContain("%3C!doctype%20html%3E");
    expect(download.href).not.toContain("/api/");
  });
});

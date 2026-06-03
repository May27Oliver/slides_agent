import { describe, expect, it } from "vitest";
import { validateGeneratedHtml } from "@/rendering/html-generation-validator";
import { renderingDeck, renderingDesignPlanningResult, validHtml } from "./rendering-fixtures";

describe("HTML generation validator", () => {
  it("passes semantically faithful HTML despite entity, quote, and whitespace differences", () => {
    const tolerantHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>:root { --accent: #0f766e; }</style>
</head>
<body>
  <main class="deck">
    <section class="slide pattern-metric-comparison" data-slide-id='slide_001' data-pattern='metric-comparison'>
      <h1>目標: conversion and response time</h1>
      <p class="message">目標</p>
      <ul>
        <li>Onboarding&nbsp;conversion 從 18% 提升到 25%</li>
      </ul>
    </section>
  </main>
  <script>
    document.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") {}
      if (event.key === "ArrowLeft") {}
    });
  </script>
</body>
</html>`;

    const validation = validateGeneratedHtml({
      html: tolerantHtml,
      deck: renderingDeck,
      designPlanningResult: renderingDesignPlanningResult
    });

    expect(validation.status).toBe("pass");
    expect(validation.contentFidelityPreserved).toBe(true);
    expect(validation.designCompliancePreserved).toBe(true);
    expect(validation.contentIssues).toEqual([]);
    expect(validation.designIssues).toEqual([]);
  });

  it("accepts inline SVG namespaces and internal anchors as self-contained", () => {
    const svgRichHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>:root { --accent: #0f766e; } .icon { fill: var(--accent); }</style>
</head>
<body>
  <main class="deck">
    <nav><a href="#slide_001">Go to slide</a></nav>
    <section class="slide pattern-metric-comparison" data-slide-id="slide_001" data-pattern="metric-comparison">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="icon" aria-hidden="true">
        <use href="#bar-icon" />
        <path d="M3 3h18v18H3z" />
      </svg>
      <h1>目標: conversion and response time</h1>
      <p class="message">目標</p>
      <ul>
        <li>Onboarding conversion 從 18% 提升到 25%</li>
        <li>客服首次回覆時間從 12 小時降到 4 小時</li>
      </ul>
      <img src="data:image/svg+xml;base64,PHN2Zy8+" alt="inline" />
    </section>
  </main>
  <script>
    // navigation handler // keep keyboard support
    document.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") {}
      if (event.key === "ArrowLeft") {}
    });
  </script>
</body>
</html>`;

    const validation = validateGeneratedHtml({
      html: svgRichHtml,
      deck: renderingDeck,
      designPlanningResult: renderingDesignPlanningResult
    });

    expect(validation.externalResourceIssues).toEqual([]);
    expect(validation.selfContained).toBe(true);
    expect(validation.status).toBe("pass");
  });

  it("allows curated Google Fonts links while still blocking other external resources", () => {
    const fontHtml = validHtml.replace(
      "<style>",
      [
        '<link rel="preconnect" href="https://fonts.googleapis.com">',
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
        '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap" rel="stylesheet">',
        "<style>"
      ].join("\n")
    );

    const validation = validateGeneratedHtml({
      html: fontHtml,
      deck: renderingDeck,
      designPlanningResult: renderingDesignPlanningResult
    });

    expect(validation.externalResourceIssues).toEqual([]);
    expect(validation.selfContained).toBe(true);
    expect(validation.status).toBe("pass");

    const withForeignCdn = fontHtml.replace(
      "<style>",
      '<link rel="stylesheet" href="https://cdn.example.com/deck.css"><style>'
    );
    const cdnValidation = validateGeneratedHtml({
      html: withForeignCdn,
      deck: renderingDeck,
      designPlanningResult: renderingDesignPlanningResult
    });
    expect(cdnValidation.selfContained).toBe(false);
    expect(cdnValidation.externalResourceIssues).toContain("External resource reference found.");
  });

  it("blocks active-content schemes and look-alike font hosts", () => {
    const cases = [
      validHtml.replace("<style>", '<script src="data:text/javascript,alert(1)"></script><style>'),
      validHtml.replace("<h1>", '<a href="javascript:alert(1)">x</a><h1>'),
      validHtml.replace(
        "<style>",
        '<link href="https://fonts.googleapis.com.evil.com/x" rel="stylesheet"><style>'
      ),
      validHtml.replace(
        "<style>",
        '<link href="https://evilfonts.googleapis.com/x" rel="stylesheet"><style>'
      )
    ];

    for (const html of cases) {
      const validation = validateGeneratedHtml({
        html,
        deck: renderingDeck,
        designPlanningResult: renderingDesignPlanningResult
      });
      expect(validation.selfContained).toBe(false);
      expect(validation.externalResourceIssues).toContain("External resource reference found.");
    }
  });

  it("rejects unsafe resources, reordered or drifted content, design drift, and rendered speaker notes", () => {
    const invalidHtml = validHtml
      .replace("<style>", '<link rel="stylesheet" href="https://cdn.example.com/deck.css"><style>')
      .replace('data-slide-id="slide_001"', 'data-slide-id="slide_999"')
      .replace("目標: conversion and response time", "Invented title")
      .replace('data-pattern="metric-comparison"', 'data-pattern="unrelated-editorial"')
      .replace("</section>", `${renderingDeck.slides[0]?.speakerNotesDraft}</section>`);

    const validation = validateGeneratedHtml({
      html: invalidHtml,
      deck: renderingDeck,
      designPlanningResult: renderingDesignPlanningResult
    });

    expect(validation.status).toBe("repair_required");
    expect(validation.selfContained).toBe(false);
    expect(validation.slideCountAndOrderPreserved).toBe(false);
    expect(validation.contentFidelityPreserved).toBe(false);
    expect(validation.designCompliancePreserved).toBe(false);
    expect(validation.speakerNotesHidden).toBe(false);
    expect(validation.externalResourceIssues).toContain("External resource reference found.");
    expect(validation.contentIssues).toContain("Missing slide title in HTML: slide_001");
    expect(validation.designIssues).toContain(
      "Missing design pattern assignment in HTML: slide_001 -> metric-comparison"
    );
  });
});

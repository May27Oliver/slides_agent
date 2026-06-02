import { expect, test } from "@playwright/test";

test("generated preview route supports keyboard navigation inside the HTML deck", async ({
  page
}) => {
  await page.route("**/api/slides/preview", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(previewResponse())
    });
  });

  await page.goto("/");
  await page.getByLabel("原始內容").fill("Onboarding conversion 從 18% 提升到 25%");
  await page.getByLabel("簡報用途").fill("PM planning review");
  await page.getByLabel("目標受眾").fill("Product and engineering leads");
  await page.getByLabel("風格方向").fill("高密度 PM planning deck");
  await page.getByRole("button", { name: "生成簡報" }).click();

  const frame = page.frameLocator('iframe[title="生成的 HTML 簡報"]');
  await expect(frame.getByText("Slide One")).toBeVisible();
  await frame.locator("body").press("ArrowRight");
  await expect(frame.getByText("Slide Two")).toBeVisible();
  await frame.locator("body").press("ArrowLeft");
  await expect(frame.getByText("Slide One")).toBeVisible();
});

function previewResponse() {
  return {
    slideDeck: {
      title: "PM planning review",
      slides: [
        {
          id: "slide_001",
          title: "Slide One",
          message: "First message"
        },
        {
          id: "slide_002",
          title: "Slide Two",
          message: "Second message"
        }
      ],
      reviewReport: {
        assumptions: [],
        omittedOrCompressedContent: [],
        uncertainClaims: [],
        chartingDecisions: [],
        humanReviewNotes: []
      }
    },
    designPlanningResult: {
      designSystem: {
        themeName: "test",
        visualDensity: "medium",
        chartStyle: "minimal"
      },
      slidePatternAssignments: [
        {
          slideId: "slide_001",
          primaryPattern: "title-summary"
        }
      ],
      consistencyValidation: {
        ok: true,
        checkedSlideIds: ["slide_001", "slide_002"],
        issues: [],
        fallbackUsed: false
      }
    },
    previewArtifact: {
      html: keyboardNavigableHtml(),
      htmlGenerationValidation: {
        status: "pass",
        selfContained: true,
        slideCountAndOrderPreserved: true,
        contentFidelityPreserved: true,
        designCompliancePreserved: true,
        speakerNotesHidden: true,
        keyboardNavigationPresent: true,
        externalResourceIssues: [],
        contentIssues: [],
        designIssues: [],
        repairAttempted: false,
        fallbackUsed: false
      },
      generationSummary: {
        slideCount: 2,
        sourceFactCount: 1,
        chartIntentCount: 0,
        uncertainClaimCount: 0
      }
    }
  };
}

function keyboardNavigableHtml() {
  return `<!doctype html>
<html>
  <body tabindex="0">
    <main>
      <section class="slide">Slide One</section>
      <section class="slide" hidden>Slide Two</section>
    </main>
    <script>
      const slides = Array.from(document.querySelectorAll(".slide"));
      let index = 0;
      function render() {
        slides.forEach((slide, slideIndex) => {
          slide.hidden = slideIndex !== index;
        });
      }
      document.addEventListener("keydown", (event) => {
        if (event.key === "ArrowRight" || event.key === "PageDown") {
          index = Math.min(index + 1, slides.length - 1);
          render();
        }
        if (event.key === "ArrowLeft" || event.key === "PageUp") {
          index = Math.max(index - 1, 0);
          render();
        }
      });
    </script>
  </body>
</html>`;
}

import { describe, expect, it } from "vitest";
import slideGenerationSchema from "../schemas/slide-generation.schema.json";

describe("slide generation schema", () => {
  it("requires HTML-generation-consumable design planning output and rejects unconsumed request/design fields", () => {
    const responseDefinition = slideGenerationSchema.$defs.GeneratePreviewResponse;
    const deckBriefDefinition = slideGenerationSchema.$defs.DeckBrief;
    const designSystemDefinition = slideGenerationSchema.$defs.DesignSystem;
    const designReviewNotesDefinition = slideGenerationSchema.$defs.DesignReviewNotes;
    const designConsistencyValidationDefinition =
      slideGenerationSchema.$defs.DesignConsistencyValidation;
    const slideDeckDefinition = slideGenerationSchema.$defs.SlideDeck;
    const previewArtifactDefinition = slideGenerationSchema.$defs.PreviewArtifact;

    expect(responseDefinition.required).toEqual(
      expect.arrayContaining(["slideDeck", "designPlanningResult", "previewArtifact"])
    );
    expect(responseDefinition.properties.designPlanningResult).toEqual({
      $ref: "#/$defs/DesignPlanningResult"
    });
    expect(slideDeckDefinition.required).not.toContain("designSystem");
    expect(slideDeckDefinition.properties).not.toHaveProperty("designSystem");
    expect(previewArtifactDefinition.required).toEqual(
      expect.arrayContaining(["html", "htmlGenerationValidation", "generationSummary"])
    );
    expect(designReviewNotesDefinition.required).toContain("htmlGenerationConstraints");
    expect(designReviewNotesDefinition.required).toContain("styleDirectionInterpretation");
    expect(designReviewNotesDefinition.required).toContain("manualVerificationNotes");
    expect(designReviewNotesDefinition.properties).not.toHaveProperty("styleInterpretation");
    expect(designReviewNotesDefinition.properties).not.toHaveProperty("consistencyConcerns");
    expect(designReviewNotesDefinition.properties).not.toHaveProperty("manualVerificationNeeds");
    expect(designConsistencyValidationDefinition.required).toEqual(
      expect.arrayContaining(["ok", "checkedSlideIds", "issues", "fallbackUsed"])
    );
    expect(designConsistencyValidationDefinition.properties).not.toHaveProperty("status");
    expect(designConsistencyValidationDefinition.properties).not.toHaveProperty(
      "checkedDimensions"
    );
    expect(designConsistencyValidationDefinition.properties).not.toHaveProperty("fallbackApplied");
    expect(designReviewNotesDefinition.properties).not.toHaveProperty("rendererConstraints");
    expect(deckBriefDefinition.properties).not.toHaveProperty("tone");
    expect(designSystemDefinition.properties).not.toHaveProperty("uiUxProMaxNotes");
  });

  it("requires HTML generation validation evidence and rejects provider/model disclosure fields", () => {
    const responseDefinition = slideGenerationSchema.$defs.GeneratePreviewResponse;
    const previewArtifactDefinition = slideGenerationSchema.$defs.PreviewArtifact;
    const htmlGenerationValidationDefinition = slideGenerationSchema.$defs.HtmlGenerationValidation;

    expect(responseDefinition.properties).not.toHaveProperty("llmProvider");
    expect(responseDefinition.properties).not.toHaveProperty("llmModel");
    expect(responseDefinition.properties).not.toHaveProperty("htmlGenerationProvider");
    expect(responseDefinition.properties).not.toHaveProperty("htmlGenerationModel");
    expect(previewArtifactDefinition.properties).not.toHaveProperty("llmProvider");
    expect(previewArtifactDefinition.properties).not.toHaveProperty("llmModel");
    expect(htmlGenerationValidationDefinition.properties).not.toHaveProperty("provider");
    expect(htmlGenerationValidationDefinition.properties).not.toHaveProperty("model");
    expect(htmlGenerationValidationDefinition.additionalProperties).toBe(false);
    expect(htmlGenerationValidationDefinition.required).toEqual(
      expect.arrayContaining([
        "status",
        "selfContained",
        "slideCountAndOrderPreserved",
        "contentFidelityPreserved",
        "designCompliancePreserved",
        "speakerNotesHidden",
        "keyboardNavigationPresent",
        "externalResourceIssues",
        "contentIssues",
        "designIssues",
        "repairAttempted",
        "fallbackUsed"
      ])
    );
  });

  it("exposes 009 readonly result evidence (selectedTheme tokens + renderedCharts) in the generation summary", () => {
    const summary = slideGenerationSchema.$defs.GenerationSummary;

    // selectedTheme: nested ids + projected style-kit tokens (007/009).
    expect(summary.properties).toHaveProperty("selectedTheme");
    expect(summary.properties.selectedTheme.properties.ids.properties).toEqual(
      expect.objectContaining({
        style: expect.anything(),
        palette: expect.anything(),
        font: expect.anything()
      })
    );
    expect(summary.properties.selectedTheme.properties).toEqual(
      expect.objectContaining({
        kitName: expect.anything(),
        accentHues: expect.anything(),
        fonts: expect.anything(),
        structureFeatures: expect.anything()
      })
    );

    // renderedCharts: per-chart evidence with the shared ChartVisualKind enum.
    expect(summary.properties).toHaveProperty("renderedCharts");
    expect(summary.properties.renderedCharts.type).toBe("array");
    expect(summary.properties.renderedCharts.items.properties.visualKind.enum).toEqual([
      "pie_donut",
      "line",
      "bar",
      "metric_card",
      "metric_group",
      "table",
      "fallback_text"
    ]);
    expect(summary.properties.renderedCharts.items.properties).toEqual(
      expect.objectContaining({
        slideId: expect.anything(),
        chartIntentId: expect.anything(),
        fallback: expect.anything(),
        notes: expect.anything()
      })
    );

    // 009 no-drift: both result-evidence fields are REQUIRED (not just present),
    // so a schema-valid response can never omit what web code treats as present.
    expect(summary.required).toEqual(expect.arrayContaining(["renderedCharts", "selectedTheme"]));

    // structureFeatures: radiusPx + shadow are always projected → required.
    expect(summary.properties.selectedTheme.properties.structureFeatures.required).toEqual(
      expect.arrayContaining(["radiusPx", "shadow"])
    );

    // note codes are the closed 008 vocabulary, not an arbitrary string.
    expect(
      summary.properties.renderedCharts.items.properties.notes.items.properties.code.enum
    ).toEqual([
      "series_extracted",
      "series_insufficient",
      "unit_mismatch",
      "invalid_pie_total",
      "time_sort_failed",
      "table_truncated",
      "fallback_used",
      "value_parse_uncertain"
    ]);
  });

  it("rejects a generation summary missing renderedCharts or selectedTheme (negative)", () => {
    const summary = slideGenerationSchema.$defs.GenerationSummary;
    // The required list is the contract that makes the omission invalid; assert the
    // negative explicitly so a future relaxation of `required` fails this test.
    expect(summary.required).toContain("renderedCharts");
    expect(summary.required).toContain("selectedTheme");
    expect(summary.additionalProperties).toBe(false);
  });

  it("requires reviewable slide planning fields and does not expose final speakerNotes", () => {
    const slideDefinition = slideGenerationSchema.$defs.Slide;

    expect(slideDefinition.required).toEqual(
      expect.arrayContaining(["slideKind", "outline", "layoutIntent", "speakerNotesDraft"])
    );
    expect(slideDefinition.properties).toEqual(
      expect.objectContaining({
        slideKind: expect.objectContaining({
          enum: ["opening", "content", "closing"]
        }),
        outline: expect.objectContaining({
          minItems: 1
        }),
        layoutIntent: expect.objectContaining({
          $ref: "#/$defs/LayoutIntent"
        }),
        speakerNotesDraft: expect.objectContaining({
          type: "string",
          maxLength: 400
        })
      })
    );
    expect(slideDefinition.properties).not.toHaveProperty("speakerNotes");
  });
});

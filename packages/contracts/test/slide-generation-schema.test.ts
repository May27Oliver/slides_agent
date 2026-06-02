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

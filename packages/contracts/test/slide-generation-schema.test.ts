import { describe, expect, it } from "vitest";
import slideGenerationSchema from "../schemas/slide-generation.schema.json";

describe("slide generation schema", () => {
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

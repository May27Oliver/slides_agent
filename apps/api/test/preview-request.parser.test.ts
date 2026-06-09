import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import {
  assertValidJobId,
  parseGeneratePreviewRequest
} from "@/modules/preview-jobs/preview-request.parser";

const validRequest = {
  sourceContent: "Onboarding conversion improved from 18% to 25%.",
  deckBrief: { purpose: "PM planning review", audience: "Product leads" }
};

describe("parseGeneratePreviewRequest", () => {
  it("returns the validated contract for a valid request", () => {
    expect(parseGeneratePreviewRequest(validRequest)).toEqual(validRequest);
  });

  it("throws a 400 with the native validator code for missing fields", () => {
    expect(() => parseGeneratePreviewRequest({ deckBrief: {} })).toThrow(BadRequestException);
    try {
      parseGeneratePreviewRequest({ deckBrief: {} });
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: "INVALID_INPUT" });
    }
  });

  it("throws a 400 with UNSUPPORTED_OPTION for backend-owned / unknown fields", () => {
    try {
      parseGeneratePreviewRequest({
        ...validRequest,
        deckBrief: { ...validRequest.deckBrief, tone: "friendly" }
      });
      throw new Error("expected rejection");
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: "UNSUPPORTED_OPTION",
        fields: ["deckBrief.tone"]
      });
    }
  });

  it("passes a valid 011 themeSelection through", () => {
    expect(
      parseGeneratePreviewRequest({ ...validRequest, themeSelection: { paletteId: "palette-10" } })
    ).toEqual({ ...validRequest, themeSelection: { paletteId: "palette-10" } });
  });

  it("rejects a malformed themeSelection with INVALID_INPUT", () => {
    try {
      parseGeneratePreviewRequest({ ...validRequest, themeSelection: { fontId: 5 } });
      throw new Error("expected rejection");
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: "INVALID_INPUT",
        fields: ["themeSelection.fontId"]
      });
    }
  });
});

describe("assertValidJobId", () => {
  it("accepts a well-formed id (including an unknown-but-valid one)", () => {
    expect(assertValidJobId("preview_job_abc123")).toBe("preview_job_abc123");
    expect(assertValidJobId("missing")).toBe("missing");
  });

  it("rejects empty, overlong, or unsafe ids", () => {
    expect(() => assertValidJobId("")).toThrow(BadRequestException);
    expect(() => assertValidJobId("a".repeat(129))).toThrow(BadRequestException);
    expect(() => assertValidJobId("../etc/passwd")).toThrow(BadRequestException);
    expect(() => assertValidJobId("a b")).toThrow(BadRequestException);
  });
});

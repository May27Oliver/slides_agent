import { describe, expect, it } from "vitest";
import {
  validateEditRevisionRequest,
  type InvalidEditContract,
  type RevisionConflictContract
} from "@/deck";

describe("edit revision contract (010 US1)", () => {
  it("accepts a well-formed { baseRevision, slideDeck } body", () => {
    const result = validateEditRevisionRequest({
      baseRevision: 2,
      slideDeck: { id: "d", slides: [{ id: "s1" }] }
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a missing or non-integer baseRevision", () => {
    expect(validateEditRevisionRequest({ slideDeck: { slides: [] } }).ok).toBe(false);
    expect(validateEditRevisionRequest({ baseRevision: 1.5, slideDeck: { slides: [] } }).ok).toBe(
      false
    );
    expect(validateEditRevisionRequest({ baseRevision: -1, slideDeck: { slides: [] } }).ok).toBe(
      false
    );
  });

  it("rejects a slideDeck without a slides array", () => {
    expect(validateEditRevisionRequest({ baseRevision: 1, slideDeck: {} }).ok).toBe(false);
    expect(validateEditRevisionRequest({ baseRevision: 1, slideDeck: null }).ok).toBe(false);
    expect(validateEditRevisionRequest("nope").ok).toBe(false);
  });

  it("rejects a slide missing a string id (would corrupt the stored deck)", () => {
    const result = validateEditRevisionRequest({
      baseRevision: 1,
      slideDeck: { slides: [{ title: "no id" }] }
    });
    expect(result.ok).toBe(false);
  });

  it("rejects oversized text fields (storage/CPU abuse guard)", () => {
    const huge = "x".repeat(5000);
    const result = validateEditRevisionRequest({
      baseRevision: 1,
      slideDeck: { slides: [{ id: "s1", title: huge }] }
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.includes("title too long"))).toBe(true);
  });

  it("uses the repo's top-level error shape (not a nested { error })", () => {
    // Type-level assertion: error contracts are flat { code, message, ... }.
    const conflict: RevisionConflictContract = {
      code: "REVISION_CONFLICT",
      message: "stale",
      currentRevision: 4
    };
    const invalid: InvalidEditContract = {
      code: "INVALID_EDIT",
      message: "bad",
      fields: ["slideDeck"]
    };
    expect(conflict.code).toBe("REVISION_CONFLICT");
    expect(conflict.currentRevision).toBe(4);
    expect(invalid.code).toBe("INVALID_EDIT");
    expect(invalid.fields).toEqual(["slideDeck"]);
  });
});

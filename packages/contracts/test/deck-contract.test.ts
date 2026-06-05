import { describe, expect, it } from "vitest";
import { validateDeckDetailResponse, validateDeckListResponse } from "../src";
import type { DeckDetailResponseContract, DeckListResponseContract } from "../src";

describe("deck contracts", () => {
  it("accepts an empty and a populated deck list", () => {
    const empty: DeckListResponseContract = { decks: [] };
    expect(validateDeckListResponse(empty)).toEqual({ ok: true, value: empty });

    const populated: DeckListResponseContract = {
      decks: [
        { id: "f3c-uuid", title: "Q2 業務回顧", status: "ready", updatedAt: "2026-06-05T08:12:00.000Z" }
      ]
    };
    expect(validateDeckListResponse(populated)).toEqual({ ok: true, value: populated });
  });

  it("rejects a list whose entries miss required fields", () => {
    const result = validateDeckListResponse({ decks: [{ id: "x", title: "t" }] });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-array decks payload", () => {
    expect(validateDeckListResponse({ decks: "nope" }).ok).toBe(false);
    expect(validateDeckListResponse(null).ok).toBe(false);
  });

  it("accepts a deck detail with a current revision", () => {
    const detail: DeckDetailResponseContract = {
      id: "f3c-uuid",
      title: "Q2 業務回顧",
      status: "ready",
      sourceContent: "raw source",
      deckBrief: { purpose: "p", audience: "a" },
      currentRevision: {
        revision: 1,
        slideDeck: { slides: [] },
        designPlan: null,
        html: "<!doctype html>",
        generationSummary: null,
        origin: "generation",
        sourceJobId: "preview_job_1",
        createdAt: "2026-06-05T08:12:00.000Z"
      }
    };
    expect(validateDeckDetailResponse(detail)).toEqual({ ok: true, value: detail });
  });

  it("accepts a deck detail with a null current revision", () => {
    const detail: DeckDetailResponseContract = {
      id: "f3c-uuid",
      title: "Untitled",
      status: "failed",
      sourceContent: "",
      deckBrief: {},
      currentRevision: null
    };
    expect(validateDeckDetailResponse(detail)).toEqual({ ok: true, value: detail });
  });

  it("rejects a deck detail with an invalid revision and missing fields", () => {
    expect(
      validateDeckDetailResponse({
        id: "x",
        title: "t",
        status: "ready",
        sourceContent: "s",
        deckBrief: {},
        currentRevision: { revision: "1", origin: "bogus" }
      }).ok
    ).toBe(false);
    expect(validateDeckDetailResponse({ id: 1 }).ok).toBe(false);
  });
});

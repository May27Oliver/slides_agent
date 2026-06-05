import { describe, expect, it, vi } from "vitest";
import { DeckRequestError, getDeck, listDecks } from "@/features/decks/decks-client";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

const detail = {
  id: "11111111-2222-3333-4444-555555555555",
  title: "Q2 Review",
  status: "ready",
  sourceContent: "raw",
  deckBrief: { purpose: "p", audience: "a" },
  currentRevision: {
    revision: 1,
    slideDeck: {},
    designPlan: null,
    html: "<html></html>",
    generationSummary: null,
    origin: "generation",
    sourceJobId: "job_1",
    createdAt: "2026-06-05T00:00:00.000Z"
  }
};

describe("decks-client", () => {
  it("listDecks requests /api/decks and returns the validated list", async () => {
    const body = {
      decks: [{ id: "d1", title: "One", status: "ready", updatedAt: "2026-06-05T00:00:00.000Z" }]
    };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(body));

    const result = await listDecks(fetchImpl);

    expect(result).toEqual(body);
    expect(fetchImpl.mock.calls[0]![0]).toBe("/api/decks");
  });

  it("getDeck requests the encoded id and returns the validated detail", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(detail));

    const result = await getDeck(detail.id, fetchImpl);

    expect(result).toEqual(detail);
    expect(fetchImpl.mock.calls[0]![0]).toBe(`/api/decks/${detail.id}`);
  });

  it("throws DeckRequestError on a non-ok response (e.g. 404)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: "DECK_NOT_FOUND" }, false, 404));
    await expect(getDeck("x", fetchImpl)).rejects.toBeInstanceOf(DeckRequestError);
  });

  it("propagates an authFetch error (401 handled upstream) without swallowing it", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("Session expired"));
    await expect(listDecks(fetchImpl)).rejects.toThrow("Session expired");
  });
});

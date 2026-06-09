import { describe, expect, it, vi } from "vitest";
import {
  EditConflictError,
  EditInvalidError,
  EditNotFoundError,
  EditRequestError,
  createEditRevision
} from "@/features/deck-editor/deck-editor-client";

function res(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as unknown as Response;
}

const req = { baseRevision: 1, slideDeck: { slides: [] } };

describe("createEditRevision (010 US1)", () => {
  it("POSTs the body and returns the new revision on 201", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) =>
      res(201, { revision: 2, origin: "edit" })
    );
    const result = await createEditRevision("deck-1", req, fetchImpl as unknown as typeof fetch);

    expect(result.revision).toBe(2);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("/api/decks/deck-1/revisions");
    expect(init!.method).toBe("POST");
    expect(JSON.parse(init!.body as string)).toEqual(req);
  });

  it("maps 409 → EditConflictError carrying currentRevision", async () => {
    const fetchImpl = vi.fn(async () =>
      res(409, { code: "REVISION_CONFLICT", currentRevision: 7 })
    );
    await expect(
      createEditRevision("d", req, fetchImpl as unknown as typeof fetch)
    ).rejects.toMatchObject({ currentRevision: 7 });
    await expect(
      createEditRevision("d", req, fetchImpl as unknown as typeof fetch)
    ).rejects.toBeInstanceOf(EditConflictError);
  });

  it("maps 400 → EditInvalidError with fields, 404 → EditNotFoundError, other → EditRequestError", async () => {
    await expect(
      createEditRevision("d", req, (async () =>
        res(400, { code: "INVALID_EDIT", fields: ["slideDeck"] })) as unknown as typeof fetch)
    ).rejects.toBeInstanceOf(EditInvalidError);

    await expect(
      createEditRevision("d", req, (async () =>
        res(404, { code: "DECK_NOT_FOUND" })) as unknown as typeof fetch)
    ).rejects.toBeInstanceOf(EditNotFoundError);

    await expect(
      createEditRevision("d", req, (async () => res(500, null)) as unknown as typeof fetch)
    ).rejects.toBeInstanceOf(EditRequestError);
  });
});

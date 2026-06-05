import { describe, expect, it } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { DeckDetail, DeckStore, DeckSummary } from "@slides-agent/domain";
import { DecksController } from "@/modules/decks/decks.controller";
import { JwtAuthGuard } from "@/modules/auth/jwt-auth.guard";

const VALID_UUID = "11111111-2222-3333-4444-555555555555";

function makeStore(overrides: Partial<DeckStore> = {}): DeckStore {
  return {
    saveNewDeck: async () => ({ deckId: "x" }),
    listByAccount: async () => [],
    findByIdForAccount: async () => null,
    ...overrides
  };
}

const reqFor = (id: string) => ({ user: { id, username: "u", displayName: "U", expiresAt: "z" } });

describe("DecksController", () => {
  it("is protected by JwtAuthGuard", () => {
    const guards = Reflect.getMetadata("__guards__", DecksController) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
  });

  it("lists only the requesting account's decks", async () => {
    const aDecks: DeckSummary[] = [
      { id: "d1", title: "One", status: "ready", updatedAt: "2026-06-05T00:00:00.000Z" }
    ];
    let seenAccount = "";
    const controller = new DecksController(
      makeStore({
        listByAccount: async (accountId) => {
          seenAccount = accountId;
          return aDecks;
        }
      })
    );

    const result = await controller.list(reqFor("user_a"));
    expect(seenAccount).toBe("user_a");
    expect(result).toEqual({ decks: aDecks });
  });

  it("returns the detail for a deck the account owns", async () => {
    const detail: DeckDetail = {
      id: VALID_UUID,
      title: "Owned",
      status: "ready",
      sourceContent: "s",
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
    const controller = new DecksController(
      makeStore({ findByIdForAccount: async () => detail })
    );

    expect(await controller.detail(VALID_UUID, reqFor("user_a"))).toEqual(detail);
  });

  it("returns DECK_NOT_FOUND for another account's (or unknown) deck", async () => {
    const controller = new DecksController(makeStore({ findByIdForAccount: async () => null }));

    await expect(controller.detail(VALID_UUID, reqFor("user_b"))).rejects.toMatchObject({
      response: { code: "DECK_NOT_FOUND" }
    });
    await expect(controller.detail(VALID_UUID, reqFor("user_b"))).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("rejects a malformed deck id with INVALID_DECK_ID", async () => {
    const controller = new DecksController(makeStore());

    await expect(controller.detail("not-a-uuid", reqFor("user_a"))).rejects.toMatchObject({
      response: { code: "INVALID_DECK_ID" }
    });
    await expect(controller.detail("not-a-uuid", reqFor("user_a"))).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("never queries another account's deck when the id is malformed", async () => {
    let queried = false;
    const controller = new DecksController(
      makeStore({
        findByIdForAccount: async () => {
          queried = true;
          return null;
        }
      })
    );

    await expect(controller.detail("../../etc", reqFor("user_a"))).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(queried).toBe(false);
  });
});

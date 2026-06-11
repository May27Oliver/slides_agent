import { describe, expect, it } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import type {
  AppendEditResult,
  DeckDetail,
  DeckStore,
  EditRevisionInput
} from "@slides-agent/domain";
import { DecksController } from "@/modules/decks/decks.controller";
import {
  renderableDesignPlan,
  renderableGenerationSummary,
  renderableSlideDeck
} from "./helpers/renderable-deck";

const VALID_UUID = "11111111-2222-3333-4444-555555555555";
const reqFor = (id: string) => ({ user: { id, username: "u", displayName: "U", expiresAt: "z" } });

function detailWith(
  revision: number,
  currentRevision: DeckDetail["currentRevision"] | null
): DeckDetail {
  return {
    id: VALID_UUID,
    title: "Owned",
    status: "ready",
    sourceContent: "s",
    deckBrief: { purpose: "p", audience: "a" },
    currentRevision: currentRevision === null ? null : { ...currentRevision, revision }
  };
}

const baseRevision: NonNullable<DeckDetail["currentRevision"]> = {
  revision: 1,
  slideDeck: renderableSlideDeck,
  designPlan: renderableDesignPlan,
  html: "<gen/>",
  generationSummary: renderableGenerationSummary,
  chartIntents: null,
  origin: "generation",
  sourceJobId: "job_1",
  createdAt: "2026-06-05T00:00:00.000Z"
};

function makeStore(overrides: Partial<DeckStore> = {}): DeckStore {
  return {
    saveNewDeck: async () => ({ deckId: "x" }),
    listByAccount: async () => [],
    findByIdForAccount: async () => detailWith(1, baseRevision),
    appendEditRevision: async (
      _a,
      _d,
      _b,
      payload: EditRevisionInput
    ): Promise<AppendEditResult> => ({
      ok: true,
      revision: { ...payload, revision: 2, createdAt: "2026-06-06T00:00:00.000Z" }
    }),
    ...overrides
  };
}

/** A legal edit of the base deck: a single title change, structure echoed back. */
function editedBody(baseRev: number) {
  const deck = renderableSlideDeck as { slides: Array<Record<string, unknown>> };
  return {
    baseRevision: baseRev,
    slideDeck: {
      ...(renderableSlideDeck as Record<string, unknown>),
      slides: deck.slides.map((s) => ({ ...s, title: "Edited title" }))
    }
  };
}

describe("DecksController.createRevision (010 US1)", () => {
  it("applies a valid edit → 201 with revision = base+1", async () => {
    let appended: EditRevisionInput | null = null;
    const controller = new DecksController(
      makeStore({
        appendEditRevision: async (_a, _d, _b, payload) => {
          appended = payload;
          return {
            ok: true,
            revision: { ...payload, revision: 2, createdAt: "2026-06-06T00:00:00.000Z" }
          };
        }
      })
    );

    const result = await controller.createRevision(VALID_UUID, editedBody(1), reqFor("user_a"));
    expect(result.revision).toBe(2);
    expect(result.origin).toBe("edit");
    expect(appended).not.toBeNull();
    expect((result.slideDeck as { slides: Array<{ title: string }> }).slides[0]!.title).toBe(
      "Edited title"
    );
  });

  it("returns 400 INVALID_EDIT for a missing baseRevision", async () => {
    const controller = new DecksController(makeStore());
    await expect(
      controller.createRevision(VALID_UUID, { slideDeck: { slides: [] } }, reqFor("user_a"))
    ).rejects.toMatchObject({ response: { code: "INVALID_EDIT" } });
    await expect(
      controller.createRevision(VALID_UUID, { slideDeck: { slides: [] } }, reqFor("user_a"))
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns 404 DECK_NOT_FOUND for another account's deck", async () => {
    const controller = new DecksController(makeStore({ findByIdForAccount: async () => null }));
    await expect(
      controller.createRevision(VALID_UUID, editedBody(1), reqFor("user_b"))
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns 409 REVISION_CONFLICT when the base is stale", async () => {
    const controller = new DecksController(makeStore());
    // currentRevision is 1; client edited from 0.
    await expect(
      controller.createRevision(VALID_UUID, editedBody(0), reqFor("user_a"))
    ).rejects.toMatchObject({ response: { code: "REVISION_CONFLICT", currentRevision: 1 } });
    await expect(
      controller.createRevision(VALID_UUID, editedBody(0), reqFor("user_a"))
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("returns 409 when the store reports a transactional conflict", async () => {
    const controller = new DecksController(
      makeStore({
        appendEditRevision: async () => ({ ok: false, conflict: true, currentRevision: 5 })
      })
    );
    await expect(
      controller.createRevision(VALID_UUID, editedBody(1), reqFor("user_a"))
    ).rejects.toMatchObject({ response: { code: "REVISION_CONFLICT", currentRevision: 5 } });
  });

  it("returns 400 INVALID_EDIT when the edit tampers with read-only structure", async () => {
    const controller = new DecksController(makeStore());
    const deck = renderableSlideDeck as { slides: Array<Record<string, unknown>> };
    const tampered = {
      baseRevision: 1,
      slideDeck: {
        ...(renderableSlideDeck as Record<string, unknown>),
        slides: deck.slides.map((s) => ({ ...s, type: "quote" }))
      }
    };
    await expect(
      controller.createRevision(VALID_UUID, tampered, reqFor("user_a"))
    ).rejects.toMatchObject({ response: { code: "INVALID_EDIT" } });
  });

  it("returns 400 INVALID_EDIT when the merged deck is empty", async () => {
    const controller = new DecksController(makeStore());
    const emptied = {
      baseRevision: 1,
      slideDeck: { ...(renderableSlideDeck as Record<string, unknown>), slides: [] }
    };
    await expect(
      controller.createRevision(VALID_UUID, emptied, reqFor("user_a"))
    ).rejects.toMatchObject({ response: { code: "INVALID_EDIT" } });
  });

  // 014: chartOperations passthrough + SC-007 adversarial matrix.
  describe("014 chartOperations", () => {
    const chartIntents = [
      {
        id: "chart_goal_metrics",
        title: "Goal metrics",
        sourceFacts: [
          {
            id: "fact_conversion",
            kind: "metric",
            value: "25%",
            sourceText: "Onboarding conversion 從 18% 提升到 25%"
          }
        ],
        recommendedVisuals: ["metric_card"],
        rationale: "headline"
      }
    ];
    const chartBase = { ...baseRevision, chartIntents: chartIntents as unknown };
    const storeWithChartBase = (overrides: Partial<DeckStore> = {}) =>
      makeStore({ findByIdForAccount: async () => detailWith(1, chartBase), ...overrides });

    const ADD_USER_CHART = {
      op: "add_chart",
      slideId: "slide_001",
      source: {
        kind: "user_data",
        title: "手動圖",
        visual: "bar",
        points: [
          { label: "A", valueText: "30", unit: "%" },
          { label: "B", valueText: "70", unit: "%" }
        ]
      }
    };

    it("passes chartOperations to applyDeckEdit; 201 carries userDataDisclosures", async () => {
      let appended: EditRevisionInput | null = null;
      const controller = new DecksController(
        storeWithChartBase({
          appendEditRevision: async (_a, _d, _b, payload) => {
            appended = payload;
            return {
              ok: true,
              revision: { ...payload, revision: 2, createdAt: "2026-06-06T00:00:00.000Z" }
            };
          }
        })
      );

      const result = await controller.createRevision(
        VALID_UUID,
        { ...editedBody(1), chartOperations: [ADD_USER_CHART] },
        reqFor("user_a")
      );
      expect(result.revision).toBe(2);
      const summary = result.generationSummary as {
        userDataDisclosures: Array<{ chartIntentId: string }>;
      };
      expect(summary.userDataDisclosures).toHaveLength(1);
      expect(summary.userDataDisclosures[0]!.chartIntentId).toBe("chart_user_r1_0");
      // The persisted payload carries the DERIVED intents (base + the user intent).
      const persistedIntents = appended!.chartIntents as Array<{ id: string }>;
      expect(persistedIntents.map((intent) => intent.id)).toEqual([
        "chart_goal_metrics",
        "chart_user_r1_0"
      ]);
    });

    it("SC-007: malformed/semantic-violating operations → 400 and ZERO new revision", async () => {
      const attempts: unknown[] = [
        "not-an-array",
        [{ op: "explode" }],
        [{ op: "set_visual", chartIntentId: "chart_goal_metrics", visual: "donut3d" }],
        [{ op: "edit_data", chartIntentId: "chart_goal_metrics", points: [{ kind: "user" }] }],
        // shape-valid but semantically invalid (unknown intent) → domain rejects.
        [{ op: "set_visual", chartIntentId: "nope", visual: "bar" }],
        // shape-valid but referencing a foreign fact → domain rejects.
        [
          {
            op: "edit_data",
            chartIntentId: "chart_goal_metrics",
            points: [{ kind: "original", sourceFactId: "fact_other" }]
          }
        ]
      ];

      for (const chartOperations of attempts) {
        let appendCalls = 0;
        const controller = new DecksController(
          storeWithChartBase({
            appendEditRevision: async (_a, _d, _b, payload) => {
              appendCalls += 1;
              return {
                ok: true,
                revision: { ...payload, revision: 2, createdAt: "2026-06-06T00:00:00.000Z" }
              };
            }
          })
        );
        await expect(
          controller.createRevision(
            VALID_UUID,
            { ...editedBody(1), chartOperations },
            reqFor("user_a")
          )
        ).rejects.toMatchObject({ response: { code: "INVALID_EDIT" } });
        expect(appendCalls).toBe(0);
      }
    });

    it("keeps 409 concurrency semantics when chartOperations are present", async () => {
      const controller = new DecksController(storeWithChartBase());
      await expect(
        controller.createRevision(
          VALID_UUID,
          { ...editedBody(0), chartOperations: [ADD_USER_CHART] },
          reqFor("user_a")
        )
      ).rejects.toMatchObject({ response: { code: "REVISION_CONFLICT", currentRevision: 1 } });
    });
  });
});

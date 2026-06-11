import { describe, expect, it } from "vitest";
import type { ChartIntent } from "@/content-core/chart-intent.types";
import type { ChartOperation } from "@/deck-edit/chart-operation.types";
import { applyChartOperations } from "@/deck-edit/apply-chart-operations";
import type { SlideDeck, SourceFact, Slide } from "@/deck/deck.types";
import type { ChartTreatmentPlan } from "@/design/design.types";

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

function slide(partial: Partial<Slide> & { id: string }): Slide {
  return {
    slideKind: "content",
    type: "content",
    title: `${partial.id} title`,
    message: `${partial.id} message`,
    outline: [],
    layout: "standard",
    layoutIntent: { priority: "message_first", density: "medium", emphasis: "narrative" },
    contentBlocks: [],
    sourceTrace: [],
    speakerNotesDraft: "",
    ...partial
  };
}

function baseDeck(): SlideDeck {
  return {
    id: "deck_1",
    title: "Demo deck",
    purpose: "test",
    audience: "test",
    slides: [
      slide({ id: "s_open", slideKind: "opening", layout: "cover" }),
      slide({
        id: "s_chart",
        contentBlocks: [
          { kind: "bullets", content: { items: ["a"] } },
          { kind: "chart_placeholder", content: {}, chartIntentId: "chart-0" }
        ]
      }),
      slide({ id: "s_plain", contentBlocks: [{ kind: "paragraph", content: { text: "x" } }] })
    ],
    reviewReport: {
      assumptions: [],
      omittedOrCompressedContent: [],
      uncertainClaims: [],
      chartingDecisions: [],
      humanReviewNotes: []
    }
  };
}

const FACT_A: SourceFact = {
  id: "fact_1",
  kind: "metric",
  value: "45%",
  sourceText: "產品A 占 45%"
};
const FACT_B: SourceFact = {
  id: "fact_2",
  kind: "metric",
  value: "55%",
  sourceText: "產品B 占 55%"
};

function baseIntents(): ChartIntent[] {
  return [
    {
      id: "chart-0",
      title: "市占比較",
      sourceFacts: [FACT_A, FACT_B],
      recommendedVisuals: ["comparison"],
      rationale: "share comparison"
    },
    {
      id: "chart-1",
      title: "未放置的圖",
      sourceFacts: [FACT_A, FACT_B],
      recommendedVisuals: ["comparison"],
      rationale: "unplaced"
    }
  ];
}

function basePlans(): ChartTreatmentPlan[] {
  return [
    { chartIntentId: "chart-0", treatment: "chart", labelingNotes: [], preservedContext: [] }
  ];
}

function run(operations: ChartOperation[], overrides?: { intents?: ChartIntent[] | null }) {
  return applyChartOperations({
    mergedDeck: baseDeck(),
    baseChartIntents: overrides && "intents" in overrides ? overrides.intents! : baseIntents(),
    baseTreatmentPlans: basePlans(),
    baseRevision: 3,
    operations
  });
}

function expectInvalid(
  operations: ChartOperation[],
  detailPart: string,
  intents?: ChartIntent[] | null
) {
  const result = run(operations, intents === undefined ? undefined : { intents });
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.rejection).toBe("INVALID_EDIT");
    expect(result.detail).toContain(detailPart);
  }
}

const USER_POINT = { label: "產品C", valueText: "12.5", unit: "%" };

// ---------------------------------------------------------------------------
// success effects
// ---------------------------------------------------------------------------

describe("applyChartOperations — success effects", () => {
  it("set_visual sets the override on the existing plan; auto removes it", () => {
    const set = run([{ op: "set_visual", chartIntentId: "chart-0", visual: "line" }]);
    expect(set.ok).toBe(true);
    if (set.ok) {
      const plan = set.treatmentPlans.find((p) => p.chartIntentId === "chart-0");
      expect(plan?.visualOverride).toBe("line");
      expect(plan?.treatment).toBe("chart");
    }

    const cleared = run([
      { op: "set_visual", chartIntentId: "chart-0", visual: "line" },
      { op: "set_visual", chartIntentId: "chart-0", visual: "auto" }
    ]);
    expect(cleared.ok).toBe(true);
    if (cleared.ok) {
      const plan = cleared.treatmentPlans.find((p) => p.chartIntentId === "chart-0");
      expect(plan && "visualOverride" in plan && plan.visualOverride !== undefined).toBe(false);
    }
  });

  it("set_visual creates a plan for an intent that has none", () => {
    const result = run([{ op: "set_visual", chartIntentId: "chart-1", visual: "bar" }]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const plan = result.treatmentPlans.find((p) => p.chartIntentId === "chart-1");
      expect(plan).toEqual({
        chartIntentId: "chart-1",
        treatment: "chart",
        visualOverride: "bar",
        labelingNotes: [],
        preservedContext: []
      });
    }
  });

  it("remove_chart removes only the placeholder; intent and plan survive", () => {
    const result = run([{ op: "remove_chart", slideId: "s_chart", chartIntentId: "chart-0" }]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const edited = result.slideDeck.slides.find((s) => s.id === "s_chart")!;
      expect(edited.contentBlocks.some((b) => b.kind === "chart_placeholder")).toBe(false);
      expect(edited.contentBlocks).toHaveLength(1);
      expect(result.chartIntents.some((i) => i.id === "chart-0")).toBe(true);
      expect(result.treatmentPlans.some((p) => p.chartIntentId === "chart-0")).toBe(true);
    }
  });

  it("add_chart(existing_intent) appends a placeholder to a chartless content slide", () => {
    const result = run([
      {
        op: "add_chart",
        slideId: "s_plain",
        source: { kind: "existing_intent", chartIntentId: "chart-1" }
      }
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const target = result.slideDeck.slides.find((s) => s.id === "s_plain")!;
      expect(target.contentBlocks.at(-1)).toEqual({
        kind: "chart_placeholder",
        content: {},
        chartIntentId: "chart-1"
      });
    }
  });

  it("add_chart(user_data) mints a deterministic intent with mirrored user facts", () => {
    const result = run([
      {
        op: "add_chart",
        slideId: "s_plain",
        source: {
          kind: "user_data",
          title: "新圖表",
          visual: "bar",
          points: [USER_POINT, { label: "產品D", valueText: "87.50", unit: null }]
        }
      }
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const intent = result.chartIntents.find((i) => i.id === "chart_user_r3_0")!;
      expect(intent.title).toBe("新圖表");
      expect(intent.recommendedVisuals).toEqual(["comparison"]);
      expect(intent.sourceFacts).toHaveLength(2);

      const [first, second] = intent.sourceFacts;
      expect(first).toEqual({
        id: "fact_user_r3_0_0",
        kind: "user_provided",
        value: "12.5%",
        sourceText: "使用者於編輯器輸入",
        metric: { label: "產品C", displayValue: "12.5%", numericValue: 12.5, unit: "%" }
      });
      // Precision preserved verbatim from valueText ("87.50", not "87.5").
      expect(second!.value).toBe("87.50");
      expect(second!.metric!.displayValue).toBe("87.50");
      expect(second!.metric!.numericValue).toBe(87.5);
      expect(second!.metric!.unit).toBeNull();

      const plan = result.treatmentPlans.find((p) => p.chartIntentId === "chart_user_r3_0")!;
      expect(plan.treatment).toBe("chart");
      expect(plan.visualOverride).toBe("bar");

      const target = result.slideDeck.slides.find((s) => s.id === "s_plain")!;
      expect(target.contentBlocks.at(-1)!.chartIntentId).toBe("chart_user_r3_0");
    }
  });

  it("edit_data keeps original facts verbatim, mints user facts, overwrites the title", () => {
    const result = run([
      {
        op: "edit_data",
        chartIntentId: "chart-0",
        title: "改過的標題",
        points: [
          { kind: "original", sourceFactId: "fact_2" },
          { kind: "user", point: USER_POINT, replacesFactId: "fact_1" }
        ]
      }
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const intent = result.chartIntents.find((i) => i.id === "chart-0")!;
      expect(intent.title).toBe("改過的標題");
      expect(intent.sourceFacts).toHaveLength(2);
      // Array order = display order; the original is byte-identical to base.
      expect(intent.sourceFacts[0]).toEqual(FACT_B);
      expect(intent.sourceFacts[1]).toEqual({
        id: "fact_user_r3_0_1",
        kind: "user_provided",
        value: "12.5%",
        sourceText: "使用者於編輯器輸入",
        metric: { label: "產品C", displayValue: "12.5%", numericValue: 12.5, unit: "%" },
        replacesFactId: "fact_1"
      });
      // Provenance honesty: the replaced base fact id is NOT reused.
      expect(intent.sourceFacts.some((f) => f.id === "fact_1")).toBe(false);
    }
  });

  it("does not mutate any input object (immutability)", () => {
    const deck = baseDeck();
    const intents = baseIntents();
    const plans = basePlans();
    const before = JSON.stringify({ deck, intents, plans });
    applyChartOperations({
      mergedDeck: deck,
      baseChartIntents: intents,
      baseTreatmentPlans: plans,
      baseRevision: 3,
      operations: [
        { op: "remove_chart", slideId: "s_chart", chartIntentId: "chart-0" },
        { op: "set_visual", chartIntentId: "chart-0", visual: "table" },
        {
          op: "edit_data",
          chartIntentId: "chart-0",
          points: [
            { kind: "original", sourceFactId: "fact_1" },
            { kind: "user", point: USER_POINT }
          ]
        }
      ]
    });
    expect(JSON.stringify({ deck, intents, plans })).toBe(before);
  });

  it("empty operations pass through unchanged", () => {
    const result = run([]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.slideDeck).toEqual(baseDeck());
      expect(result.chartIntents).toEqual(baseIntents());
      expect(result.treatmentPlans).toEqual(basePlans());
    }
  });
});

// ---------------------------------------------------------------------------
// validation matrix（每條 → INVALID_EDIT，detail 指明 op index）
// ---------------------------------------------------------------------------

describe("applyChartOperations — validation matrix", () => {
  it("legacy base (null chartIntents) with non-empty ops", () => {
    expectInvalid(
      [{ op: "set_visual", chartIntentId: "chart-0", visual: "bar" }],
      "chartIntents",
      null
    );
  });

  it("unknown slideId / chartIntentId", () => {
    expectInvalid(
      [{ op: "remove_chart", slideId: "nope", chartIntentId: "chart-0" }],
      "operations[0]"
    );
    expectInvalid([{ op: "set_visual", chartIntentId: "nope", visual: "bar" }], "operations[0]");
    expectInvalid(
      [
        {
          op: "add_chart",
          slideId: "s_plain",
          source: { kind: "existing_intent", chartIntentId: "nope" }
        }
      ],
      "operations[0]"
    );
    expectInvalid(
      [
        {
          op: "edit_data",
          chartIntentId: "nope",
          points: [{ kind: "original", sourceFactId: "fact_1" }]
        }
      ],
      "operations[0]"
    );
  });

  it("add_chart onto the opening slide", () => {
    expectInvalid(
      [
        {
          op: "add_chart",
          slideId: "s_open",
          source: { kind: "existing_intent", chartIntentId: "chart-1" }
        }
      ],
      "operations[0]"
    );
  });

  it("add_chart onto a slide that already has a chart (cap = 1)", () => {
    expectInvalid(
      [
        {
          op: "add_chart",
          slideId: "s_chart",
          source: { kind: "existing_intent", chartIntentId: "chart-1" }
        }
      ],
      "operations[0]"
    );
  });

  it("remove_chart when the slide has no such placeholder", () => {
    expectInvalid(
      [{ op: "remove_chart", slideId: "s_plain", chartIntentId: "chart-0" }],
      "operations[0]"
    );
    expectInvalid(
      [{ op: "remove_chart", slideId: "s_chart", chartIntentId: "chart-1" }],
      "operations[0]"
    );
  });

  it("edit_data original ref outside the intent's current facts, and duplicates", () => {
    expectInvalid(
      [
        {
          op: "edit_data",
          chartIntentId: "chart-0",
          points: [{ kind: "original", sourceFactId: "fact_999" }]
        }
      ],
      "operations[0]"
    );
    expectInvalid(
      [
        {
          op: "edit_data",
          chartIntentId: "chart-0",
          points: [
            { kind: "original", sourceFactId: "fact_1" },
            { kind: "original", sourceFactId: "fact_1" }
          ]
        }
      ],
      "operations[0]"
    );
  });

  it.each(["abc", "", "1/3", "Infinity", "1e5", "12."])(
    "rejects non-literal-number valueText %j",
    (valueText) => {
      expectInvalid(
        [
          {
            op: "edit_data",
            chartIntentId: "chart-0",
            points: [{ kind: "user", point: { label: "x", valueText, unit: null } }]
          }
        ],
        "operations[0]"
      );
    }
  );

  it("rejects blank labels and blank titles", () => {
    expectInvalid(
      [
        {
          op: "edit_data",
          chartIntentId: "chart-0",
          points: [{ kind: "user", point: { label: "   ", valueText: "1", unit: null } }]
        }
      ],
      "operations[0]"
    );
    expectInvalid(
      [
        {
          op: "edit_data",
          chartIntentId: "chart-0",
          title: "   ",
          points: [{ kind: "original", sourceFactId: "fact_1" }]
        }
      ],
      "operations[0]"
    );
    expectInvalid(
      [
        {
          op: "add_chart",
          slideId: "s_plain",
          source: { kind: "user_data", title: " ", visual: "bar", points: [USER_POINT] }
        }
      ],
      "operations[0]"
    );
  });

  it("rejects over-length label / unit / valueText / title", () => {
    const long = (n: number) => "x".repeat(n);
    expectInvalid(
      [
        {
          op: "edit_data",
          chartIntentId: "chart-0",
          points: [{ kind: "user", point: { label: long(121), valueText: "1", unit: null } }]
        }
      ],
      "operations[0]"
    );
    expectInvalid(
      [
        {
          op: "edit_data",
          chartIntentId: "chart-0",
          points: [{ kind: "user", point: { label: "x", valueText: "1", unit: long(17) } }]
        }
      ],
      "operations[0]"
    );
    expectInvalid(
      [
        {
          op: "edit_data",
          chartIntentId: "chart-0",
          points: [
            { kind: "user", point: { label: "x", valueText: `1.${"0".repeat(31)}`, unit: null } }
          ]
        }
      ],
      "operations[0]"
    );
    expectInvalid(
      [
        {
          op: "edit_data",
          chartIntentId: "chart-0",
          title: long(121),
          points: [{ kind: "original", sourceFactId: "fact_1" }]
        }
      ],
      "operations[0]"
    );
  });

  it("rejects more than 12 points and an empty point list", () => {
    const thirteen = Array.from({ length: 13 }, (_, i) => ({
      kind: "user" as const,
      point: { label: `p${i}`, valueText: `${i}`, unit: null }
    }));
    expectInvalid(
      [{ op: "edit_data", chartIntentId: "chart-0", points: thirteen }],
      "operations[0]"
    );
    expectInvalid([{ op: "edit_data", chartIntentId: "chart-0", points: [] }], "operations[0]");
  });

  it("rejects more than 50 operations", () => {
    const ops: ChartOperation[] = Array.from({ length: 51 }, () => ({
      op: "set_visual",
      chartIntentId: "chart-0",
      visual: "bar"
    }));
    expectInvalid(ops, "50");
  });

  it("points the detail at the failing op's index", () => {
    const result = run([
      { op: "set_visual", chartIntentId: "chart-0", visual: "bar" },
      { op: "set_visual", chartIntentId: "chart-1", visual: "line" },
      { op: "set_visual", chartIntentId: "nope", visual: "table" }
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.detail).toContain("operations[2]");
    }
  });

  it("zero partial application: an invalid third op voids the first two", () => {
    const result = run([
      { op: "remove_chart", slideId: "s_chart", chartIntentId: "chart-0" },
      { op: "set_visual", chartIntentId: "chart-0", visual: "bar" },
      { op: "set_visual", chartIntentId: "nope", visual: "table" }
    ]);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// determinism ＋ array-order semantics
// ---------------------------------------------------------------------------

describe("applyChartOperations — determinism & ordering", () => {
  const COMPOUND: ChartOperation[] = [
    {
      op: "add_chart",
      slideId: "s_plain",
      source: { kind: "user_data", title: "新圖", visual: "auto", points: [USER_POINT] }
    },
    {
      op: "edit_data",
      chartIntentId: "chart_user_r3_0",
      points: [
        { kind: "original", sourceFactId: "fact_user_r3_0_0" },
        { kind: "user", point: { label: "產品E", valueText: "30", unit: "%" } }
      ]
    }
  ];

  it("same input twice → byte-for-byte identical output", () => {
    const first = run(COMPOUND);
    const second = run(COMPOUND);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("minted ids match the deterministic scheme and never collide with base ids", () => {
    const result = run(COMPOUND);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const userIntent = result.chartIntents.find((i) => i.id.startsWith("chart_user_"))!;
      expect(userIntent.id).toMatch(/^chart_user_r\d+_\d+$/);
      const userFactIds = result.chartIntents
        .flatMap((i) => i.sourceFacts)
        .filter((f) => f.kind === "user_provided")
        .map((f) => f.id);
      for (const id of userFactIds) {
        expect(id).toMatch(/^fact_user_r\d+_\d+_\d+$/);
      }
      const baseIds = new Set([
        ...baseIntents().map((i) => i.id),
        ...baseIntents().flatMap((i) => i.sourceFacts.map((f) => f.id))
      ]);
      for (const id of [userIntent.id, ...userFactIds]) {
        expect(baseIds.has(id)).toBe(false);
      }
      // Two user facts minted by different ops cannot collide (opIndex differs).
      expect(new Set(userFactIds).size).toBe(userFactIds.length);
    }
  });

  it("edit_data may reference user facts minted by a PRECEDING add_chart in the same request", () => {
    const result = run(COMPOUND);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const intent = result.chartIntents.find((i) => i.id === "chart_user_r3_0")!;
      // The original keeps its op-0 id; the new user point is minted by op 1.
      expect(intent.sourceFacts.map((f) => f.id)).toEqual(["fact_user_r3_0_0", "fact_user_r3_1_1"]);
    }
  });

  it("referencing an intent that a LATER op would create is rejected (array order)", () => {
    const reversed: ChartOperation[] = [COMPOUND[1]!, COMPOUND[0]!];
    const result = run(reversed);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.detail).toContain("operations[0]");
    }
  });
});

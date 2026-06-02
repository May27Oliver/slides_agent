import type { DesignPlanningInput } from "@slides-agent/domain";
import type { JsonSchemaResponseFormat } from "../llm/openai-responses.client";

export function buildUiUxProMaxDesignPlanningPrompt(input: DesignPlanningInput): string {
  return [
    "You are the fixed ui-ux-pro-max design planning and critique layer for HTML slide generation.",
    "Return DesignPlanningResult JSON only.",
    "Use style direction as visual guidance, not source truth.",
    "Do not change slide order, title/message wording, outline meaning, speaker notes factual content, chart numbers, units, periods, denominators, or context.",
    "Do not add unsupported facts.",
    "",
    "SUPPORTED_RENDERER_TOKENS",
    JSON.stringify(supportedRendererTokens(), null, 2),
    "",
    "SOURCE_FIDELITY_CONSTRAINTS",
    JSON.stringify(sourceFidelityConstraints(), null, 2),
    "",
    "DESIGN_PLANNING_RESULT_SCHEMA",
    JSON.stringify(designPlanningResultSchema(), null, 2),
    "",
    "DESIGN_PLANNING_INPUT",
    JSON.stringify(
      {
        slideDeck: input.slideDeck,
        deckBrief: input.deckBrief,
        styleDirection: input.deckBrief.styleDirection,
        chartIntents: input.chartIntents
      },
      null,
      2
    )
  ].join("\n");
}

export function designPlanningResponseFormat(): JsonSchemaResponseFormat {
  return {
    type: "json_schema",
    name: "design_planning_result",
    strict: true,
    schema: designPlanningResultSchema()
  };
}

function supportedRendererTokens(): Record<string, unknown> {
  return {
    visualDensity: ["low", "medium", "high"],
    typographyScale: ["compact", "standard", "presentation"],
    slidePatterns: [
      "title-summary",
      "content-summary",
      "metric-comparison",
      "risk-matrix",
      "action-summary"
    ],
    chartTreatments: ["chart", "metric_card", "table", "timeline", "fallback_text", "review_note"]
  };
}

function sourceFidelityConstraints(): string[] {
  return [
    "Every slidePatternAssignment.slideId must match an existing SlideDeck slide id.",
    "Every visualHierarchyPlan.slideId must match an existing SlideDeck slide id.",
    "Every visualHierarchyPlan.primaryMessage must equal the source slide message.",
    "Every chartTreatmentPlan.chartIntentId must match an existing ChartIntent id.",
    "chartTreatmentPlans.preservedContext must use only ChartIntent sourceFacts sourceText values.",
    "Design planning must not expose provider, model, API key, or backend runtime configuration."
  ];
}

function designPlanningResultSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "designSystem",
      "slidePatternAssignments",
      "chartTreatmentPlans",
      "visualHierarchyPlans",
      "accessibilityNotes",
      "designReviewNotes",
      "consistencyValidation"
    ],
    properties: {
      designSystem: designSystemSchema(),
      slidePatternAssignments: {
        type: "array",
        items: slidePatternAssignmentSchema()
      },
      chartTreatmentPlans: {
        type: "array",
        items: chartTreatmentPlanSchema()
      },
      visualHierarchyPlans: {
        type: "array",
        items: visualHierarchyPlanSchema()
      },
      accessibilityNotes: accessibilityNotesSchema(),
      designReviewNotes: designReviewNotesSchema(),
      consistencyValidation: designConsistencyValidationSchema()
    }
  };
}

function designSystemSchema(): Record<string, unknown> {
  return objectSchema(
    [
      "themeName",
      "palette",
      "typography",
      "spacing",
      "visualDensity",
      "layoutGrid",
      "slidePatterns",
      "chartStyle"
    ],
    {
      themeName: { type: "string" },
      palette: objectSchema(
        ["background", "surface", "text", "mutedText", "accent", "warning"],
        stringProperties(["background", "surface", "text", "mutedText", "accent", "warning"])
      ),
      typography: objectSchema(["headingFamily", "bodyFamily", "scale"], {
        headingFamily: { type: "string" },
        bodyFamily: { type: "string" },
        scale: { enum: ["compact", "standard", "presentation"] }
      }),
      spacing: objectSchema(["unit", "slidePadding", "blockGap"], {
        unit: { type: "number" },
        slidePadding: { type: "number" },
        blockGap: { type: "number" }
      }),
      visualDensity: { enum: ["low", "medium", "high"] },
      layoutGrid: { type: "string" },
      slidePatterns: stringArraySchema(),
      chartStyle: { type: "string" }
    }
  );
}

function slidePatternAssignmentSchema(): Record<string, unknown> {
  return objectSchema(["slideId", "primaryPattern", "density", "layoutIntent", "rationale"], {
    slideId: { type: "string" },
    primaryPattern: { type: "string" },
    density: { enum: ["low", "medium", "high"] },
    layoutIntent: objectSchema(["priority", "density", "emphasis"], {
      priority: {
        enum: [
          "message_first",
          "metrics_first",
          "comparison",
          "timeline",
          "risk_matrix",
          "table_dense"
        ]
      },
      density: { enum: ["low", "medium", "high"] },
      emphasis: { enum: ["narrative", "numbers", "risks", "decisions", "actions"] }
    }),
    rationale: { type: "string" }
  });
}

function chartTreatmentPlanSchema(): Record<string, unknown> {
  return objectSchema(
    ["chartIntentId", "treatment", "labelingNotes", "preservedContext", "fallbackRationale"],
    {
      chartIntentId: { type: "string" },
      treatment: {
        enum: ["chart", "metric_card", "table", "timeline", "fallback_text", "review_note"]
      },
      labelingNotes: stringArraySchema(),
      preservedContext: stringArraySchema(),
      fallbackRationale: nullableStringSchema()
    }
  );
}

function visualHierarchyPlanSchema(): Record<string, unknown> {
  return objectSchema(
    ["slideId", "primaryMessage", "supportingEvidence", "secondaryDetails", "deEmphasizedContent"],
    {
      slideId: { type: "string" },
      primaryMessage: { type: "string" },
      supportingEvidence: stringArraySchema(),
      secondaryDetails: stringArraySchema(),
      deEmphasizedContent: stringArraySchema()
    }
  );
}

function accessibilityNotesSchema(): Record<string, unknown> {
  return objectSchema(
    [
      "minContrastRatio",
      "colorContrastNotes",
      "readingOrderNotes",
      "keyboardNavigationNotes",
      "manualVerificationNotes"
    ],
    {
      minContrastRatio: { type: "number" },
      colorContrastNotes: stringArraySchema(),
      readingOrderNotes: stringArraySchema(),
      keyboardNavigationNotes: stringArraySchema(),
      manualVerificationNotes: stringArraySchema()
    }
  );
}

function designReviewNotesSchema(): Record<string, unknown> {
  return objectSchema(
    [
      "styleDirectionInterpretation",
      "visualDensityDecision",
      "rejectedSuggestions",
      "htmlGenerationConstraints",
      "manualVerificationNotes"
    ],
    {
      styleDirectionInterpretation: stringArraySchema(),
      visualDensityDecision: { type: "string" },
      rejectedSuggestions: stringArraySchema(),
      htmlGenerationConstraints: stringArraySchema(),
      manualVerificationNotes: stringArraySchema()
    }
  );
}

function designConsistencyValidationSchema(): Record<string, unknown> {
  return objectSchema(["ok", "checkedSlideIds", "issues", "fallbackUsed", "fallbackReason"], {
    ok: { type: "boolean" },
    checkedSlideIds: stringArraySchema(),
    issues: stringArraySchema(),
    fallbackUsed: { type: "boolean" },
    fallbackReason: nullableStringSchema()
  });
}

function objectSchema(
  required: string[],
  properties: Record<string, unknown>
): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required,
    properties
  };
}

function stringProperties(keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((key) => [key, { type: "string" }]));
}

function stringArraySchema(): Record<string, unknown> {
  return {
    type: "array",
    items: { type: "string" }
  };
}

function nullableStringSchema(): Record<string, unknown> {
  return {
    type: ["string", "null"]
  };
}

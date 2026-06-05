import type { ChartIntent, VisualizationType } from "@/content-core/chart-intent.types";
import type { Slide, SlideOutlineItem } from "@/deck/deck.types";
import { defaultDesignSystem } from "@/design/default-design-system";
import type { DesignPlanner, DesignPlanningGenerationPort } from "@/design/design-planner.port";
import type {
  ChartTreatment,
  ChartTreatmentPlan,
  DesignConsistencyValidation,
  DesignPlanningInput,
  DesignPlanningResult,
  SlidePatternAssignment,
  VisualHierarchyPlan
} from "@/design/design.types";

export interface UiUxProMaxDesignPlannerOptions {
  designPlanningPort?: DesignPlanningGenerationPort;
}

export class UiUxProMaxDesignPlanner implements DesignPlanner {
  constructor(private readonly options: UiUxProMaxDesignPlannerOptions = {}) {}

  async plan(input: DesignPlanningInput): Promise<DesignPlanningResult> {
    if (!this.options.designPlanningPort) {
      return buildFallbackDesignPlanningResult(input, {
        ok: true,
        checkedSlideIds: input.slideDeck.slides.map((slide) => slide.id),
        issues: [],
        fallbackUsed: true,
        fallbackReason: "No ui-ux-pro-max design planning port was configured."
      });
    }

    try {
      const generatedResult =
        await this.options.designPlanningPort.generateDesignPlanningResult(input);
      const validation = validateGeneratedDesignPlanningResult(input, generatedResult);

      if (validation.ok) {
        // 007: the planner no longer carries a styleKit. slides.service runs the
        // mandatory selectTheme step and supplies styleKit on both paths (DR-002).
        return generatedResult;
      }

      return buildFallbackDesignPlanningResult(input, {
        ...validation,
        fallbackUsed: true,
        fallbackReason: "Generated design planning result failed deterministic validation."
      });
    } catch (error) {
      return buildFallbackDesignPlanningResult(input, {
        ok: false,
        checkedSlideIds: input.slideDeck.slides.map((slide) => slide.id),
        issues: [`ui-ux-pro-max design planning failed: ${errorMessage(error)}`],
        fallbackUsed: true,
        fallbackReason: "ui-ux-pro-max design planning port failed."
      });
    }
  }
}

function buildFallbackDesignPlanningResult(
  input: DesignPlanningInput,
  consistencyValidation: DesignConsistencyValidation
): DesignPlanningResult {
  const designSystem = defaultDesignSystem(input.deckBrief.styleDirection);
  const slidePatternAssignments = input.slideDeck.slides.map((slide) => assignSlidePattern(slide));

  return {
    designSystem,
    slidePatternAssignments,
    chartTreatmentPlans: input.chartIntents.map((intent) => planChartTreatment(intent)),
    visualHierarchyPlans: input.slideDeck.slides.map((slide) => planVisualHierarchy(slide)),
    accessibilityNotes: {
      minContrastRatio: 4.5,
      colorContrastNotes: [
        "Use the deck palette text/background pairs with at least WCAG AA contrast."
      ],
      readingOrderNotes: input.slideDeck.slides.map(
        (slide) => `${slide.id}: title, message, supporting content, controls.`
      ),
      keyboardNavigationNotes: [
        "HTML output must keep previous/next keyboard navigation available."
      ],
      manualVerificationNotes: [
        "Check text overlap and contrast in laptop and projector viewports."
      ]
    },
    designReviewNotes: {
      styleDirectionInterpretation: summarizeFallbackStyleDirection(input, consistencyValidation),
      visualDensityDecision: `Use ${designSystem.visualDensity} density from conservative fallback design system and slide layout intents.`,
      rejectedSuggestions: ["Using fixed fallback design system as the primary style source."],
      htmlGenerationConstraints: [
        "HTML generation must consume DesignPlanningResult instead of reinterpreting styleDirection.",
        "Preserve slide order, title/message wording, outline meaning, and source-supported numbers.",
        "Do not render speakerNotesDraft in presentation view."
      ],
      manualVerificationNotes: [
        "Manually inspect visual hierarchy, chart treatment, and layout consistency before release."
      ]
    },
    consistencyValidation
  };
}

function assignSlidePattern(slide: Slide): SlidePatternAssignment {
  return {
    slideId: slide.id,
    primaryPattern: patternForSlide(slide),
    density: slide.layoutIntent.density,
    layoutIntent: slide.layoutIntent,
    rationale: `Selected from slideKind=${slide.slideKind}, type=${slide.type}, priority=${slide.layoutIntent.priority}.`
  };
}

function patternForSlide(slide: Slide): string {
  if (slide.slideKind === "opening") {
    return "title-summary";
  }
  if (slide.slideKind === "closing") {
    return "action-summary";
  }
  if (slide.layoutIntent.priority === "metrics_first" || slide.type === "metrics") {
    return "metric-comparison";
  }
  if (slide.layoutIntent.priority === "risk_matrix") {
    return "risk-matrix";
  }
  return "content-summary";
}

function planChartTreatment(intent: ChartIntent): ChartTreatmentPlan {
  const treatment = treatmentFor(intent.recommendedVisuals);

  return {
    chartIntentId: intent.id,
    treatment,
    labelingNotes: [
      intent.title,
      "Preserve original source numbers, units, periods, denominators, and context."
    ],
    preservedContext: intent.sourceFacts.map((fact) => fact.sourceText),
    ...(treatment === "fallback_text" || treatment === "review_note"
      ? { fallbackRationale: intent.rationale }
      : {})
  };
}

function treatmentFor(recommendedVisuals: VisualizationType[]): ChartTreatment {
  if (recommendedVisuals.includes("metric_card")) {
    return "metric_card";
  }
  if (recommendedVisuals.includes("table")) {
    return "table";
  }
  if (recommendedVisuals.includes("timeline") || recommendedVisuals.includes("milestone")) {
    return "timeline";
  }
  if (recommendedVisuals.includes("comparison")) {
    return "chart";
  }
  if (recommendedVisuals.includes("callout")) {
    return "fallback_text";
  }
  return "review_note";
}

function planVisualHierarchy(slide: Slide): VisualHierarchyPlan {
  return {
    slideId: slide.id,
    primaryMessage: slide.message,
    supportingEvidence: slide.outline
      .filter((item) => item.emphasis === "evidence" || item.emphasis === "risk")
      .map((item) => item.text),
    secondaryDetails: slide.outline
      .filter((item) => isSecondaryDetail(item))
      .map((item) => item.text),
    deEmphasizedContent: []
  };
}

function isSecondaryDetail(item: SlideOutlineItem): boolean {
  return item.emphasis === "context" || item.emphasis === "decision" || item.emphasis === "action";
}

function summarizeFallbackStyleDirection(
  input: DesignPlanningInput,
  consistencyValidation: DesignConsistencyValidation
): string[] {
  const styleDirection = input.deckBrief.styleDirection?.trim();
  if (!styleDirection) {
    return [
      "No explicit style direction was provided; use conservative planning defaults.",
      consistencyValidation.fallbackReason ?? "Using conservative fallback design system."
    ];
  }

  return [
    styleDirection,
    consistencyValidation.fallbackReason ?? "Using conservative fallback design system.",
    `Apply style direction as visual constraints for ${input.slideDeck.slides.length} slides, not as source truth.`
  ];
}

function validateGeneratedDesignPlanningResult(
  input: DesignPlanningInput,
  result: DesignPlanningResult
): DesignConsistencyValidation {
  const checkedSlideIds = input.slideDeck.slides.map((slide) => slide.id);
  const assignmentSlideIds = new Set(
    result.slidePatternAssignments.map((assignment) => assignment.slideId)
  );
  const hierarchySlideIds = new Set(result.visualHierarchyPlans.map((plan) => plan.slideId));
  const chartTreatmentIds = new Set(result.chartTreatmentPlans.map((plan) => plan.chartIntentId));
  const issues = [
    ...checkedSlideIds
      .filter((slideId) => !assignmentSlideIds.has(slideId))
      .map((slideId) => `Missing slide pattern assignment: ${slideId}`),
    ...checkedSlideIds
      .filter((slideId) => !hierarchySlideIds.has(slideId))
      .map((slideId) => `Missing visual hierarchy plan: ${slideId}`),
    ...input.chartIntents
      .filter((intent) => !chartTreatmentIds.has(intent.id))
      .map((intent) => `Missing chart treatment plan: ${intent.id}`),
    ...result.slidePatternAssignments
      .filter(
        (assignment) => !result.designSystem.slidePatterns.includes(assignment.primaryPattern)
      )
      .map(
        (assignment) =>
          `Unsupported slide pattern assignment: ${assignment.slideId}:${assignment.primaryPattern}`
      ),
    ...result.visualHierarchyPlans
      .filter((plan) => {
        const slide = input.slideDeck.slides.find((candidate) => candidate.id === plan.slideId);
        return slide ? plan.primaryMessage !== slide.message : false;
      })
      .map((plan) => `Visual hierarchy changed slide message: ${plan.slideId}`)
  ];

  return {
    ok: issues.length === 0,
    checkedSlideIds,
    issues,
    fallbackUsed: false
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

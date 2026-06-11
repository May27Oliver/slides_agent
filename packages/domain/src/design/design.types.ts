import type { ChartIntent } from "@/content-core/chart-intent.types";
import type { DeckBrief, LayoutIntent, SlideDeck } from "@/deck/deck.types";
import type { DesignStyleKit } from "@/design/design-style-kit.types";

export type VisualDensity = "low" | "medium" | "high";

export interface Palette {
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  accent: string;
  warning: string;
}

export interface Typography {
  headingFamily: string;
  bodyFamily: string;
  scale: "compact" | "standard" | "presentation";
}

export interface SpacingScale {
  unit: number;
  slidePadding: number;
  blockGap: number;
}

export interface DesignSystem {
  themeName: string;
  palette: Palette;
  typography: Typography;
  spacing: SpacingScale;
  visualDensity: VisualDensity;
  slidePatterns: string[];
}

export interface DesignPlanningInput {
  slideDeck: SlideDeck;
  deckBrief: DeckBrief;
  chartIntents: ChartIntent[];
}

export interface DesignPlanningResult {
  designSystem: DesignSystem;
  slidePatternAssignments: SlidePatternAssignment[];
  chartTreatmentPlans: ChartTreatmentPlan[];
  visualHierarchyPlans: VisualHierarchyPlan[];
  accessibilityNotes: AccessibilityNotes;
  designReviewNotes: DesignReviewNotes;
  consistencyValidation: DesignConsistencyValidation;
  /**
   * Optional rich visual contract (concrete type scale, motion, effects,
   * multi-hue palette). When absent the renderer uses defaultDesignStyleKit().
   */
  styleKit?: DesignStyleKit;
}

export interface SlidePatternAssignment {
  slideId: string;
  primaryPattern: string;
  density: VisualDensity;
  layoutIntent: LayoutIntent;
  rationale: string;
}

export type ChartTreatment =
  | "chart"
  | "metric_card"
  | "table"
  | "timeline"
  | "fallback_text"
  | "review_note";

/**
 * 014: 使用者可指定的視覺覆寫目標。值域 = ChartVisualKind 扣掉降級產物
 * （metric_group / fallback_text）再加 "auto"（= 現行自動選型，等同缺欄位）。
 */
export type ChartVisualOverride = "auto" | "pie_donut" | "line" | "bar" | "metric_card" | "table";

export interface ChartTreatmentPlan {
  chartIntentId: string;
  treatment: ChartTreatment;
  /** 014: 使用者指定的視覺覆寫；缺/auto = 現行自動選型。validator 守門不外移。 */
  visualOverride?: ChartVisualOverride;
  labelingNotes: string[];
  preservedContext: string[];
  fallbackRationale?: string;
}

export interface VisualHierarchyPlan {
  slideId: string;
  primaryMessage: string;
  supportingEvidence: string[];
  secondaryDetails: string[];
  deEmphasizedContent: string[];
}

export interface AccessibilityNotes {
  minContrastRatio: number;
  colorContrastNotes: string[];
  readingOrderNotes: string[];
  keyboardNavigationNotes: string[];
  manualVerificationNotes: string[];
}

export interface DesignReviewNotes {
  styleDirectionInterpretation: string[];
  visualDensityDecision: string;
  rejectedSuggestions: string[];
  htmlGenerationConstraints: string[];
  manualVerificationNotes: string[];
}

export interface DesignConsistencyValidation {
  ok: boolean;
  checkedSlideIds: string[];
  issues: string[];
  fallbackUsed: boolean;
  fallbackReason?: string;
}

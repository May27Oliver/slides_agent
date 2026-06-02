import type { ChartIntent } from "@/content-core/chart-intent.types";
import type { DeckBrief, LayoutIntent, SlideDeck } from "@/deck/deck.types";

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
  layoutGrid: string;
  slidePatterns: string[];
  chartStyle: string;
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

export interface ChartTreatmentPlan {
  chartIntentId: string;
  treatment: ChartTreatment;
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

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
  uiUxProMaxNotes?: string[];
}

export interface DesignPlanningInput {
  purpose: string;
  audience: string;
  styleDirection?: string;
  chartEmphasis?: string;
}

export interface DesignPlanningResult {
  designSystem: DesignSystem;
  critiqueNotes: string[];
}

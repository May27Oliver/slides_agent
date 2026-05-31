export const SLIDE_GENERATION_SCHEMA_ID =
  "https://slides-agent.local/contracts/slide-generation.schema.json";

export interface DeckBriefContract {
  purpose: string;
  audience: string;
  styleDirection?: string;
  chartEmphasis?: string;
  language?: string;
  tone?: string;
}

export interface GenerationOptionsContract {
  useExternalProvider?: boolean;
  enableUiUxProMax?: boolean;
}

export interface GeneratePreviewRequestContract {
  sourceContent: string;
  deckBrief: DeckBriefContract;
  options?: GenerationOptionsContract;
}

export interface PreviewArtifactContract {
  html: string;
  generationSummary: GenerationSummaryContract;
}

export interface GenerationSummaryContract {
  slideCount: number;
  sourceFactCount: number;
  chartIntentCount: number;
  uncertainClaimCount: number;
  usedUiUxProMax: boolean;
  usedExternalProvider: boolean;
}

export interface GeneratePreviewResponseContract {
  slideDeck: unknown;
  previewArtifact: PreviewArtifactContract;
}

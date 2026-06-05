export type * from "@/content-core/chart-intent.types";
export { ChartIntentPlanner } from "@/content-core/chart-intent-planner";
export { ContentCorePlanner } from "@/content-core/content-core-planner";
export { segmentSourceContentWithRepair } from "@/content-core/semantic-segmentation-repair";
export type * from "@/content-core/semantic-segmentation.types";
export type * from "@/content-core/semantic-segmenter.port";
export {
  segmentSourceContent,
  validateSemanticSegments
} from "@/content-core/semantic-segmentation-validator";
export { extractSourceFacts } from "@/content-core/source-fact-extractor";
export { parseSourceSections } from "@/content-core/source-parser";
export { planSemanticSlideTitles } from "@/content-core/semantic-title-planner";
export { compileDeckPlanProposal } from "@/deck/deck-compiler";
export type * from "@/deck/deck-compiler.types";
export type * from "@/deck/deck-generation.types";
export { buildGenerationSummary } from "@/deck/generation-summary";
export { createDeckPlanProposal } from "@/deck/deck-planner";
export type * from "@/deck/deck-planner.types";
export { generatePreviewDeck } from "@/deck/generate-preview-deck";
export { planSlideDeck } from "@/deck/slide-deck-planner";
export { LlmDeckOutlinePlanner } from "@/deck/llm-deck-outline-planner";
export type { LlmDeckOutlinePlannerOptions } from "@/deck/llm-deck-outline-planner";
export { validateDeckOutlineRefinement } from "@/deck/deck-outline-refinement-validator";
export type * from "@/deck/deck-outline-planner.port";
export type * from "@/deck/deck.types";
export { UiUxProMaxDesignPlanner } from "@/design/design-planner";
export type * from "@/design/design-planner.port";
export type * from "@/design/design.types";
export type * from "@/design/types";
export { clampFontSizeCss, defaultDesignStyleKit } from "@/design/default-design-style-kit";
export type { DefaultDesignStyleKitInput } from "@/design/default-design-style-kit";
export type * from "@/design/design-style-kit.types";
export type * from "@/design/theme.types";
export type { ThemeStore } from "@/design/theme-store.port";
export { composeKit } from "@/design/compose-kit";
export type { ComposeKitParts } from "@/design/compose-kit";
export { selectTheme } from "@/design/select-theme";
export type { SelectThemeBrief } from "@/design/select-theme";
export { expandFontPairing, expandPalette } from "@/design/style-kit-engine";
export type { CuratedFontPairing, CuratedPalette } from "@/design/ui-ux-pro-max-knowledge";
export { renderTemplateDeckArtifact } from "@/rendering/html-deck-renderer";
export type { HtmlDeckGenerationInput } from "@/rendering/html-deck-renderer";
export { buildDeckStyleCss } from "@/rendering/deck-style-css";
export { buildDeckRuntimeScript } from "@/rendering/deck-runtime-script";
export { renderTemplateDeck } from "@/rendering/template-html-renderer";
export type { TemplateDeckInput } from "@/rendering/template-html-renderer";
export { validateGeneratedHtml } from "@/rendering/html-generation-validator";
export type { HtmlGenerationValidationInput } from "@/rendering/html-generation-validator";
export type * from "@/rendering/html-generation.types";
export { buildReviewReport } from "@/review/review-report-builder";
export type * from "@/review/types";
export type * from "@/preview-job/preview-job.types";
export {
  appendStageTransition,
  createInitialJobEvidence,
  isTerminalJobStatus
} from "@/preview-job/preview-job.types";
export type * from "@/preview-job/preview-job-store.port";
export type * from "@/preview-job/preview-job-runner.port";
export {
  PreviewJobService,
  createGenerationFailure,
  createTimeoutFailure
} from "@/preview-job/preview-job.service";
export {
  PREVIEW_JOB_TIMEOUT_MS,
  hasPreviewJobTimedOut,
  timeoutFailureForJob
} from "@/preview-job/preview-job-timeout";
export {
  serializePreviewJob,
  deserializePreviewJob
} from "@/preview-job/preview-job-serialization";
export type { SerializedPreviewJob } from "@/preview-job/preview-job-serialization";

export type { Deck, DeckRevision, DeckOrigin } from "@/deck-persistence/deck.types";
export type { DeckStore, DeckSummary, DeckDetail } from "@/deck-persistence/deck-store.port";
export {
  createDeckFromPreviewResult,
  type CreateDeckFromPreviewInput
} from "@/deck-persistence/create-deck-from-preview";

export type { UserAccount, AuthenticatedUser, AuthFailureCode } from "@/auth/auth.types";
export type { UserAccountStore } from "@/auth/user-account-store.port";
export {
  evaluateLogin,
  evaluateSession,
  toAuthenticatedUser,
  type AuthEvaluation
} from "@/auth/auth-policy.service";

import {
  BadGatewayException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  Optional
} from "@nestjs/common";
import type {
  GeneratePreviewRequestContract,
  GeneratePreviewResponseContract
} from "@slides-agent/contracts";
import {
  applyThemeSelection,
  collectChartReviewNotes,
  type DeckOutlinePlanningPort,
  type DesignPlanningGenerationPort,
  type GeneratePreviewDeckInput,
  generatePreviewDeck,
  type JobStage,
  LlmDeckOutlinePlanner,
  renderTemplateDeckArtifact,
  parseSourceSections,
  projectSelectedThemeSummary,
  type SemanticSegmentationRepairer,
  type SemanticSegmenter,
  segmentSourceContentWithRepair,
  selectTheme,
  type ThemeStore,
  UiUxProMaxDesignPlanner
} from "@slides-agent/domain";
import {
  DECK_OUTLINE_PLANNING_PORT,
  DESIGN_PLANNING_PORT,
  SEMANTIC_SEGMENTATION_REPAIRER_PORT,
  SEMANTIC_SEGMENTER_PORT
} from "@/modules/slides/slides.tokens";
import { THEME_STORE } from "@/modules/themes/themes.tokens";

export interface SlidesPreviewProgress {
  onStage?: (stage: JobStage) => void | Promise<void>;
}

@Injectable()
export class SlidesService {
  private readonly logger = new Logger(SlidesService.name);

  constructor(
    @Optional()
    @Inject(DESIGN_PLANNING_PORT)
    private readonly designPlanningPort?: DesignPlanningGenerationPort,
    @Optional()
    @Inject(SEMANTIC_SEGMENTER_PORT)
    private readonly semanticSegmenter?: SemanticSegmenter,
    @Optional()
    @Inject(SEMANTIC_SEGMENTATION_REPAIRER_PORT)
    private readonly semanticSegmentationRepairer?: SemanticSegmentationRepairer,
    @Optional()
    @Inject(DECK_OUTLINE_PLANNING_PORT)
    private readonly deckOutlinePlanningPort?: DeckOutlinePlanningPort,
    // 007: NOT @Optional — theme selection is mandatory and the DB-backed store is
    // always wired (ThemesModule). Dropping the wiring must fail at bootstrap, not
    // silently fall back to the default kit. The `?` is for direct unit construction
    // only; under Nest DI an unresolved THEME_STORE now throws.
    @Inject(THEME_STORE)
    private readonly themeStore?: ThemeStore
  ) {}

  async generatePreview(
    request: GeneratePreviewRequestContract,
    progress: SlidesPreviewProgress = {}
  ): Promise<GeneratePreviewResponseContract> {
    let currentNode: JobStage = "content_planning";

    try {
      await notifyStage(progress, "content_planning");
      this.logger.log("[SlidesPipeline] node=content_planning start");
      const deckInput = await this.buildDeckInput(request);
      this.logger.log(
        `[SlidesPipeline] node=content_planning done segmentation=${deckInput.sourceSections ? "enabled" : "fallback"} sections=${deckInput.sourceSections?.length ?? 0}`
      );
      currentNode = "deck_planning";
      await notifyStage(progress, "deck_planning");
      this.logger.log("[SlidesPipeline] node=deck_planning start");
      const baseDeckResult = generatePreviewDeck(deckInput);
      const refinedSlideDeck = await new LlmDeckOutlinePlanner({
        ...(this.deckOutlinePlanningPort
          ? { deckOutlinePlanningPort: this.deckOutlinePlanningPort }
          : {})
      }).plan({
        deck: baseDeckResult.slideDeck,
        sourceSections:
          deckInput.sourceSections && deckInput.sourceSections.length > 0
            ? deckInput.sourceSections
            : parseSourceSections(request.sourceContent),
        deckBrief: request.deckBrief
      });
      const deckResult = { ...baseDeckResult, slideDeck: refinedSlideDeck };
      const deckOutlineRefined = refinedSlideDeck !== baseDeckResult.slideDeck;
      this.logger.log(
        `[SlidesPipeline] node=deck_planning done slides=${deckResult.slideDeck.slides.length} chartIntents=${deckResult.chartIntents.length} outlineRefined=${deckOutlineRefined}`
      );
      currentNode = "design_planning";
      await notifyStage(progress, "design_planning");
      this.logger.log("[SlidesPipeline] node=design_planning start");
      const designPlanningResult = await new UiUxProMaxDesignPlanner({
        ...(this.designPlanningPort ? { designPlanningPort: this.designPlanningPort } : {})
      }).plan({
        slideDeck: deckResult.slideDeck,
        deckBrief: request.deckBrief,
        chartIntents: deckResult.chartIntents
      });
      this.logger.log(
        `[SlidesPipeline] node=design_planning done patterns=${arrayLength(designPlanningResult.slidePatternAssignments)} fallback=${Boolean(designPlanningResult.consistencyValidation?.fallbackUsed)}`
      );
      // 007: mandatory deterministic theme selection. The adapter reads the DB;
      // the pure selector picks the three axes. Both the LLM-success and fallback
      // design paths converge here, so fallback decks finally get a named theme.
      const themeCandidates = this.themeStore ? await this.themeStore.listSelectable() : [];
      // 007 keyword baseline → 011 manual per-axis override applied deterministically
      // on top (render-stage, zero extra LLM). No themeSelection ⇒ identical to 007.
      const baselineTheme = selectTheme(
        {
          purpose: request.deckBrief.purpose,
          audience: request.deckBrief.audience,
          ...(request.deckBrief.styleDirection
            ? { styleDirection: request.deckBrief.styleDirection }
            : {})
        },
        themeCandidates
      );
      const { selectedTheme, warnings: themeSelectionWarnings } = applyThemeSelection(
        baselineTheme.ids,
        request.themeSelection,
        themeCandidates
      );
      const themedDesignPlanningResult = {
        ...designPlanningResult,
        styleKit: selectedTheme.styleKit
      };
      this.logger.log(
        `[SlidesPipeline] node=theme_selection done theme=${selectedTheme.styleKit.kitName} fallback=${selectedTheme.fallback} overrides=${themeSelectionWarnings.length === 0 ? "ok" : `warn:${themeSelectionWarnings.length}`} candidates=${themeCandidates.length}`
      );
      currentNode = "html_generation";
      await notifyStage(progress, "html_generation");
      this.logger.log("[SlidesPipeline] node=html_generation start renderer=template");
      // 009: one deck render produces the html AND the per-chart result evidence
      // (generationSummary.renderedCharts). The applied theme is projected into
      // readonly summary tokens here (CR-004: result evidence in the response).
      const previewArtifact = renderTemplateDeckArtifact({
        deck: deckResult.slideDeck,
        designPlanningResult: themedDesignPlanningResult,
        chartIntents: deckResult.chartIntents,
        selectedTheme: projectSelectedThemeSummary(
          selectedTheme,
          themedDesignPlanningResult.designSystem.visualDensity
        ),
        // 011: honest per-axis fallback evidence → generationSummary.themeSelectionWarnings.
        themeSelectionWarnings
      });
      // 008/009 (CR-002/FR-004): derive the chart fallback / extraction / truncation
      // review notes from that SAME render's evidence — no second render — so the
      // review report can never diverge from what was actually drawn.
      const chartReviewNotes = collectChartReviewNotes({
        renderedCharts: previewArtifact.generationSummary.renderedCharts,
        chartIntents: deckResult.chartIntents
      });
      const reviewedSlideDeck =
        chartReviewNotes.length > 0
          ? {
              ...deckResult.slideDeck,
              reviewReport: {
                ...deckResult.slideDeck.reviewReport,
                humanReviewNotes: [
                  ...deckResult.slideDeck.reviewReport.humanReviewNotes,
                  ...chartReviewNotes
                ]
              }
            }
          : deckResult.slideDeck;
      this.logger.log(
        `[SlidesPipeline] node=html_generation done renderer=template validation=${previewArtifact.htmlGenerationValidation.status ?? "unknown"}`
      );
      currentNode = "html_validation";
      await notifyStage(progress, "html_validation");
      this.logger.log("[SlidesPipeline] node=html_validation done");
      this.logger.log("[SlidesPipeline] node=preview_generation succeeded");

      return {
        slideDeck: reviewedSlideDeck,
        designPlanningResult: themedDesignPlanningResult,
        previewArtifact,
        // 010 (C1/FR-006a): surface the planned chart intents so the persistence
        // path can store them on the revision for deterministic edit re-render.
        chartIntents: deckResult.chartIntents
      };
    } catch (error) {
      this.logger.error(
        `[SlidesPipeline] node=${currentNode} failed code=PREVIEW_GENERATION_FAILED`
      );
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error("Preview generation failed; returning sanitized 502 response.");
      throw new BadGatewayException({
        code: "PREVIEW_GENERATION_FAILED",
        message: "Preview generation failed"
      });
    }
  }

  private async buildDeckInput(
    request: GeneratePreviewRequestContract
  ): Promise<GeneratePreviewDeckInput> {
    if (!this.semanticSegmenter || !this.semanticSegmentationRepairer) {
      return request;
    }

    const segmentation = await segmentSourceContentWithRepair({
      sourceContent: request.sourceContent,
      purpose: request.deckBrief.purpose,
      audience: request.deckBrief.audience,
      ...(request.deckBrief.segmentationGuidance
        ? { segmentationGuidance: request.deckBrief.segmentationGuidance }
        : {}),
      segmenter: this.semanticSegmenter,
      repairer: this.semanticSegmentationRepairer
    });

    return {
      ...request,
      sourceSections: segmentation.sections,
      segmentationValidation: segmentation.validation
    };
  }
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

async function notifyStage(progress: SlidesPreviewProgress, stage: JobStage): Promise<void> {
  await progress.onStage?.(stage);
}

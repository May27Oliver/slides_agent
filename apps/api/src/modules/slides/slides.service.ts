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
  type DesignPlanningGenerationPort,
  type GeneratePreviewDeckInput,
  generatePreviewDeck,
  type HtmlGenerationPort,
  LlmAssistedHtmlDeckGenerator,
  type SemanticSegmentationRepairer,
  type SemanticSegmenter,
  segmentSourceContentWithRepair,
  UiUxProMaxDesignPlanner
} from "@slides-agent/domain";
import {
  DESIGN_PLANNING_PORT,
  HTML_GENERATION_PORT,
  SEMANTIC_SEGMENTATION_REPAIRER_PORT,
  SEMANTIC_SEGMENTER_PORT
} from "@/modules/slides/slides.tokens";

@Injectable()
export class SlidesService {
  private readonly logger = new Logger(SlidesService.name);

  constructor(
    @Optional()
    @Inject(DESIGN_PLANNING_PORT)
    private readonly designPlanningPort?: DesignPlanningGenerationPort,
    @Optional()
    @Inject(HTML_GENERATION_PORT)
    private readonly htmlGenerationPort?: HtmlGenerationPort,
    @Optional()
    @Inject(SEMANTIC_SEGMENTER_PORT)
    private readonly semanticSegmenter?: SemanticSegmenter,
    @Optional()
    @Inject(SEMANTIC_SEGMENTATION_REPAIRER_PORT)
    private readonly semanticSegmentationRepairer?: SemanticSegmentationRepairer
  ) {}

  async generatePreview(
    request: GeneratePreviewRequestContract
  ): Promise<GeneratePreviewResponseContract> {
    try {
      const deckInput = await this.buildDeckInput(request);
      const deckResult = generatePreviewDeck(deckInput);
      const designPlanningResult = await new UiUxProMaxDesignPlanner({
        ...(this.designPlanningPort ? { designPlanningPort: this.designPlanningPort } : {})
      }).plan({
        slideDeck: deckResult.slideDeck,
        deckBrief: request.deckBrief,
        chartIntents: deckResult.chartIntents
      });
      const previewArtifact = await new LlmAssistedHtmlDeckGenerator({
        ...(this.htmlGenerationPort ? { htmlGenerationPort: this.htmlGenerationPort } : {})
      }).generate({
        deck: deckResult.slideDeck,
        designPlanningResult
      });

      return {
        slideDeck: deckResult.slideDeck,
        designPlanningResult,
        previewArtifact
      };
    } catch (error) {
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

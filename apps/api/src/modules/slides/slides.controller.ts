import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  NotFoundException,
  Optional,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";
import { RateLimitGuard } from "@/modules/slides/rate-limit.guard";
import type {
  CreatePreviewJobResponseContract,
  GeneratePreviewResponseContract,
  PreviewJobEvidenceContract,
  PreviewJobStatus,
  PreviewJobStatusResponseContract
} from "@slides-agent/contracts";
import { validateGeneratePreviewRequest } from "@slides-agent/contracts";
import type { PreviewJob, PreviewJobRunner, PreviewJobStore } from "@slides-agent/domain";
import { PreviewJobService } from "@slides-agent/domain";
import { SlidesService } from "@/modules/slides/slides.service";
import { PREVIEW_JOB_RUNNER, PREVIEW_JOB_STORE } from "@/modules/slides/slides.tokens";

// Shared budget across both expensive POST endpoints (each request fans out
// into multiple chained LLM calls). Tunable via env; defaults to 5 req/60s/IP.
const previewRateLimit = new RateLimitGuard({
  windowMs: Number(process.env.PREVIEW_RATE_LIMIT_WINDOW_MS) || 60_000,
  max: Number(process.env.PREVIEW_RATE_LIMIT_MAX) || 5
});

@Controller("slides")
export class SlidesController {
  private readonly logger = new Logger("PreviewJobs");
  private readonly previewJobService = new PreviewJobService();

  constructor(
    @Inject(SlidesService) private readonly slidesService: SlidesService,
    @Optional()
    @Inject(PREVIEW_JOB_STORE)
    private readonly previewJobStore?: PreviewJobStore,
    @Optional()
    @Inject(PREVIEW_JOB_RUNNER)
    private readonly previewJobRunner?: PreviewJobRunner
  ) {}

  @Post("preview")
  @UseGuards(previewRateLimit)
  async preview(@Body() request: unknown): Promise<GeneratePreviewResponseContract> {
    const validation = validateGeneratePreviewRequest(request);
    if (!validation.ok) {
      throw new BadRequestException(validation.error);
    }

    return this.slidesService.generatePreview(validation.value);
  }

  @Post("preview-jobs")
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(previewRateLimit)
  async createPreviewJob(@Body() request: unknown): Promise<CreatePreviewJobResponseContract> {
    const validation = validateGeneratePreviewRequest(request);
    if (!validation.ok) {
      throw new BadRequestException({
        code: "INVALID_PREVIEW_REQUEST",
        message: "Preview request validation failed",
        issues: validation.error.fields
      });
    }

    const store = this.requirePreviewJobStore();
    const job = await store.create(this.previewJobService.createAcceptedJob(validation.value));
    this.logger.log(`${job.id} accepted stage=request_accepted status=queued`);
    this.previewJobRunner?.start(job);

    return {
      jobId: job.id,
      status: "queued",
      stage: "request_accepted",
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      statusUrl: `/api/slides/preview-jobs/${job.id}`
    };
  }

  @Get("preview-jobs/:jobId")
  async previewJobStatus(@Param("jobId") jobId: string): Promise<PreviewJobStatusResponseContract> {
    const job = await this.requirePreviewJobStore().findById(jobId);
    if (!job || job.status === "unavailable") {
      this.logger.log(`${jobId} status_lookup unavailable`);
      throw new NotFoundException({
        code: "PREVIEW_JOB_UNAVAILABLE",
        message: "Preview job is unavailable."
      });
    }

    this.logger.log(`${job.id} status_lookup status=${job.status} stage=${job.stage}`);
    return previewJobStatusResponse(job);
  }

  private requirePreviewJobStore(): PreviewJobStore {
    if (!this.previewJobStore) {
      throw new Error("Preview job store is not configured");
    }

    return this.previewJobStore;
  }
}

function previewJobStatusResponse(job: PreviewJob): PreviewJobStatusResponseContract {
  return {
    jobId: job.id,
    status: publicJobStatus(job.status),
    stage: job.stage,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    evidence: {
      stageTransitions: job.evidence.stageTransitions,
      validationAccepted: job.evidence.validationAccepted,
      fallbackUsed: job.evidence.fallbackUsed,
      repairAttempted: job.evidence.repairAttempted,
      finalStatus: publicJobStatus(job.evidence.finalStatus),
      ...(job.evidence.timingMs ? { timingMs: job.evidence.timingMs } : {}),
      ...(job.evidence.failureCategory ? { failureCategory: job.evidence.failureCategory } : {})
    } satisfies PreviewJobEvidenceContract,
    ...(job.result ? { result: job.result as GeneratePreviewResponseContract } : {}),
    ...(job.failure ? { failure: job.failure } : {})
  };
}

function publicJobStatus(status: PreviewJob["status"]): PreviewJobStatus {
  return status === "unavailable" ? "expired" : status;
}

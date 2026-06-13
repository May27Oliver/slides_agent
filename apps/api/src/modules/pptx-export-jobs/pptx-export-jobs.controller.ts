import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UseGuards
} from "@nestjs/common";
import type { Writable } from "node:stream";
import { RateLimitGuard } from "@/common/rate-limit.guard";
import { JwtAuthGuard } from "@/modules/auth/jwt-auth.guard";
import type { AuthedRequestUser } from "@/modules/auth/jwt.strategy";
import type {
  CreatePptxExportResponseContract,
  PptxExportJobStatusResponseContract
} from "@slides-agent/contracts";
import type {
  DeckStore,
  PptxExportJob,
  PptxExportJobRunner,
  PptxExportJobStore,
  SlideDeck
} from "@slides-agent/domain";
import {
  PPTX_MAX_PAGES,
  PptxExportJobService,
  createPptxExportFailure
} from "@slides-agent/domain";
import { DECK_STORE } from "@/modules/decks/decks.tokens";
import type { PptxArtifactStore } from "@/modules/pptx-export-jobs/fs-pptx-artifact-store";
import {
  PPTX_ARTIFACT_STORE,
  PPTX_EXPORT_JOB_RUNNER,
  PPTX_EXPORT_JOB_STORE
} from "@/modules/pptx-export-jobs/pptx-export-jobs.tokens";
import {
  assertValidPptxJobId,
  parseCreatePptxExportRequest
} from "@/modules/pptx-export-jobs/pptx-export-request.parser";

const PPTX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/** Minimal structural view of the HTTP response the download streams into. */
type DownloadResponse = Writable & { setHeader(name: string, value: string): void };

// Exports launch a headless browser — keep the per-IP budget modest (FR-006).
const pptxRateLimit = new RateLimitGuard({
  windowMs: Number(process.env.PPTX_RATE_LIMIT_WINDOW_MS) || 60_000,
  max: Number(process.env.PPTX_RATE_LIMIT_MAX) || 5,
  message: "Too many export requests. Please wait a moment and try again."
});

/**
 * 015 US2: the three-step PPTX export contract on the deck resource
 * (contracts/pptx-export-job.contract.md) — create / poll / download. Every read
 * is owner-scoped: a non-owner (or unknown id) uniformly sees 404, mirroring the
 * decks API's existence-hiding rule.
 */
@Controller("decks")
export class PptxExportJobsController {
  private readonly logger = new Logger("PptxExportJobs");
  private readonly jobService = new PptxExportJobService();

  constructor(
    @Inject(DECK_STORE) private readonly deckStore: DeckStore,
    @Inject(PPTX_EXPORT_JOB_STORE) private readonly jobStore: PptxExportJobStore,
    @Inject(PPTX_EXPORT_JOB_RUNNER) private readonly runner: PptxExportJobRunner,
    @Inject(PPTX_ARTIFACT_STORE) private readonly artifacts: PptxArtifactStore
  ) {}

  @Post(":id/pptx-exports")
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(JwtAuthGuard, pptxRateLimit)
  async createExport(
    @Param("id") deckId: string,
    @Body() body: unknown,
    @Req() req: { user: AuthedRequestUser }
  ): Promise<CreatePptxExportResponseContract> {
    const accountId = req.user.id;
    const { revision } = parseCreatePptxExportRequest(body);

    const deck = await this.deckStore.findByIdForAccount(accountId, deckId);
    if (!deck) {
      throw this.deckNotFound();
    }
    // FR-003a: export EXACTLY the revision the user sees. The deck store exposes
    // only the current revision; a mismatch means the deck moved on (another tab)
    // — fail explicitly rather than exporting something the user did not see.
    if (!deck.currentRevision || deck.currentRevision.revision !== revision) {
      throw new BadRequestException({
        code: "PPTX_REVISION_MISMATCH",
        message: "Requested revision is no longer current. Reload and try again.",
        ...(deck.currentRevision ? { currentRevision: deck.currentRevision.revision } : {})
      });
    }
    if (!deck.currentRevision.html) {
      throw new BadRequestException({
        code: "PPTX_REVISION_NOT_RENDERABLE",
        message: "This revision has no rendered HTML to export."
      });
    }

    const pageCount = (deck.currentRevision.slideDeck as SlideDeck).slides?.length ?? 0;
    if (pageCount < 1 || pageCount > PPTX_MAX_PAGES) {
      throw new BadRequestException({
        code: "PPTX_PAGE_LIMIT",
        message: `Deck must have between 1 and ${PPTX_MAX_PAGES} slides to export.`
      });
    }

    // FR-006: single-flight per account — one running export at a time.
    const inFlight = await this.guarded(() => this.jobStore.findActiveByAccount(accountId));
    if (inFlight) {
      throw new ConflictException({
        code: "PPTX_EXPORT_IN_PROGRESS",
        message: "A PPTX export is already in progress. Wait for it to finish.",
        jobId: inFlight.id
      });
    }

    let job: PptxExportJob | undefined;
    try {
      job = await this.jobStore.create(
        this.jobService.createAcceptedJob({ accountId, deckId, revision, pageCount })
      );
      await this.runner.start(job);
    } catch {
      this.logger.error("pptx export creation failed code=PPTX_QUEUE_UNAVAILABLE");
      // deep-review H2: if create succeeded but enqueue failed, the job is left
      // non-terminal and the single-flight gate would lock this account until the
      // sweeper fires (~3 min). Mark it failed now so the account is freed immediately.
      if (job) {
        await this.jobStore
          .markFailed(job.id, createPptxExportFailure(new Error("enqueue failed")), new Date())
          .catch(() => undefined);
      }
      throw this.serviceUnavailable();
    }

    this.logger.log(`${job.id} accepted deck=${deckId} revision=${revision} pages=${pageCount}`);
    return {
      jobId: job.id,
      status: "queued",
      statusUrl: `/api/decks/${deckId}/pptx-exports/${job.id}`
    };
  }

  @Get(":id/pptx-exports/:jobId")
  @UseGuards(JwtAuthGuard)
  async exportStatus(
    @Param("id") deckId: string,
    @Param("jobId") jobId: string,
    @Req() req: { user: AuthedRequestUser }
  ): Promise<PptxExportJobStatusResponseContract> {
    const job = await this.findOwnedJob(req.user.id, deckId, jobId);
    this.logger.log(`${job.id} status_lookup status=${job.status}`);
    return {
      jobId: job.id,
      status: job.status,
      ...(job.pageCount !== null ? { pageCount: job.pageCount } : {}),
      ...(job.status === "done"
        ? { downloadUrl: `/api/decks/${deckId}/pptx-exports/${job.id}/file` }
        : {}),
      ...(job.failure ? { failure: job.failure } : {}),
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString()
    };
  }

  @Get(":id/pptx-exports/:jobId/file")
  @UseGuards(JwtAuthGuard)
  async downloadArtifact(
    @Param("id") deckId: string,
    @Param("jobId") jobId: string,
    @Req() req: { user: AuthedRequestUser },
    @Res() res: DownloadResponse
  ): Promise<void> {
    const job = await this.findOwnedJob(req.user.id, deckId, jobId);
    if (job.status !== "done" || !job.result) {
      throw this.jobNotFound(); // no half-finished downloads (FR-005/FR-018)
    }
    const stream = await this.artifacts.read(job.result.artifactRef);
    if (!stream) {
      throw this.jobNotFound(); // artifact already purged (TTL)
    }
    const deck = await this.deckStore.findByIdForAccount(req.user.id, deckId);
    const filename = `${sanitizeFilename(deck?.title ?? "deck")}-rev${job.revision}.pptx`;
    res.setHeader("Content-Type", PPTX_CONTENT_TYPE);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    this.logger.log(`${job.id} artifact_download bytes=${job.result.byteSize}`);
    // deep-review H1: a stream error after headers (disk/NFS I/O) would otherwise be an
    // unhandled 'error' event (process-level crash) and leave the client a truncated
    // .pptx. Handle it: log, and end the response (no further data) so the file is
    // recognizably incomplete rather than crashing the worker.
    stream.on("error", (error: Error) => {
      this.logger.error(`${jobId} artifact_stream_error: ${error.name}`);
      res.end();
    });
    stream.pipe(res);
  }

  /** Owner + deck scope: anything that doesn't line up uniformly reads as 404. */
  private async findOwnedJob(
    accountId: string,
    deckId: string,
    jobId: string
  ): Promise<PptxExportJob> {
    assertValidPptxJobId(jobId);
    const job = await this.guarded(() => this.jobStore.findById(jobId));
    if (!job || job.accountId !== accountId || job.deckId !== deckId) {
      throw this.jobNotFound();
    }
    return job;
  }

  private async guarded<T>(op: () => Promise<T>): Promise<T> {
    try {
      return await op();
    } catch {
      this.logger.error("pptx export store unavailable code=PPTX_QUEUE_UNAVAILABLE");
      throw this.serviceUnavailable();
    }
  }

  private deckNotFound(): NotFoundException {
    return new NotFoundException({ code: "DECK_NOT_FOUND", message: "Deck not found." });
  }

  private jobNotFound(): NotFoundException {
    return new NotFoundException({
      code: "PPTX_EXPORT_NOT_FOUND",
      message: "PPTX export not found."
    });
  }

  private serviceUnavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: "PPTX_QUEUE_UNAVAILABLE",
      message: "PPTX export service is temporarily unavailable. Please try again."
    });
  }
}

/** Filesystem/header-safe download name (mirrors the web HTML download rule). */
function sanitizeFilename(title: string): string {
  const cleaned = title
    .replace(/[/\\:*?"<>|\s]+/gu, "-")
    .replace(/-{2,}/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 60);
  return cleaned || "deck";
}

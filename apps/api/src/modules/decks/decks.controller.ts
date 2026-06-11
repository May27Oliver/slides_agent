import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import { RateLimitGuard } from "@/common/rate-limit.guard";
import { JwtAuthGuard } from "@/modules/auth/jwt-auth.guard";
import type { AuthedRequestUser } from "@/modules/auth/jwt.strategy";
import type {
  DeckDetailResponseContract,
  DeckListResponseContract,
  DeckRevisionContract
} from "@slides-agent/contracts";
import { validateEditRevisionRequest } from "@slides-agent/contracts";
import type { ChartOperation, DeckStore, SlideDeck, ThemeStore } from "@slides-agent/domain";
import { applyDeckEdit } from "@slides-agent/domain";
import { DECK_STORE } from "@/modules/decks/decks.tokens";
import { THEME_STORE } from "@/modules/themes/themes.tokens";
import { assertValidDeckId } from "@/modules/decks/deck-request.parser";

// 010: throttle the edit-revision write per client. Cheaper than the LLM preview
// path (deterministic render), so a higher ceiling — still bounds CPU/storage abuse.
const editRateLimit = new RateLimitGuard({
  windowMs: Number(process.env.DECK_EDIT_RATE_LIMIT_WINDOW_MS) || 60_000,
  max: Number(process.env.DECK_EDIT_RATE_LIMIT_MAX) || 30,
  message: "Too many edit requests. Please wait a moment and try again."
});

/**
 * Read-only "my decks" endpoints (006 US3). Every route is JWT-protected and
 * scoped to `req.user.id`, so a user can only ever see their own decks — a
 * deck owned by another account is indistinguishable from a non-existent one.
 */
@Controller("decks")
@UseGuards(JwtAuthGuard)
export class DecksController {
  private readonly logger = new Logger("Decks");

  constructor(
    @Inject(DECK_STORE) private readonly deckStore: DeckStore,
    // 011: loads the theme catalogue when an edit re-themes. Optional only for
    // direct unit construction; under Nest DI ThemesModule always provides it.
    @Inject(THEME_STORE) private readonly themeStore?: ThemeStore
  ) {}

  @Get()
  async list(@Req() req: { user?: AuthedRequestUser }): Promise<DeckListResponseContract> {
    const accountId = this.requireAccountId(req);
    const decks = await this.deckStore.listByAccount(accountId);
    this.logger.log(`list account=${accountId} count=${decks.length}`);
    return { decks };
  }

  @Get(":id")
  async detail(
    @Param("id") id: string,
    @Req() req: { user?: AuthedRequestUser }
  ): Promise<DeckDetailResponseContract> {
    const accountId = this.requireAccountId(req);
    const deckId = assertValidDeckId(id);

    const deck = await this.deckStore.findByIdForAccount(accountId, deckId);
    if (!deck) {
      this.logger.log(`detail account=${accountId} deck=${deckId} not_found`);
      throw new NotFoundException({ code: "DECK_NOT_FOUND", message: "Deck not found." });
    }

    this.logger.log(`detail account=${accountId} deck=${deckId} ok`);
    return deck;
  }

  /**
   * 010 (US1, FR-007): apply a structural+text edit and persist it as a new
   * `origin="edit"` revision. Two-layer: the domain use-case `applyDeckEdit` merges
   * (whitelist + read-only enforcement, FR-021) and deterministically re-renders (no
   * LLM); the store appends under optimistic concurrency (FR-020). All errors use the
   * repo's top-level `{ code, message, fields? }` shape.
   */
  @Post(":id/revisions")
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, editRateLimit)
  async createRevision(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: { user?: AuthedRequestUser }
  ): Promise<DeckRevisionContract> {
    const accountId = this.requireAccountId(req);
    const deckId = assertValidDeckId(id);

    const parsed = validateEditRevisionRequest(body);
    if (!parsed.ok) {
      throw new BadRequestException({
        code: "INVALID_EDIT",
        message: "Invalid edit request.",
        fields: parsed.issues
      });
    }
    const { baseRevision, slideDeck, themeSelection, chartOperations } = parsed.value;

    const deck = await this.deckStore.findByIdForAccount(accountId, deckId);
    if (!deck) {
      this.logger.log(`edit account=${accountId} deck=${deckId} not_found`);
      throw new NotFoundException({ code: "DECK_NOT_FOUND", message: "Deck not found." });
    }
    if (!deck.currentRevision) {
      throw new BadRequestException({
        code: "INVALID_EDIT",
        message: "Deck has no editable revision."
      });
    }

    // Cheap pre-check: avoid merging/rendering against a base the client never saw.
    // The store re-checks in-transaction (the authoritative, TOCTOU-safe gate).
    if (baseRevision !== deck.currentRevision.revision) {
      this.logger.log(`edit account=${accountId} deck=${deckId} conflict base=${baseRevision}`);
      throw new ConflictException({
        code: "REVISION_CONFLICT",
        message: "This deck was updated elsewhere.",
        currentRevision: deck.currentRevision.revision
      });
    }

    // 011: re-theme only when the client asked to. Loading the catalogue (candidates)
    // is skipped entirely otherwise, so a plain text edit costs no extra read.
    // 014: chartOperations (shape-validated above) pass through; semantics —
    // id existence, ownership, limits — are enforced by the domain.
    const applied = applyDeckEdit(deck.currentRevision, slideDeck as SlideDeck, {
      ...(themeSelection && this.themeStore
        ? { themeSelection, candidates: await this.themeStore.listBrowsable() }
        : {}),
      ...(chartOperations ? { chartOperations: chartOperations as ChartOperation[] } : {})
    });
    if (!applied.ok) {
      this.logger.log(`edit account=${accountId} deck=${deckId} rejected=${applied.rejection}`);
      throw new BadRequestException({
        code: "INVALID_EDIT",
        message: "Edit could not be applied.",
        fields: [applied.detail]
      });
    }

    const result = await this.deckStore.appendEditRevision(
      accountId,
      deckId,
      baseRevision,
      applied.payload
    );
    if (!result.ok) {
      this.logger.log(`edit account=${accountId} deck=${deckId} conflict_tx`);
      throw new ConflictException({
        code: "REVISION_CONFLICT",
        message: "This deck was updated elsewhere.",
        currentRevision: result.currentRevision
      });
    }

    this.logger.log(
      `edit account=${accountId} deck=${deckId} revision=${result.revision.revision}`
    );
    return {
      revision: result.revision.revision,
      slideDeck: result.revision.slideDeck,
      designPlan: result.revision.designPlan,
      html: result.revision.html,
      generationSummary: result.revision.generationSummary,
      chartIntents: result.revision.chartIntents,
      origin: result.revision.origin,
      sourceJobId: result.revision.sourceJobId,
      createdAt: result.revision.createdAt
    };
  }

  // JwtAuthGuard guarantees req.user at runtime; this guards the unit-test path
  // and any future mis-wiring. A missing principal is an authentication failure
  // (401 AUTH_REQUIRED) — not a data miss — so it surfaces with the same shape
  // JwtAuthGuard itself uses rather than being masked as a 404.
  private requireAccountId(req: { user?: AuthedRequestUser }): string {
    const accountId = req?.user?.id;
    if (!accountId) {
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Authentication required."
      });
    }
    return accountId;
  }
}

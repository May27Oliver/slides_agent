import {
  Controller,
  Get,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Req,
  UseGuards
} from "@nestjs/common";
import { JwtAuthGuard } from "@/modules/auth/jwt-auth.guard";
import type { AuthedRequestUser } from "@/modules/auth/jwt.strategy";
import type {
  DeckDetailResponseContract,
  DeckListResponseContract
} from "@slides-agent/contracts";
import type { DeckStore } from "@slides-agent/domain";
import { DECK_STORE } from "@/modules/decks/decks.tokens";
import { assertValidDeckId } from "@/modules/decks/deck-request.parser";

/**
 * Read-only "my decks" endpoints (006 US3). Every route is JWT-protected and
 * scoped to `req.user.id`, so a user can only ever see their own decks — a
 * deck owned by another account is indistinguishable from a non-existent one.
 */
@Controller("decks")
@UseGuards(JwtAuthGuard)
export class DecksController {
  private readonly logger = new Logger("Decks");

  constructor(@Inject(DECK_STORE) private readonly deckStore: DeckStore) {}

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

  // JwtAuthGuard guarantees req.user at runtime; this guards the unit-test path
  // and any future mis-wiring rather than letting `undefined.id` throw opaquely.
  private requireAccountId(req: { user?: AuthedRequestUser }): string {
    const accountId = req?.user?.id;
    if (!accountId) {
      throw new NotFoundException({ code: "DECK_NOT_FOUND", message: "Deck not found." });
    }
    return accountId;
  }
}

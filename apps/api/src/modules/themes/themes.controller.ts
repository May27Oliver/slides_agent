import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import type { BrowsableTheme, ThemeCatalog, ThemeStore } from "@slides-agent/domain";
import { JwtAuthGuard } from "@/modules/auth/jwt-auth.guard";
import { THEME_STORE } from "@/modules/themes/themes.tokens";

/**
 * 011: `GET /api/themes` — browse the builtin theme catalogue (font 57 / palette 96
 * / style 67) grouped by axis. JWT-protected, read-only, NOT account-scoped (the
 * catalogue is shared builtin data). No LLM. Each entry carries the trusted-builtin
 * *partial* styleKit verbatim (007 seed already validated against CSS-breakout); the
 * renderer / client escape at the use boundary, so the endpoint does not re-sanitize.
 * data-model §5, contracts §1.
 */
@Controller("themes")
@UseGuards(JwtAuthGuard)
export class ThemesController {
  constructor(@Inject(THEME_STORE) private readonly themeStore: ThemeStore) {}

  @Get()
  async list(): Promise<ThemeCatalog> {
    const all = await this.themeStore.listBrowsable();
    return {
      font: byKind(all, "font"),
      palette: byKind(all, "palette"),
      style: byKind(all, "style")
    };
  }
}

function byKind(themes: BrowsableTheme[], kind: BrowsableTheme["kind"]): BrowsableTheme[] {
  return themes.filter((theme) => theme.kind === kind);
}

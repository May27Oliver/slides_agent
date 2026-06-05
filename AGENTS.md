<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
specs/005-user-auth-jwt/plan.md
<!-- SPECKIT END -->

<!-- project-structure:start (hand-maintained — keep in sync when adding modules/features) -->
# Project Structure

pnpm monorepo. Pure domain core + thin app shells; LLM behind ports; SQL only in adapters/infra.

```
apps/
  api/                         NestJS backend (tsx runtime → DI uses explicit @Inject(TOKEN))
    src/
      adapters/                ports' concrete impls
        llm/                   OpenAI Responses client (+ deterministic fallback)
        ui-ux-pro-max/         design-skill provider/registry bridge
      app/                     AppModule, DbConsoleModule (REPL)
      common/                  shared guards/filters/utils
      config/                  env config loaders (llm.config, db.config)
      infra/
        db/                    Drizzle: schema.ts, migrations/, DbModule/DbService
        redis/                 Redis connection (BullMQ)
      modules/
        auth/                  login/JWT (feature 005)
        decks/                 my-decks read API + DrizzleDeckStore (feature 006)
        preview-jobs/          async job store/runner (features 003/004)
        slides/                preview generation endpoints
      openapi/                 hand-built OpenAPI document (tsx = no reflection)
      worker/                  preview-job worker entrypoint (non-HTTP)
    scripts/                   db-migrate.ts, db-seed.ts
  web/                         React + Vite frontend
    src/
      components/              shared UI
      features/
        auth/                  login view + auth client
        decks/                 MyDecksView + decks client (feature 006)
        slide-generation/      input form, style presets, job polling, preview
      i18n/                    zh-TW / en-US / ja-JP translations
      styles/  test/
packages/
  domain/                      pure domain logic (no I/O): segmentation, deck/design/render, preview-job
    src/  test/  docs/
  contracts/                   shared request/response contracts + runtime validators + OpenAPI schemas
    src/  test/  schemas/
docs/                          design.md (design-system architecture)
scripts/                       repo-level scripts (dev.sh, auth-hash.ts)
specs/                         feature specs 001 → 006 (spec-kit); current: 006-db-persistence
tests/                         cross-cutting / shared test assets
```

Key conventions: deck = document + revisions (structured `SlideDeck` jsonb is source of truth,
HTML is derived cache); every deck read scoped to `req.user.id`; migrations run only via explicit
`pnpm db:migrate`, never on boot.
<!-- project-structure:end -->

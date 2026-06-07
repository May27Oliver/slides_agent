<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
specs/008-chart-rendering/plan.md
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
specs/                         feature specs 001 → 008 (spec-kit); current: 008-chart-rendering
tests/                         cross-cutting / shared test assets
```

Key conventions: deck = document + revisions (structured `SlideDeck` jsonb is source of truth,
HTML is derived cache); every deck read scoped to `req.user.id`; migrations run only via explicit
`pnpm db:migrate`, never on boot.
<!-- project-structure:end -->

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **slides_agent** (4420 symbols, 8151 relationships, 272 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/slides_agent/context` | Codebase overview, check index freshness |
| `gitnexus://repo/slides_agent/clusters` | All functional areas |
| `gitnexus://repo/slides_agent/processes` | All execution flows |
| `gitnexus://repo/slides_agent/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

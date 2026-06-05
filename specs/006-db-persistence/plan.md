# Implementation Plan: PostgreSQL 持久化(帳號 + 簡報)與 Drizzle ORM

**Branch**: `006-db-persistence` | **Date**: 2026-06-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-db-persistence/spec.md`

## Summary

引入 PostgreSQL + Drizzle ORM 作為帳號與簡報的持久層。帳號改由 `DbUserAccountStore`(實作既有 `UserAccountStore` port)供應,上層 auth 零改動;每份成功生成的簡報自動歸到帳號(`decks` + `deck_revisions`,結構化 `SlideDeck` jsonb 為事實來源 + HTML 渲染快取),並提供唯讀 `GET /api/decks`、`/api/decks/:id`(強制擁有權隔離)。一次 migration 也把 `themes` 表結構預留好給 007。domain 維持純淨(新增 `DeckStore` port + 純對映函式),DB 細節在 API/infra 層,沿用既有 RedisModule 的 Module/lifecycle 慣例。

**Artifact Language**: 繁體中文。

## Technical Context

**Language/Version**: TypeScript 5 / Node 20,執行採 tsx(無 decorator metadata → 所有 Nest DI 用顯式 `@Inject`)。

**Primary Dependencies**: NestJS 10、Drizzle ORM(`drizzle-orm` + `drizzle-kit`)、`pg`(node-postgres Pool)、既有 `@nestjs/passport`/`@nestjs/jwt`。測試用 `@electric-sql/pglite`(嵌入式 Postgres)+ `drizzle-orm/pglite`。

**Storage**: PostgreSQL 16(dev:Homebrew 本機;連線由 `DATABASE_URL` 提供)。

**Testing**: vitest。domain 純對映函式為單元測試(無 DB);adapter/整合測試對 pglite 跑真 SQL(免外部 PG);Nest module bootstrap 測試驗證 DI 邊界。

**Target Platform**: Linux/macOS server(API 與 worker 兩個 process)。

**Project Type**: pnpm workspace monorepo(apps/api + apps/web + packages/domain + packages/contracts)。

**Performance Goals**: deck 列表走 `(account_id, updated_at DESC)` 索引,成本與使用者自身 deck 數相關、與全站總量無關;重內容(html/jsonb)靠 TOAST 不影響列表。其餘 N/A。

**Constraints**: domain 不得含 SQL;migration 為顯式指令、不在開機自動跑;DB 連線缺失時 fail fast;持久化失敗不得阻斷「生成成功」。

**Scale/Scope**: 個位數帳號、每帳號數十～數百份 deck(本版不分頁)。

## Constitution Check

*GATE: 規劃前必過,設計後重查。*

- **Specification First**: 已有 accepted [spec.md](./spec.md),6 項 clarify 全數解決(見 spec Clarifications)。無阻擋規劃的未解問題。
- **Behavior-Driven User Value**: 4 個 user story 各有 Given/When/Then 且可獨立展示/測試(US1 登入走 DB、US2 自動存、US3 唯讀隔離、US4 themes 結構預留)。
- **Source Fidelity**: 不重新生成內容;持久化**完整無損保存**既有 `SlideDeck`/`PreviewResult`(含數字/日期/實體/decision/risk)於 jsonb;`source_job_id` 串起 job→deck 可追溯。
- **Reviewable Generation**: `generation_summary`(及既有 review 證據)隨 revision 持久化以供回看;不二次加工。
- **Web-First Deliverable**: 維持——自包含 HTML 仍為主交付;HTML 可由 `slide_deck`(+`design_plan`)經既有純函式 renderer 重算,DB 僅新增持久化/重渲染。
- **Backend-Configured LLM Boundary**: provider/model 仍為後端設定,不入請求/回應;`DATABASE_URL`、passwordHash 同屬機密,不入公開欄位或 log。
- **Coherent Deck Design System**: N/A 於 006(不改設計層;themes 僅預留結構,內容留 007,見 `THEME_SEED_INVENTORY.md`)。
- **Semantic Titles and Data Visualization**: N/A(不改生成語意)。
- **Code Quality and Simplicity**: 最小可讀做法——沿用既有 port/adapter 與 RedisModule 慣例;新增僅 `DbModule`、`DeckStore` port + 純對映、`DrizzleDeckStore`/`DbUserAccountStore` adapter、`DecksController`。每個新型別/port 都有當下消費者(見下「新增物件的消費者」)。被否決的更簡單替代見 Complexity Tracking。
- **TDD and DDD**: 首批失敗測試 = domain 純對映 `createDeckFromPreviewResult()`(把 `PreviewResult`+帳號+請求 → `{deck, revision}`)。domain 概念:`Deck`、`DeckRevision`、`DeckStore` port;bounded context = 簡報持久化。domain 語言檔 `*.types.ts`、port 檔 `*.port.ts`、純函式 `*.ts`;DB 決策在 adapter。
- **Lean Test Scope**: 測可觀測行為與擁有權規則,不重測 Drizzle/ORM 本身;adapter 測試只驗「我們的 SQL 對映與約束」。
- **Consistent UX and Language**: 統一 `deck`、`revision`、`account`、`theme`、`style kit`,跨 API/DB/前端/文件一致。
- **Performance and Operational Evidence**: 見 Technical Context;證據 = migration SQL、seed 輸出、測試報告、`source_job_id` 追溯鏈。
- **Manual Verification Path**: Homebrew Postgres 安裝/啟動、`db:migrate`、`db:seed`、登入+生成,於 [quickstart.md](./quickstart.md)。
- **Release Verification**: revision 的 `slide_deck` 通過既有 SlideDeck 結構檢查;重算 HTML 通過既有 `validateGeneratedHtml`;唯讀 API 回應符合 contract;既有 keyboard/responsive 行為不受影響(回歸綠燈)。

## Project Structure

### Documentation (this feature)

```text
specs/006-db-persistence/
├── plan.md          # 本檔
├── spec.md          # 已完成(含 Clarifications)
├── data-model.md    # 本階段產出:三表 + themes 預留、Drizzle schema
├── quickstart.md    # 本階段產出:本機 Postgres + migrate + seed
├── contracts/
│   └── decks-api.md  # GET /api/decks、/api/decks/:id 契約
└── tasks.md         # 由 /tasks 產出(不在本階段)
```

### Source Code (repository root)

```text
packages/domain/src/deck-persistence/        # 新增(純淨)
├── deck.types.ts            # Deck / DeckRevision / DeckOrigin
├── deck-store.port.ts       # DeckStore port(save / listByAccount / findByIdForAccount)
└── create-deck-from-preview.ts   # 純對映 PreviewResult → {deck, revision}

packages/contracts/src/
└── deck.ts                  # DeckSummaryContract / DeckDetailContract + validator

apps/api/src/
├── config/db.config.ts      # loadDbConfig(env) → { databaseUrl };缺則 fail fast
├── infra/db/                # 仿 infra/redis 慣例
│   ├── db.module.ts         # 提供 DRIZZLE token(Pool+drizzle);OnModuleDestroy 關 pool
│   ├── db.service.ts        # 持有 Pool / drizzle 實例
│   ├── schema.ts            # Drizzle schema:accounts/decks/deck_revisions/themes
│   ├── db.tokens.ts         # DRIZZLE
│   └── migrations/          # drizzle-kit 產的 SQL
├── modules/auth/
│   └── db-user-account-store.ts   # 實作 UserAccountStore（取代 Configured…）
├── modules/decks/           # 新增
│   ├── decks.module.ts
│   ├── decks.controller.ts  # GET /api/decks、/:id（JwtAuthGuard，account 隔離）
│   ├── drizzle-deck-store.ts # 實作 DeckStore（DRIZZLE）
│   └── decks.tokens.ts      # DECK_STORE
└── modules/preview-jobs/    # 既有：worker 成功後呼叫 DeckStore.save（持久化失敗只記錄）

apps/web/src/features/decks/ # 新增（最小可用）
├── decks-client.ts          # 用 authFetch 打 /api/decks
└── MyDecksView.tsx          # 列表 + 開啟檢視（不打磨視覺）

scripts/db-seed.ts           # idempotent：AUTH_ACCOUNTS → accounts upsert
drizzle.config.ts            # drizzle-kit 設定（schema/out/dialect）
```

**Structure Decision**: 沿用既有 monorepo 與 infra Module 慣例(`infra/redis` → `infra/db`)。domain 新增獨立 `deck-persistence/` 資料夾(語言檔/port/純函式分離),DB adapter 一律在 `apps/api`。worker 與 API 兩個 process 都 import `DbModule`(worker 需寫 deck、API 需讀 deck)。

### 新增物件的消費者(避免投機抽象)

| 新增 | 當下消費者 |
|---|---|
| `Deck`/`DeckRevision` types | `DeckStore`、`DrizzleDeckStore`、decks contract、純對映函式 |
| `DeckStore` port | worker 自動存(save)、`DecksController`(list/find) |
| `createDeckFromPreviewResult()` 純函式 | worker 成功路徑 → 產 `{deck, revision}` 再交給 store |
| `DbUserAccountStore` | `AuthModule`(取代 `ConfiguredUserAccountStore`) |
| `DbModule`/`DRIZZLE` | `DbUserAccountStore`、`DrizzleDeckStore`、`db:seed` |
| decks contract | `DecksController` 回應 + 前端 `decks-client` |

## Complexity Tracking

| 新增複雜度 | 為何需要 | 否決的更簡單替代 |
|---|---|---|
| Drizzle ORM + drizzle-kit | 型別安全 schema/migration,且純 TS(tsx 無 metadata,TypeORM decorator 不可靠) | 手寫 SQL + 手管 migration:易錯、無型別、維護成本高 |
| `DbModule`(獨立 infra) | 連線池生命週期(OnModuleDestroy 關 pool)、API+worker 共用 | 在各 service 自開連線:洩漏連線、難測、違反既有 RedisModule 慣例 |
| `@electric-sql/pglite` 測試 | adapter 測真 SQL/約束又免外部 PG | 只 mock drizzle:測不到 SQL/唯一鍵/FK;要求跑 PG 才能測:CI/本地門檻高 |
| 帳號 username 改 `text` + app 正規化(非 citext) | 免 `CREATE EXTENSION citext`(pglite 可能不支援),且沿用 005 既有「lowercase 正規化」 | citext:多一個 extension 依賴、測試環境相容性風險 |

> 註:`DeckStore` port 雖只一個實作(Drizzle),仍保留——它讓 domain 純淨、worker/controller 依抽象、測試可換 fake;與既有 `UserAccountStore`/`PreviewJobStore` 一致。

## Evidence Plan

- **Automated Evidence**: domain 對映單元測試;pglite adapter 測試(DbUserAccountStore / DrizzleDeckStore / 唯一鍵 + FK + 擁有權過濾);seed idempotency 測試;decks contract 測試;Nest module bootstrap 測試(DbModule 在 API/worker 的 DI 邊界);全 monorepo 回歸。
- **Manual Verification**: [quickstart.md](./quickstart.md) —— brew 安裝/啟動 Postgres、`db:generate`/`db:migrate`、`db:seed`、登入、生成後查 `/api/decks/:id`。
- **Operational Evidence**: 產生的 migration SQL 檔、`db:seed` 輸出、列表查詢的 EXPLAIN(走索引)。
- **Decision Evidence**: 本 plan 的 Complexity Tracking(Drizzle/DbModule/pglite/text-vs-citext 取捨)、spec Clarifications、`THEME_SEED_INVENTORY.md`(themes 預留理由)。
```

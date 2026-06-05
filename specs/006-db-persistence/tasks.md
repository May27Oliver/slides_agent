---
description: "Task list for feature 006 db-persistence"
---

# Tasks: PostgreSQL 持久化(帳號 + 簡報)與 Drizzle ORM

**Input**: `specs/006-db-persistence/`(plan.md / spec.md / research.md / data-model.md / contracts/)

**Tests**: 每個 slice TDD——先寫會失敗的聚焦測試,再實作最小行為。adapter 測試對 pglite 跑真 SQL;domain 純函式為無 DB 單元測試。

**Organization**: 依 user story 分組,各自可獨立實作/測試/展示。

## Format: `[ID] [P?] [Story] Description`
- **[P]**:不同檔案、無相依,可並行。
- **[Story]**:US1/US2/US3/US4。

---

## Phase 1: Setup(共用基礎)

- [x] T001 安裝相依:`pnpm --filter @slides-agent/api add drizzle-orm pg` 與 `add -D drizzle-kit @types/pg @electric-sql/pglite`。
- [x] T002 [P] 新增 `drizzle.config.ts`(dialect=postgresql、schema=`apps/api/src/infra/db/schema.ts`、out=`apps/api/src/infra/db/migrations`)。
- [x] T003 [P] `package.json` 加 scripts:`db:generate`(drizzle-kit generate)、`db:migrate`(套用 migration)、`db:seed`(tsx scripts/db-seed.ts)。
- [x] T004 [P] `.env.example` 加 `DATABASE_URL=postgresql://localhost:5432/slides_agent`。

---

## Phase 2: Foundational(阻擋所有 user story)

**⚠️ 完成前任何 user story 不得開工。**

- [x] T005 [P] `apps/api/src/config/db.config.ts`:`loadDbConfig(env)` → `{ databaseUrl }`,缺則 throw fail fast。
- [x] T006 [P] `apps/api/test/db-config.test.ts`:缺 `DATABASE_URL` 時 throw;有值時回傳。
- [x] T007 `apps/api/src/infra/db/schema.ts`:定義 `accounts`/`decks`/`deck_revisions`/`themes`(依 data-model.md;username=text、含索引與 FK)。
- [x] T008 [P] `apps/api/src/infra/db/db.tokens.ts`:`DRIZZLE` token。
- [x] T009 `apps/api/src/infra/db/db.service.ts`:持有 `pg` Pool + drizzle 實例(`@Inject` db config);`OnModuleDestroy` 關 pool(仿 `infra/redis`)。
- [x] T010 `apps/api/src/infra/db/db.module.ts`:提供 `DRIZZLE`(經 DbService),匯出供 API 與 worker module import。
- [x] T011 [P] `apps/api/test/helpers/pglite-db.ts`:測試工具——建 pglite + 套用 schema(drizzle push),回傳 drizzle 實例給 adapter 測試共用。
- [x] T012 產生並檢入初始 migration:`pnpm db:generate`(產 `apps/api/src/infra/db/migrations/*.sql`,含四表)。
- [x] T013 `apps/api/test/module-bootstrap.test.ts`:擴充——驗證 `DbModule` 在 AppModule/WorkerModule 的 DI 邊界(`DRIZZLE` 可解析;以 fake 取代避免開真連線,仿既有 RedisService override)。

**Checkpoint**:資料層骨架就緒,user story 可開工。

---

## Phase 3: User Story 1 - 帳號改由資料庫驗證(P1)🎯 MVP

**Goal**:登入帳號來源從 env 換成 DB,上層 auth 零改動;`db:seed` 灌入既有帳號。

**Independent Test**:seed 一帳號後登入成功;錯密/停用/未知皆 `AUTH_INVALID`;移除 `AUTH_ACCOUNTS` 後仍可登入。

### Tests(先寫,須失敗)⚠️
- [x] T014 [P] [US1] `apps/api/test/db-user-account-store.test.ts`(pglite):`findByUsername` 以正規化 lowercase 命中、`findById`、停用帳號回傳但 active=false、未知回 null。
- [x] T015 [P] [US1] `apps/api/test/db-seed.test.ts`(pglite):由 `AUTH_ACCOUNTS` upsert;**重複執行 idempotent**(不重複、可更新)。
- [x] T016 [US1] `apps/api/test/module-bootstrap.test.ts`:AuthModule 解析出的 `USER_ACCOUNT_STORE` 為 `DbUserAccountStore`。

### Implementation
- [x] T017 [US1] `apps/api/src/modules/auth/db-user-account-store.ts`:實作 `UserAccountStore`(`@Inject(DRIZZLE)`),查詢前 `username.trim().toLowerCase()`。
- [x] T018 [US1] `apps/api/src/modules/auth/auth.module.ts`:`USER_ACCOUNT_STORE` provider 由 `ConfiguredUserAccountStore` 換成 `DbUserAccountStore`;import `DbModule`。標記 `ConfiguredUserAccountStore` deprecated(暫留)。
- [x] T019 [US1] `scripts/db-seed.ts`:讀 `loadAuthConfig().accounts` → `accounts` upsert(onConflict by id/username),輸出筆數。
- [x] T020 [US1] 手動驗證:依 quickstart.md 步驟 4–5(seed→登入→移除 env 仍可登入)。

**Checkpoint**:US1 可獨立運作(登入走 DB)。

---

## Phase 4: User Story 2 - 生成的簡報自動存到帳號(P1)

**Goal**:preview job 成功後自動建 deck + 第 1 版 revision(結構化 jsonb + HTML 快取),歸屬登入帳號。

**Independent Test**:觸發一次成功生成 → DB 出現 deck(account_id 正確)+ revision(rev=1, origin=generation);寫 DB 失敗不讓生成變失敗。

### Tests(先寫,須失敗)⚠️
- [x] T021 [P] [US2] `packages/domain/test/deck-persistence/create-deck-from-preview.test.ts`:純對映 `PreviewResult`+帳號+請求 → `{deck, revision}`(title 取自 slideDeck、origin=generation、sourceJobId 帶入、html 快取保留)。
- [x] T022 [P] [US2] `apps/api/test/drizzle-deck-store-save.test.ts`(pglite):`saveNewDeck` 在交易內建 deck + revision(rev=1)並設 `current_revision_id`;唯一鍵 `(deck_id, revision)` 生效。
- [x] T023 [P] [US2] `apps/api/test/preview-job-accountid.test.ts`:`PreviewJobRequest` 序列化/反序列化帶 `accountId`(缺則向後相容略過)。
- [x] T024 [US2] `apps/api/test/preview-autosave.test.ts`:worker 成功 → 呼叫 store.saveNewDeck;store 丟錯時 → 記錄錯誤但 job 仍 succeeded(不阻斷)。

### Implementation
- [x] T025 [P] [US2] `packages/domain/src/deck-persistence/deck.types.ts`:`Deck`/`DeckRevision`/`DeckOrigin`(依 data-model)。
- [x] T026 [P] [US2] `packages/domain/src/deck-persistence/deck-store.port.ts`:`DeckStore`(`saveNewDeck`/`listByAccount`/`findByIdForAccount`)+ `DeckSummary`/`DeckDetail`。
- [x] T027 [US2] `packages/domain/src/deck-persistence/create-deck-from-preview.ts`:純對映函式;`packages/domain/src/index.ts` 匯出。
- [x] T028 [US2] `PreviewJobRequest` + 序列化加 `accountId`(`packages/domain/src/preview-job/*`),向後相容。
- [x] T029 [US2] `apps/api/src/modules/preview-jobs/preview-jobs.controller.ts`:建 job 時自 `req.user.id` 注入 `accountId`(需掛 `JwtAuthGuard`——對齊 005 既有保護)。
- [x] T030 [US2] `apps/api/src/modules/decks/drizzle-deck-store.ts`:`@Inject(DRIZZLE)` 實作 `DeckStore.saveNewDeck`(交易);`decks.tokens.ts` 定義 `DECK_STORE`。
- [x] T031 [US2] worker 成功路徑(`preview-worker.runtime` / job 完成處)呼叫 `createDeckFromPreviewResult` → `DECK_STORE.saveNewDeck`;`try/catch` 記錄持久化錯誤、不改 job 結果。WorkerModule import `DbModule` + 提供 `DECK_STORE`。
- [x] T032 [US2] 手動驗證:登入→生成→查 DB 有 deck + revision(quickstart 步驟 5.3)。

**Checkpoint**:US1+US2 各自可運作。

---

## Phase 5: User Story 3 - 查看「我的簡報」(P2)

**Goal**:唯讀 `GET /api/decks`、`/api/decks/:id`,強制擁有權隔離;最小前端列表/檢視。

**Independent Test**:A 兩份、B 一份;A 列表只回自己兩份;A 取 B 的 id 回 404;無 JWT 回 401。

### Tests(先寫,須失敗)⚠️
- [x] T033 [P] [US3] `packages/contracts/test/deck-contract.test.ts`:`DeckListResponseContract`/`DeckDetailResponseContract` 型別與 validator。
- [x] T034 [P] [US3] `apps/api/test/drizzle-deck-store-read.test.ts`(pglite):`listByAccount`(新到舊、只回自己)、`findByIdForAccount`(他人 id 回 null)。
- [x] T035 [P] [US3] `apps/api/test/decks.controller.test.ts`:GET 列表(own only);GET :id(own→detail、他人→404 `DECK_NOT_FOUND`、非法 uuid→400、無 JWT→401)。

### Implementation
- [x] T036 [P] [US3] `packages/contracts/src/deck.ts` + `index.ts` 匯出(依 contracts/decks-api.md)。
- [x] T037 [P] [US3] `apps/api/src/modules/decks/decks.tokens.ts` 確認 `DECK_STORE`;`drizzle-deck-store.ts` 補 `listByAccount`/`findByIdForAccount`。
- [x] T038 [US3] `apps/api/src/modules/decks/decks.controller.ts`:`@UseGuards(JwtAuthGuard)`、`account_id = req.user.id` 過濾;`assertValidDeckId`(仿 `assertValidJobId`)。
- [x] T039 [US3] `apps/api/src/modules/decks/decks.module.ts`:組裝 controller + `DECK_STORE`(DrizzleDeckStore)+ import `DbModule`;`AppModule` import `DecksModule`。
- [x] T040 [US3] `apps/api/src/openapi/openapi-document.ts`:補 `/api/decks`、`/api/decks/:id` 端點與 schema(手刻,tsx 無 reflection)。
- [x] T041 [P] [US3] 前端最小:`apps/web/src/features/decks/decks-client.ts`(用 `authFetch`)+ `MyDecksView.tsx`(列表+開啟檢視)+ `App.tsx` 加路由。
- [x] T042 [P] [US3] `apps/web/src/features/decks/decks-client.test.ts`:list/detail 呼叫帶 Bearer、401 行為。
- [x] T043 [US3] 手動驗證:quickstart 步驟 5.4–5.5(列表/檢視/跨帳號隔離)。

**Checkpoint**:US1–US3 各自可運作。

---

## Phase 6: User Story 4 - 預留 themes 表結構(P3)

**Goal**:`themes` 表結構存在(006 不灌內容),風格產出行為與 005 一致。

**Independent Test**:migration 後 `themes` 表存在、欄位正確、無資料列;既有 design/render 測試全綠。

### Tests(先寫,須失敗)⚠️
- [x] T044 [P] [US4] `apps/api/test/themes-schema.test.ts`(pglite introspection):`themes` 表存在且含 `applies_to`/`support`/`style_kit` 等欄位;無資料列。

### Implementation
- [x] T045 [US4] 確認 `themes` 已含於 T007 schema 與 T012 migration(本 phase 不另寫內容/不改 design 層)。
- [x] T046 [US4] 回歸:`pnpm -r test` 中 domain design/rendering 既有測試全綠(證明風格產出未受影響)。

**Checkpoint**:四個 user story 完成。

---

## Phase 7: Polish & 跨切面

- [x] T047 [P] `.env.example` / `quickstart.md` 實作狀態勾選同步;README 補 DB 啟動段(若需要)。
- [x] T048 移除/簡化未被消費的 domain artifact(對照 plan「新增物件的消費者」)。
- [x] T049 全 monorepo 回歸:`pnpm -r test` + 各包 `tsc --noEmit` 全綠。
- [x] T050 code-review + security pass(DATABASE_URL/passwordHash 不外洩、擁有權隔離、SQL 注入面=Drizzle 參數化確認)。
- [x] T051 跑 `quickstart.md` 全流程驗證並回填證據(migration SQL、seed 輸出、EXPLAIN 走索引)。見 quickstart「7. 驗證證據」。

---

## Dependencies & Execution Order

- **Phase 1 Setup** → **Phase 2 Foundational**(阻擋全部)→ user stories。
- **US1(P1)**、**US2(P1)**、**US3(P2)**、**US4(P3)** 在 Foundational 後可並行;單人則按 P1→P1→P2→P3。
- US3 的 store 讀取方法相依 US2 已建的 `DrizzleDeckStore`/schema;US3 controller 相依 US1 的 `JwtAuthGuard`(005 已有)。
- **Polish** 在所有目標 story 後。

### 各 story 內
- 測試先行且須失敗 → domain 型別/port → 純函式/service → adapter → endpoint → 整合 → 重構。

### 並行機會
- T002/T003/T004、T005/T006、T008/T011 等 [P] 可並行。
- 各 story 的 [P] 測試可並行;domain 型別與 contracts 可並行。

---

## Implementation Strategy

### MVP(US1)
1. Phase 1 Setup → 2. Phase 2 Foundational → 3. US1 → **停下驗證**(登入走 DB)→ 可 demo。

### 增量交付
US1(帳號 DB 化)→ US2(自動存)→ US3(查看我的簡報)→ US4(themes 結構)。每步獨立加值、不破壞前者。

---

## Notes
- [P] = 不同檔案、無相依。
- 先確認測試失敗再實作;測試聚焦可觀測行為與擁有權規則,不重測 ORM。
- domain 維持純淨:DB 只在 adapter;型別/port/行為分檔。
- 持久化失敗不得阻斷生成成功(DR-006)。
- 每完成一個 task 或邏輯群組即 commit。

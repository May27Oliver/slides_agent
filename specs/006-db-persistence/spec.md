# Feature Specification: PostgreSQL 持久化(帳號 + 簡報)與 Drizzle ORM

**Feature Branch**: `006-db-persistence`

**Created**: 2026-06-05

**Status**: Draft

**Input**: User description: "在 PostgreSQL 以 Drizzle ORM 持久化帳號與生成的簡報。把 env 帳號 allowlist 換成 DbUserAccountStore(沿用既有 UserAccountStore port);每份生成的簡報自動歸到使用者帳號(decks + deck_revisions,結構化 SlideDeck jsonb 為事實來源 + HTML 渲染快取);預留 themes 表結構給 feature 007。Dev Postgres 用 Homebrew。"

---

## 背景與目標

005 把登入改為必要,但帳號來自 env `AUTH_ACCOUNTS` allowlist,且生成的簡報是短暫的(preview job 存在 Redis、有 TTL)。006 引入 PostgreSQL 與 Drizzle ORM,讓:

1. 帳號改由 DB 管理(沿用既有 `UserAccountStore` port,上層 auth 邏輯零改動)。
2. 每個帳號生成的簡報被持久化、可日後查看與(未來)編輯。

設計原則:**宣告式狀態放 DB,確定性引擎留 codebase**;domain 維持純淨(不含 SQL),DB 存取走 port/adapter。

---

## Clarifications

### Session 2026-06-05

- Q: preview job 失敗時要不要在 DB 留記錄? → **A: 不留**,只有成功生成才落 deck/revision(失敗僅為 Redis job 的短暫狀態)。
- Q:「生成成功但寫 DB 失敗」如何處理? → **A: 記錄內部錯誤、不阻斷使用者**;重試機制留待後續 feature。
- Q: 006 後 `AUTH_ACCOUNTS` env 的定位? → **A: DB 為帳號唯一事實來源**;env 僅供 `db:seed` 灌資料,標記 deprecated,暫不移除程式分支。
- Q: 前端「我的簡報」範圍? → **A: 後端 decks 唯讀 API 為主 + 前端最小可用串接**(列表/檢視,不打磨視覺)。
- Q: Postgres driver(pg vs postgres.js)? → **A: `pg`(node-postgres)**,成熟穩定。
- Q: deck 列表是否分頁? → **A: 本版不分頁**(單一使用者資料量小);需要時再加。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 帳號改由資料庫驗證 (Priority: P1)

使用者用站方提供的帳號登入,帳號資料來自 PostgreSQL 而非 env allowlist。既有的 Passport local/jwt 流程、密碼雜湊(scrypt)、`active` 旗標每請求重查等行為完全不變,只是帳號來源換成 DB。

**Why this priority**: 這是把 auth 從「臨時 env 名單」升級為「可長期維運資料」的關鍵;也是後續「簡報歸屬於帳號」的前提(deck 需要一個穩定的 account FK)。

**Independent Test**: 在 DB seed 一個帳號後,用該帳號登入成功、錯誤密碼/停用帳號被拒、未知帳號被拒(訊息與時間皆不洩漏帳號是否存在)。完全不需 deck 功能即可驗證。

**Independent Demo**: 啟動本機 Postgres、跑 migration + seed、用 seed 帳號登入並取得 JWT、`GET /api/auth/me` 回傳該使用者。

**Acceptance Scenarios**:

1. **Given** DB 內有一個 active 帳號, **When** 以正確帳密登入, **Then** 回傳 JWT 與使用者資料。
2. **Given** DB 內該帳號 `active=false`, **When** 以正確帳密登入, **Then** 回傳 `AUTH_INVALID`(與密碼錯誤無法區分)。
3. **Given** DB 無此 username, **When** 登入, **Then** 回傳 `AUTH_INVALID`,且回應時間與「帳號存在但密碼錯」無可觀測差異。
4. **Given** 既有 `AUTH_ACCOUNTS` env, **When** 執行 `pnpm db:seed`, **Then** 這些帳號(含其 scrypt passwordHash)被 upsert 進 DB,且重複執行不產生重複資料。

---

### User Story 2 - 生成的簡報自動存到帳號 (Priority: P1)

登入的使用者送出生成請求,當 preview job 成功完成時,系統自動把結果存成該帳號名下的一份 deck(含第 1 版 revision)。

**Why this priority**: 「每個帳號儲存 slides」是本 feature 的核心價值;沒有它,生成結果仍是短暫的。

**Independent Test**: 觸發一次成功生成 → DB 出現一筆 `decks`(account_id = 該使用者)與一筆 `deck_revisions`(`origin='generation'`,含結構化 SlideDeck jsonb 與 HTML 快取)。可獨立於「列表 UI」驗證(直接查 DB / 查單筆 API)。

**Independent Demo**: 登入 → 生成 → 查 `GET /api/decks/:id` 看到剛存的 deck 與其 revision 內容。

**Acceptance Scenarios**:

1. **Given** 已登入使用者, **When** preview job 成功完成, **Then** 建立一筆 deck(account_id 為該使用者)與一筆 revision(`origin='generation'`、`slide_deck` 為結構化 SlideDeck、`html` 為渲染快取、`source_job_id` 指向該 job)。
2. **Given** preview job 失敗(timeout/generation/unavailable), **When** job 結束, **Then** 不在 DB 留任何 deck 記錄(失敗僅為 Redis job 短暫狀態;只有成功才落 DB)。
3. **Given** deck 寫入 DB 失敗(DB 暫時不可用), **When** job 已成功產出結果, **Then** 不得讓使用者那次「生成成功」變成錯誤;持久化失敗僅記錄為內部錯誤、不阻斷使用者(重試機制留待後續 feature)。

---

### User Story 3 - 查看「我的簡報」 (Priority: P2)

登入使用者可列出自己的簡報、開啟單份簡報內容,且不可存取其他帳號的簡報。

**Why this priority**: 持久化後的最基本回收價值;但可在 US1/US2 完成後獨立加上。

**Independent Test**: 以 A 帳號建立兩份 deck、B 帳號建立一份;A 呼叫列表只回自己的兩份;A 取 B 的 deckId 回 404/403(不洩漏存在與否)。

**Independent Demo**: 登入 → `GET /api/decks` 顯示自己的清單(title/更新時間)→ 點一份 → `GET /api/decks/:id` 顯示內容。

**Acceptance Scenarios**:

1. **Given** 已登入使用者有 N 份 deck, **When** `GET /api/decks`, **Then** 僅回傳該使用者的 deck(依更新時間新到舊),不含他人資料。
2. **Given** deckId 屬於別的帳號, **When** `GET /api/decks/:id`, **Then** 回傳 not-found 類錯誤(不揭露該 deck 是否存在)。
3. **Given** 未帶有效 JWT, **When** 呼叫上述端點, **Then** 回傳 `AUTH_REQUIRED`。

---

### User Story 4 - 預留 themes 表結構(不灌內容) (Priority: P3)

建立 `themes` 表的結構(含 `applies_to`、`support`、`style_kit` jsonb 等欄位),供 feature 007 灌入 ui-ux-pro-max 風格 seed。本 feature 不產生任何 theme 內容,也不改變現有風格產出流程。

**Why this priority**: 讓 006 的 migration 一次把資料層骨架打好,007 只需加 seed 與 selection 改動,避免日後再動 schema。詳見 repo root `THEME_SEED_INVENTORY.md`。

**Independent Test**: migration 後 `themes` 表存在且欄位符合規格;無資料列;現有生成/渲染行為不受影響(既有測試全綠)。

**Independent Demo**: 對 DB 下 `\d themes` 看到預期欄位。

**Acceptance Scenarios**:

1. **Given** 跑完 006 migration, **When** 檢視 schema, **Then** `themes` 表存在(欄位見 Key Entities),且不含任何資料列。
2. **Given** 未改動 design/rendering 程式, **When** 生成簡報, **Then** 風格產出與 005 完全一致(回歸測試綠)。

---

### Edge Cases

- DB 在啟動時不可用 → API 應 fail fast 並給清楚訊息(對齊既有 `REDIS_URL is required` 風格)。
- `db:seed` 重複執行 → 必須 idempotent(upsert by username/id)。
- 同一份 deck 短時間多次寫入(未來編輯)→ revision 以 `(deck_id, revision)` 唯一遞增,避免衝突。
- 使用者被停用後仍持有有效 JWT → 既有「每請求重查 active」仍透過 DbUserAccountStore 生效。
- 跨帳號存取 deck → 一律以 `account_id = 當前使用者` 過濾,越權回 not-found。
- 巨大 HTML 快取 → 以 TOAST 處理,不影響列表查詢(列表不選 `html`)。

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 以 PostgreSQL 作為帳號與簡報的持久化儲存,並透過 Drizzle ORM 存取。
- **FR-002**: 系統 MUST 提供 `DbUserAccountStore`,實作既有 `UserAccountStore` port(`findByUsername`、`findById`),並在 `AuthModule` 取代 `ConfiguredUserAccountStore`;`AuthService`、Passport 策略、domain auth policy MUST 不需更動。
- **FR-003**: 系統 MUST 提供 idempotent 的 `pnpm db:seed`,把現有 `AUTH_ACCOUNTS` 帳號(含 scrypt passwordHash)灌入 DB。
- **FR-004**: 系統 MUST 在 preview job 成功完成時,自動建立一筆 deck(歸屬登入帳號)與一筆 `origin='generation'` 的 revision。
- **FR-005**: revision MUST 以結構化 `SlideDeck`(jsonb)為事實來源,並存渲染後 HTML 作為衍生快取;HTML MUST 可由 `slide_deck`(+`design_plan`)經既有純函式 renderer 重算。
- **FR-006**: 系統 MUST 提供唯讀 API `GET /api/decks`(列出當前使用者的 deck,新到舊)與 `GET /api/decks/:id`(取單份),兩者 MUST 以 `JwtAuthGuard` 保護且強制 `account_id = 當前使用者`。
- **FR-007**: 跨帳號存取 deck MUST 回傳 not-found 類錯誤,且不揭露目標是否存在。
- **FR-008**: 持久化失敗 MUST NOT 把一次「生成成功」變成對使用者的失敗;失敗 MUST 被記錄為內部錯誤(對齊既有錯誤形狀)。
- **FR-009**: 系統 MUST 建立 `themes` 表結構(見 Key Entities),本 feature 不灌入內容、不改變風格產出流程。
- **FR-010**: domain 層 MUST 維持純淨——新增 `DeckStore` port 於 domain,DB adapter(Drizzle)置於 API/infra 層。
- **FR-011**: 資料庫 migration MUST 為顯式指令(`db:generate` / `db:migrate`),MUST NOT 在 API 開機時自動執行。
- **FR-012**: DB 連線設定 MUST 來自環境變數 `DATABASE_URL`,並在缺少時 fail fast。
- **FR-013**: 006 完成後 DB MUST 為帳號唯一事實來源;`AUTH_ACCOUNTS` env MUST 僅作為 `db:seed` 的灌入來源並標記 deprecated(本版暫不移除其程式分支)。

### HTML Slides Agent Constitution Requirements *(mandatory for slide-generation features)*

> 本 feature 屬資料持久化/基礎建設,不改變生成語意。以下逐項標註適用性。

- **CR-001 Source Fidelity**: N/A(不改變內容生成);唯 MUST 完整、無損地保存既有 `SlideDeck`/`PreviewResult` 結構於 jsonb,使來源事實不因儲存往返而遺失。
- **CR-002 Review Report**: N/A;`generationSummary` 等既有評估輸出 MUST 隨 revision 一併持久化以供回看。
- **CR-003 Web-First Output**: 維持——自包含 HTML 仍為主交付;DB 僅新增其持久化與重渲染能力。
- **CR-004 Backend-Configured LLM Boundary**: 維持——provider/model 仍為後端設定,不因 DB 化而進入請求/回應欄位;`DATABASE_URL` 同屬後端設定,不得外洩為公開欄位。
- **CR-005 Design System**: N/A 於 006(themes 僅預留結構);完整設計風格規格見 `THEME_SEED_INVENTORY.md` 與 feature 007。
- **CR-006 Semantic Titles**: N/A(不變)。
- **CR-007 Data Visualization**: N/A(不變)。
- **CR-008 TDD Coverage**: 每個 slice MUST 有對應測試:DbUserAccountStore(port 行為)、seed idempotency、auto-save 落 DB、decks 唯讀 API 的擁有權隔離、themes 表存在性與回歸。
- **CR-009 Domain Model**: 新增 domain 概念 `Deck`、`DeckRevision` 與 `DeckStore` port;`Account` 沿用既有 `UserAccount`。DB 細節不得滲入 domain。
- **CR-010 Lean Test Scope**: 測試聚焦可觀測行為與擁有權規則,避免重複測 ORM 本身。
- **CR-011 Behavior-Driven Value**: 各 user story 皆附 Given/When/Then 且可獨立展示/測試(見上)。
- **CR-012 Code Simplicity**: 範圍限定「持久化 + 唯讀查詢 + themes 結構預留」;不做編輯、不做版本 UI、不做重試佇列、themes 不灌內容(避免投機抽象)。
- **CR-013 Consistent Language**: 統一用語 `deck`、`revision`、`account`、`theme`、`style kit`,跨 API/DB/文件一致。
- **CR-014 Performance and Evidence**: 列表查詢 MUST 走 `(account_id, updated_at DESC)` 索引,效能與「全站 deck 總數」無關,只與使用者自身數量相關;重內容靠 TOAST 不影響列表。證據:migration SQL、seed 輸出、測試報告。
- **CR-015 Manual Verification**: 本機 Homebrew Postgres 的安裝/啟動、`db:migrate`/`db:seed` 為手動驗證路徑(quickstart 提供步驟)。
- **CR-016 Verification**: deck revision 的 `slide_deck` MUST 通過既有 SlideDeck 結構檢查;由其重算的 HTML MUST 通過既有 `validateGeneratedHtml`;唯讀 API 回應 MUST 符合 contract。

### Key Entities *(include if feature involves data)*

- **Account**(`accounts` 表):沿用 `UserAccount`(`id` text PK、`username` citext unique、`display_name`、`password_hash`、`active`、時間戳)。
- **Deck**(`decks` 表):一份簡報。`id` uuid、`account_id`(FK→accounts,ON DELETE CASCADE)、`title`、`status`(ready|failed)、`source_content`、`deck_brief` jsonb、`current_revision_id`(軟參照)、時間戳;索引 `(account_id, updated_at DESC)`。
- **DeckRevision**(`deck_revisions` 表):一次生成/編輯的整份快照。`id` uuid、`deck_id`(FK→decks,CASCADE)、`revision` int、`slide_deck` jsonb(事實來源)、`design_plan` jsonb、`html` text(快取)、`generation_summary` jsonb、`origin`(generation|edit)、`source_job_id`、時間戳;唯一 `(deck_id, revision)`。
- **Theme**(`themes` 表,**僅預留結構**):`id` text PK、`scope`(builtin|account)、`account_id`(FK,nullable)、`name`、`description`、`keywords` jsonb、`applies_to`(presentation|landing|dashboard|universal)、`support`(full|partial|raw)、`style_kit` jsonb、`active`、時間戳。內容由 007 灌入。

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 以 DB seed 帳號可成功登入並取得 JWT;移除 env `AUTH_ACCOUNTS` 後仍可登入(證明來源已是 DB)。
- **SC-002**: 一次成功生成後,DB 恰好新增 1 筆 deck + 1 筆 revision,且由其 `slide_deck` 重算的 HTML 與當次輸出一致。
- **SC-003**: 帳號 A 永遠無法透過 API 讀到帳號 B 的任何 deck(擁有權隔離測試 100% 通過)。
- **SC-004**: 全 monorepo 既有測試維持綠燈(domain/contracts/api/web),且新增測試覆蓋本 feature 各 slice。
- **SC-005**: `themes` 表存在且結構正確,風格產出行為與 005 無差異(回歸綠燈)。

---

## Assumptions

- 開發環境使用 Homebrew 本機 PostgreSQL 16(docker-compose 留待之後);`gen_random_uuid()` 用 PG16 內建,`citext` 需 `CREATE EXTENSION`。
- ORM 採 Drizzle(純 TS schema,契合 tsx 無 decorator metadata 的限制);driver 採 `pg`(node-postgres)。
- preview job 仍存 Redis(短暫);只有成功結果升級進 DB,用 `source_job_id` 串接。
- 「每次生成 = 一份新 deck(含一版 revision)」;編輯/版本分支留待後續 feature。
- accounts.id 維持 `text`(沿用既有 id 與 JWT `sub`),deck/revision 用 `uuid`。
- 前端範圍:後端 decks 唯讀 API 為主,前端僅做最小可用串接(列表/檢視),不含完整「我的簡報」UI 的視覺打磨。

---

## Review and Safety Notes *(mandatory for generated-content features)*

- **Assumptions to Surface**: deck 持久化不改變生成輸出本身;所存即所生成(含 `generationSummary`、review 證據),不二次加工。
- **Omitted or Compressed Content Policy**: N/A(不重新生成);完整保存既有結構,不裁切。
- **Uncertain Claims Policy**: N/A(沿用既有 review report,僅持久化)。
- **Sensitive Content Handling**: `DATABASE_URL` 與帳密雜湊屬機密,MUST NOT 進入公開 API 欄位或 log;passwordHash 僅存 scrypt 衍生值,絕不存明文;送 LLM 的內容與 005 相同,不因 DB 化而改變。
- **Evidence and Traceability**: migration SQL、seed 輸出、`source_job_id` 串起 job→deck 的可追溯鏈、測試報告皆為審查證據。
- **Manual Verification Path**: quickstart 提供本機 Postgres 安裝、`db:migrate`、`db:seed`、登入與生成的手動驗證步驟。

---

## 待釐清項目

✅ 全數於 2026-06-05 clarify session 解決,見上方 [Clarifications](#clarifications) 區。

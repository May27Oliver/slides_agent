# Research: 006 db-persistence

**Branch**: `006-db-persistence` | **Date**: 2026-06-05

Phase 0 決策記錄(DR)。每項:決定 / 理由 / 否決的替代。

---

## DR-001 ORM:Drizzle

- **決定**:Drizzle ORM(`drizzle-orm` + `drizzle-kit`)。
- **理由**:schema 是純 TS 函式、無 decorator → 契合 tsx 無 `emitDecoratorMetadata`(此限制已咬過 Nest DI / ValidationPipe / Swagger);輕量、SQL-first、型別安全;符合本專案「顯式、不要魔法」的既有風格(手接 BullMQ、手刻 OpenAPI)。
- **否決**:
  - **TypeORM** —— entity 靠 decorator + reflect-metadata 推型別,在 tsx 下不可靠。
  - **Prisma** —— 亦 tsx 安全,但多一個 codegen 步驟與較重 runtime(query engine binary),DSL 非 TS;DX 取捨後不如 Drizzle 貼合本專案。
  - **Kysely** —— 純 query builder,boilerplate 多、migration 全手寫,超出本版所需。

## DR-002 driver:pg(node-postgres)

- **決定**:`pg` Pool,經 `drizzle-orm/node-postgres`。
- **理由**:最成熟穩定、生態廣;Drizzle 一等支援。
- **否決**:`postgres.js`(較快/簡潔但團隊熟悉度低,本版不需其效能特性)。clarify 已確認預設 pg。

## DR-003 測試資料庫:pglite

- **決定**:adapter/整合測試用 `@electric-sql/pglite`(嵌入式 Postgres)+ `drizzle-orm/pglite`;domain 純對映用一般單元測試(無 DB)。
- **理由**:對真 SQL/唯一鍵/FK/擁有權過濾做測試,又**免外部 PG**(本機/CI 零依賴、deterministic)。
- **否決**:
  - 只 mock drizzle —— 測不到 SQL 與約束。
  - 要求跑真 PG 才能測 —— 提高本機/CI 門檻。

## DR-004 username 用 text + app 正規化(非 citext)

- **決定**:`username text UNIQUE`,應用層存/查皆 `trim().toLowerCase()`(沿用 005 `ConfiguredUserAccountStore` 行為)。
- **理由**:免 `CREATE EXTENSION citext`(pglite 相容性風險);正規化邏輯已存在於 005,一致。
- **否決**:citext —— 多一個 extension 依賴與測試環境風險,換來的便利有限。

## DR-005 持久化位置:worker 成功後

- **決定**:在 **worker**(`PreviewWorkerRuntime`/job 完成路徑)成功後呼叫 `DeckStore.saveNewDeck`。account_id 隨 job payload 傳遞(於 controller 建 job 時自 `req.user` 注入)。
- **理由**:worker 才是執行與產出結果之處;在此落 DB 最自然,API 端只需讀。
- **否決**:API 端輪詢到 succeeded 時才存 —— 與「worker 擁有執行」相違、競態複雜。
- **影響**:`PreviewJobRequest`/序列化需加 `accountId`(向後相容:缺則略過存檔)。worker process 需 import `DbModule`。

## DR-006 持久化失敗策略:記錄不阻斷

- **決定**:寫 DB 失敗 → 記錄內部錯誤(對齊既有錯誤形狀)、**不**改變 job 的 `succeeded`、**不**對使用者報錯。
- **理由**:生成已成功、結果已產出,不應因儲存問題讓使用者體感失敗。
- **否決**:重試佇列 —— 本版範圍外(clarify 決議,留待後續)。

## DR-007 migration 策略:顯式、不開機自動跑

- **決定**:`db:generate`(drizzle-kit 產 SQL)+ `db:migrate`(套用);API 開機不自動 migrate。
- **理由**:可審查的 SQL、避免開機副作用、生產較安全。
- **否決**:開機自動 migrate —— 隱性 schema 變更、難審查。

## DR-008 deck 建模:整份快照 + 版本表

- **決定**:`decks`(metadata + 指向最新版)+ `deck_revisions`(整份 SlideDeck jsonb 快照,每生成/編輯一版)。
- **理由**:與 domain 物件零阻抗、天生有版本/undo(為未來編輯功能鋪路)、事後補版本很痛。詳見前期討論與 `THEME_SEED_INVENTORY.md`。
- **否決**:單一可變列(無歷史)、正規化每張投影片一列(過度工程、與 jsonb 事實來源衝突)。

## DR-010 不採第三方 nestjs-drizzle 套件

- **決定**:手接 `DbModule`,不用 `knaadh/nestjs-drizzle` 等套件。
- **理由**:這類套件常依賴 decorator/反射,與本專案 tsx 無 `emitDecoratorMetadata` 衝突(已咬過 DI/ValidationPipe/Swagger);手接也契合「手接 BullMQ、手刻 OpenAPI」的一貫風格。
- **否決**:第三方整合套件 —— 多一層相依與 tsx 相容風險。

## DR-011 module 採明確 import(非 @Global)

- **決定**:`DbModule` 由 AppModule 與 WorkerModule **各自明確 import**,不標 `@Global()`。
- **理由**:沿用既有 `RedisModule` 慣例,依賴關係清楚可控。
- **否決**:`@Global()`(社群教學常見)—— 省 import 但隱藏依賴;與既有慣例不一致。

## DR-012 型別化 drizzle 實例

- **決定**:`DbService` 的 drizzle 實例型別為 `NodePgDatabase<typeof schema>`(`drizzle(pool, { schema })`);adapter 依此取得型別化查詢。
- **理由**:讓 `DbUserAccountStore`/`DrizzleDeckStore` 查詢有完整型別推導與 relational API。
- **否決**:不帶 schema 泛型 —— 失去型別保護。
- **測試註**:pglite 測試實例(`drizzle-orm/pglite`)與 `NodePgDatabase` 共享 query builder,測試以 cast 對接。

## DR-009 themes 僅建結構

- **決定**:006 建 `themes` 表結構(含 `applies_to`/`support`/`style_kit`),不灌內容、不改設計層。
- **理由**:一次把資料骨架打好,007 只加 seed 與 selection 改動,免日後再動 schema。
- **否決**:006 一併做主題系統 —— 範圍過大(006 已扛 DB+auth+deck)。

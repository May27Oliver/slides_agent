# Quickstart: 006 db-persistence(本機 PostgreSQL)

**Branch**: `006-db-persistence`

本機開發用 Homebrew PostgreSQL 16(docker-compose 留待之後)。以下為手動驗證路徑。

> 實作狀態:US1–US4 已實作並測試通過(見下方第 6 節)。`db:generate`/`db:migrate`/`db:seed` 為本 feature 新增的 npm script。

## 1. 安裝並啟動 Postgres(Homebrew)

```bash
brew install postgresql@16
brew services start postgresql@16
# 建立本機資料庫(角色預設為你的 macOS 使用者)
createdb slides_agent
```

驗證:`psql slides_agent -c '\conninfo'`。

## 2. 設定環境變數

於 `.env` 增加(`.env.example` 會同步補上):

```
DATABASE_URL=postgresql://localhost:5432/slides_agent
```

- 缺少 `DATABASE_URL` 時 API/worker 啟動會 fail fast。

## 3. 產生並套用 migration

```bash
pnpm db:generate   # drizzle-kit 由 schema.ts 產出 SQL 到 apps/api/src/infra/db/migrations
pnpm db:migrate    # 套用 migration(建立 accounts/decks/deck_revisions/themes)
```

- migration **不在 API 開機時自動執行**,需顯式跑。

驗證:`psql slides_agent -c '\dt'` 應見四張表;`\d themes` 欄位符合 data-model。

## 4. 灌入帳號(seed)

沿用既有 `AUTH_ACCOUNTS`(JSON,passwordHash 由 `pnpm auth:hash` 產)。

```bash
# 若還沒有帳號雜湊:
pnpm auth:hash            # 互動輸入密碼,輸出 scrypt hash
# 設好 .env 的 AUTH_ACCOUNTS 後:
pnpm db:seed              # idempotent:upsert 進 accounts
```

驗證:`psql slides_agent -c 'select id, username, active from accounts;'`。

## 5. 端到端手動驗證

```bash
pnpm --filter @slides-agent/api dev      # 啟 API(另開 worker 與 redis,見既有 dev 腳本)
```

1. 登入:`POST /api/auth/login`(用 seed 帳號)→ 取得 JWT。
   - 移除 `.env` 的 `AUTH_ACCOUNTS` 後重啟,仍能登入 → 證明帳號來源已是 DB。
2. 生成:帶 JWT 送出 preview 請求 → 等 job 成功。
3. 查 DB:`select id, account_id, title from decks;` 應見一筆;`select deck_id, revision, origin from deck_revisions;` 應見 `revision=1, origin='generation'`。
4. 查 API:`GET /api/decks`(帶 JWT)列出自己的;`GET /api/decks/:id` 看到 `currentRevision` 內容。
5. 隔離:用另一帳號的 JWT 取前者的 deckId → 回 `DECK_NOT_FOUND`。

## 6. 實作狀態

- [x] DbModule + DATABASE_URL config(fail fast)
- [x] Drizzle schema + migration(accounts/decks/deck_revisions/themes)
- [x] DbUserAccountStore 取代 ConfiguredUserAccountStore
- [x] db:seed(AUTH_ACCOUNTS → accounts,idempotent)
- [x] createDeckFromPreviewResult 純函式 + 測試
- [x] worker 成功後 auto-save(持久化失敗只記錄不阻斷)
- [x] DeckStore port + DrizzleDeckStore
- [x] GET /api/decks、/api/decks/:id(JwtAuthGuard + 擁有權隔離)
- [x] 前端最小「我的簡報」列表/檢視
- [x] OpenAPI 文件補 decks 端點
- [x] themes 表結構預留(006 空表;seeds 留待 007)

## 7. 驗證證據(T051)

本機環境:Homebrew `postgresql@17`、DB `slides_agent`、migration `0000_clever_silver_samurai.sql` 已套用。

### (A) migration 後的 schema

四張表皆存在,索引齊全:

```
accounts        accounts_pkey, accounts_username_unique
decks           decks_pkey, decks_account_updated_idx (account_id, updated_at)
deck_revisions  deck_revisions_pkey, deck_revisions_deck_rev_idx UNIQUE (deck_id, revision)
themes          themes_pkey, themes_scope_idx, themes_account_idx, themes_select_idx (applies_to, support)
```

FK:`deck_revisions.deck_id → decks.id`、`decks.account_id → accounts.id`、`themes.account_id → accounts.id`(皆 `ON DELETE cascade`)。

### (B) seed 輸出(idempotent)

```
$ pnpm db:seed
Seeded 1 account(s).

$ psql slides_agent -c 'select id, username, active from accounts;'
     id      |        username         | active
-------------+-------------------------+--------
 oliver.chen | oliverskychen@gmail.com | t
```

### (C) EXPLAIN 走索引

資料量小,planner 預設選 seq scan(成本更低),故以 `set enable_seqscan=off` 證明查詢「能且會」走目標索引。

列表查詢(`where account_id=? order by updated_at desc`)→ 走 `decks_account_updated_idx`:

```
Bitmap Heap Scan on decks
  Recheck Cond: (account_id = 'oliver.chen'::text)
  ->  Bitmap Index Scan on decks_account_updated_idx
        Index Cond: (account_id = 'oliver.chen'::text)
```

revision 查詢(`where deck_id=? and revision=?`)→ 走唯一索引 `deck_revisions_deck_rev_idx`:

```
Index Scan using deck_revisions_deck_rev_idx on deck_revisions
  Index Cond: ((deck_id = '…'::uuid) AND (revision = 1))
```

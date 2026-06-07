# HTML 簡報生成器（HTML Slides Agent）

[English](README.md) · **繁體中文**

把原始文字（筆記、逐字稿、報告）轉成**可預覽、可下載的 HTML 簡報**——在本機執行,採用「LLM 輔助、確定性渲染」的流程。

貼上或上傳內容、選一種簡報風格,系統會規劃投影片、設計視覺系統,並產出一份 self-contained 的 16:9 HTML 簡報,可在 App 內預覽,也可下載成單一檔案。

---

## 功能特色

- **內容 → 簡報 pipeline**:語意切段 → 大綱規劃 → 設計規劃 → HTML 渲染 → 驗證。
- **LLM 輔助、確定性渲染**:LLM 負責語言／結構／設計「選型」;最終 HTML 由確定性、reference 級的模板渲染器產生(快、免費、穩定、必過驗證)。
- **UIUX Pro Max 設計系統**:依簡報需求挑選策展調色盤＋字型配對＋具體 style kit(字級、動態、效果)。見 [`docs/design.md`](docs/design.md)。
- **非同步預覽工作流**:送出工作 → 輪詢進度 → 取得結果,含逾時、失敗回報與可取消的輪詢 UI。
- **Self-contained 輸出**:單一 HTML 檔、inline CSS/JS、鍵盤導覽,唯一的外部資源是 Google Fonts。
- **忠於來源**:驗證器把關投影片順序、內容忠實度與數字保真,不捏造事實。
- **沒有 API 金鑰也能跑**:`OPENAI_API_KEY` 留空時,流程會走確定性 fallback。

---

## 架構

pnpm monorepo,核心領域邏輯乾淨、App 外殼輕薄。

| 套件 | 名稱 | 角色 |
|---|---|---|
| `packages/domain` | `@slides-agent/domain` | 純領域邏輯:切段、大綱/版面規劃、設計系統、渲染、預覽工作生命週期。無 I/O。 |
| `packages/contracts` | `@slides-agent/contracts` | 共用的請求/回應契約 + 執行期驗證器。 |
| `apps/api` | `@slides-agent/api` | NestJS 後端:REST 端點、LLM adapter(port)、預覽工作 store/runner。 |
| `apps/web` | `@slides-agent/web` | React + Vite 前端:輸入表單、風格預設、工作輪詢、預覽。 |

### 生成 pipeline

```
sourceContent + deckBrief
        │
        ▼ content_planning   語意切段（LLM,含確定性 fallback）
        ▼ deck_planning      大綱 + LLM 精修（來源忠實守門）
        ▼ design_planning    UIUX Pro Max 設計系統 + 策展 style kit 選型
        ▼ html_generation    確定性 reference 級模板渲染器
        ▼ html_validation    self-contained / 順序 / 內容 / 設計 檢查
        ▼
   PreviewArtifact（self-contained HTML）
```

LLM 呼叫都藏在 port 之後(adapter 模式);沒有設定金鑰時,每個階段都會確定性 fallback。HTML 階段為 **template-primary**:最終 HTML 由確定性渲染器產出,所以又快又一致、必過驗證。

---

## 環境需求

- Node.js `20.19.5`
- pnpm `10.30.3`（這是 **pnpm** 專案——請勿使用 `yarn`／`npm`）

> 專案在 `package.json` 釘了 `packageManager: pnpm@10.30.3`。若有 Corepack,執行 `corepack enable` 會自動使用正確版本。

## 安裝設定

```bash
cp .env.example .env      # 接著填入 OPENAI_API_KEY（可選）
pnpm install
```

## 設定（環境變數）

所有 LLM 設定都是**後端專用**,不會外洩到前端或 API 回應。設在根目錄 `.env`:

| 變數 | 預設 | 說明 |
|---|---|---|
| `PORT` | `3000` | API 伺服器埠號。 |
| `LLM_PROVIDER` | `openai` | LLM 供應商(僅支援 `openai`)。 |
| `OPENAI_API_KEY` | — | OpenAI 金鑰。**留空 → 走確定性 fallback**(App 仍可用)。 |
| `LLM_MODEL` | — | 所有 LLM 操作的預設模型。 |
| `SEMANTIC_SEGMENTATION_MODEL` | `LLM_MODEL` | 可選的單一操作模型覆寫。 |
| `DESIGN_PLANNING_MODEL` | `LLM_MODEL` | 可選的單一操作模型覆寫。 |
| `LLM_MAX_REPAIR_ATTEMPTS` | `1` | 驗證型 LLM 輸出的修補次數上限。 |
| `PREVIEW_RATE_LIMIT_MAX` | `5` | 每個來源 IP 在時間窗內的預覽 POST 上限。 |
| `PREVIEW_RATE_LIMIT_WINDOW_MS` | `60000` | rate-limit 時間窗(毫秒)。 |
| `REDIS_URL` | — | **必要**(004)。預覽 job 佇列用的 Redis;沒有則 API/worker fail-fast。 |
| `AUTH_JWT_SECRET` | — | **必要**(005)。簽發登入 JWT 的密鑰;沒有則 API fail-fast。 |
| `AUTH_JWT_EXPIRES_IN` | `30d` | JWT 有效期。 |
| `AUTH_ACCOUNTS` | `[]` | JSON 帳號白名單 `[{ id, username, displayName, passwordHash, active }]`;`passwordHash` 用 `pnpm auth:hash <密碼>` 產生。 |
| `AUTH_LOGIN_RATE_LIMIT_MAX` | `10` | 每 IP 每時間窗 `POST /api/auth/login` 上限。 |
| `AUTH_LOGIN_RATE_LIMIT_WINDOW_MS` | `60000` | 登入 rate-limit 時間窗(毫秒)。 |
| `VITE_API_PROXY_TARGET` | `http://localhost:3000` | (web)dev 伺服器的 API proxy 目標。 |

### 登入(功能 005)

要先登入才能使用 app 與生成端點。帳號是站方設定的白名單(無公開註冊)。新增帳號:

```bash
pnpm auth:hash '密碼'    # 印出 scrypt passwordHash
# 貼進 .env 的 AUTH_ACCOUNTS:
# [{ "id":"user_owner","username":"owner@example.com","displayName":"Owner","passwordHash":"<貼上>","active":true }]
```

Auth 端點:`POST /api/auth/login`、`GET /api/auth/me`、`POST /api/auth/logout`。
JWT 存在瀏覽器 `localStorage`;預覽端點需帶 `Authorization: Bearer <jwt>`。

---

## 本機執行

預覽生成以**非同步 job**形式跑在 **Redis + BullMQ** 佇列上,由一個獨立的
**worker** 程序消費——這樣 LLM 在生成時 API 仍能即時回應。Redis 為**必要**,
請先啟動(本機用 Homebrew):

```bash
brew install redis        # 第一次
brew services start redis # 背景服務,127.0.0.1:6379
# 或前景執行:redis-server
```

> 本機沒有 Redis?任何連得到的實例都行,把 `REDIS_URL` 指過去即可。想用即丟容器:
> `docker run --rm -p 6379:6379 redis:7`。

Redis 起好後,一個指令把目前 iTerm2 分頁切成三個 pane:API + worker + web
(若連不到 Redis 會提醒):

```bash
pnpm dev:iterm
```

或分別手動啟動各程序:

```bash
# 後端 API（watch 模式,變更自動重啟）→ http://localhost:3000
pnpm --filter @slides-agent/api dev

# 預覽 job worker（獨立、非 HTTP 程序;消費佇列）
pnpm --filter @slides-agent/api worker:dev

# 前端（Vite HMR）→ http://localhost:5173
pnpm --filter @slides-agent/web dev -- --host localhost --port 5173
```

開啟 <http://localhost:5173>。前端 dev 伺服器會把 `/api/*` proxy 到 API(可用 `VITE_API_PROXY_TARGET` 覆寫)。

### 煙霧測試

```bash
curl -I http://localhost:5173/                                 # 前端存活
curl -i http://localhost:3000/api/slides/preview-jobs/example   # → 404 PREVIEW_JOB_UNAVAILABLE
```

### 資料庫 console

兩種方式可在 terminal 檢視已存的帳號／簡報(兩者只需 `DATABASE_URL`):

```bash
pnpm db:repl     # NestJS REPL — 互動式 terminal console
pnpm db:studio   # Drizzle Studio — 瀏覽器視覺化介面(local.drizzle.studio)
```

`db:repl` 會啟動「只含 DB」的 NestJS context(不連 Redis／worker,只需 `DATABASE_URL`)。進去後:

```js
> help()                                          // 列出 REPL 指令
> debug()                                          // modules / providers
> methods(DrizzleDeckStore)                        // 某 provider 的方法
> await get(DbService).pool.query('select id, title, status from decks')  // 原生 SQL
> await get(DrizzleDeckStore).listByAccount('user_owner')                 // 型別化查詢
> await get(DbUserAccountStore).findByUsername('owner@example.com')
```

> `db:studio` 的編輯是即時寫入、無 undo——操作正式資料請小心。

### 新增資料庫欄位(migration)

schema 採 **code-first**,定義在 `apps/api/src/infra/db/schema.ts`。要新增或修改欄位,
先改這個檔,再產生並套用 migration:

```bash
# 1. 編輯 apps/api/src/infra/db/schema.ts 裡的 table
#    例如在 decks 表加 `summary: text("summary")`。

pnpm db:generate   # drizzle-kit 比對 schema.ts → 在 src/infra/db/migrations 產出新 SQL
pnpm db:migrate    # 把待套用的 migration 套到 DATABASE_URL
```

- 套用前**先檢視產出的 SQL** —— 打開 `apps/api/src/infra/db/migrations/` 下的新檔確認 diff。
  drizzle-kit 會自動命名(如 `0001_*.sql`)。
- migration **不會在 API/worker 開機時自動執行**,一定要顯式跑 `pnpm db:migrate`(部署時也是)。
  產出的 SQL 與 `meta/` 快照都會 commit 進 git,所以每個環境都會依序套用相同 migration。
- 用 `pnpm db:studio` 或 `psql "$DATABASE_URL" -c '\d decks'` 驗證。

> 破壞性變更(drop/rename 欄位)可能遺失資料——drizzle-kit 可能會詢問;請先檢視 SQL 並備份正式資料。

---

## API

互動式 OpenAPI 文件(Swagger UI):**`/api/docs`**(原始 spec 在 `/api/docs-json`)。schema 來自共用的 `@slides-agent/contracts` 套件。

基底路徑:`/api/slides`

| 方法 | 路徑 | 說明 |
|---|---|---|
| `POST` | `/preview` | 同步生成預覽,回傳完整 artifact。 |
| `POST` | `/preview-jobs` | 建立非同步預覽工作 → `202`,含 `jobId` 與 `statusUrl`。 |
| `GET` | `/preview-jobs/:jobId` | 輪詢工作狀態/結果(未知或過期 → `404 PREVIEW_JOB_UNAVAILABLE`)。 |

請求 body(兩個 POST 通用):

```jsonc
{
  "sourceContent": "…你的筆記/逐字稿…",        // 必填,≤ 50,000 字
  "deckBrief": {
    "purpose": "面試",                          // 必填
    "audience": "長官",                         // 必填
    "styleDirection": "專業商務",               // 可選,引導設計 kit
    "chartEmphasis": "…",                       // 可選
    "segmentationGuidance": "…",                // 可選
    "language": "zh-TW"                          // 可選
  }
}
```

兩個 POST 端點**共用**同一個 per-IP rate-limit 預算;來源與簡報欄位都有長度上限。

---

## 測試與驗證

### 單元／整合測試（vitest）

```bash
pnpm test                                   # 全部套件，依序：domain → contracts → api → web
pnpm test:domain                            # 單一套件（另有 test:contracts / test:api / test:web）
pnpm --filter @slides-agent/domain test     # 等價的 per-package 寫法
pnpm --filter @slides-agent/web test:e2e    # Playwright E2E（web）
```

型別檢查用各套件的 `build` script（no-emit `tsc`），例如 `pnpm --filter @slides-agent/domain build`。

### 驗證 harness（`apps/api`）

確定性 dev 腳本——**不需前端、LLM 或 DB**。它們讀已 commit 的 theme 種子，把可預覽 HTML 寫到 `apps/api/preview/`（git-ignored）。

| 腳本 | 目的 | 執行 |
|------|------|------|
| `preview:deck` | 把一份 markdown 餵進**確定性** deck pipeline；印出每張圖判到的「語意 → 具體圖型（bar/line/pie/…）」與選到的主題，並寫出 `preview/deck.html`。用來驗證**你的內容**會不會正確成圖。 | `pnpm --filter @slides-agent/api preview:deck [檔案.md] [styleDirection]`<br>（預設 `sample-deck-input.md`） |
| `preview:chart-matrix` | 渲染「每種支援圖表 × 每個已啟用風格」（20 × 7）到 `preview/chart-matrix/index.html`；遇到非預期 fallback 或外部資源就**失敗**。用來抓某風格下圖表壞掉。 | `pnpm --filter @slides-agent/api preview:chart-matrix` |
| `preview:themes` | 渲染所有已啟用風格的主題畫廊——肉眼檢視設計系統。 | `pnpm --filter @slides-agent/api preview:themes` |

範例：

```bash
# 驗證範例 deck（區域 → bar、季度 → line、裝置 → pie）
pnpm --filter @slides-agent/api preview:deck

# 驗證 preset 區隔（例如給一個科技風格方向）
pnpm --filter @slides-agent/api preview:deck sample-deck-input.md "tech startup developer 科技"
```

> 改了 theme 種子 JSON（`apps/api/src/infra/db/seeds/*.json`）後，要跑 `pnpm db:seed` 才會在執行中的 app 與 `preview:deck` 的主題選擇生效。

---

## 專案結構

```
apps/
  api/        NestJS 後端（controller、LLM adapter、預覽工作 store/runner）
  web/        React + Vite 前端（表單、風格預設、輪詢、預覽）
packages/
  domain/     純領域邏輯（切段、deck/design/render、preview-job）
  contracts/  共用契約 + 驗證器
docs/
  design.md   設計系統架構 + 如何新增設計 skill
specs/        功能規格（003-async-preview-jobs）
```

---

## 備註

- **沒金鑰也能用**:每個 LLM 階段都有確定性 fallback;品質會優雅降級,不會壞掉。
- **Self-contained 輸出**:產出的 HTML 只外連 Google Fonts,其餘全部 inline;預覽在 sandboxed iframe 內執行。
- **設計可擴充**:要新增設計 skill(調色盤/字型/風格),見 [`docs/design.md`](docs/design.md) 的 provider/registry 指南。

# Feature Specification: 容器化部署（Docker Compose 一鍵起前後端 + worker + Redis/Postgres，上正式機）

<!-- This project writes Spec Kit artifacts in Traditional Chinese by default. -->
<!-- STATUS: Ready for planning — 3 個關鍵決策已於 2026-06-10 clarify 定案；可進 plan。 -->

**Feature Branch**: `012-docker-compose-deploy`

**Created**: 2026-06-10

**Status**: Ready for planning（關鍵決策已定案；plan / tasks 待展開）

**Input**: User description：「幫這個專案建立前後端 docker compose，我想上正式機。」

---

## 背景與目標

目前專案只有本機開發路徑：`pnpm dev:iterm`（iTerm 三 pane 跑 API + worker + web）、各程序用 `node --env-file=../../.env --import tsx ...` 直接吃根目錄 `.env`、Redis/Postgres 靠開發者本機 Homebrew 自備。**沒有任何容器化或正式機部署產物**（repo 內無 Dockerfile / compose）。

要上正式機，必須把這條手動、依賴本機環境的啟動流程，變成**可重現、可一鍵帶起的部署單元**。

**執行期的硬事實（已從程式碼確認，作為設計輸入）：**

1. **三個 Node 長駐程序**：
   - **API**（HTTP，NestJS）— `apps/api/src/main.ts`，listen `process.env.PORT ?? 3000`、host `process.env.HOST ?? "127.0.0.1"`。
   - **worker**（非 HTTP，BullMQ 消費者）— `apps/api/src/worker/worker.main.ts`，自帶 `DB_POOL_ROLE=worker`（較小連線池）。
   - **web**（前端）— Vite build 出**靜態檔**；正式機不需 Node 跑前端，但需要有東西「服務靜態檔 + 把 `/api/*` 反代到 API」。
2. **以 tsx runtime 執行**：`apps/api` 沒有 transpile 產物（`build` 只是 `tsc --noEmit` 型別檢查）。正式機同樣以 `node --import tsx src/main.ts` 跑，image 必須包含原始碼與 `tsx`。
3. **API 預設只 listen `127.0.0.1`**：容器內必須以 `HOST=0.0.0.0` 啟動，否則外部（含同 compose 的反代）連不到。
4. **強相依且 fail-fast**：**API** 缺 `DATABASE_URL`（Postgres）/ `REDIS_URL`（Redis）/ `AUTH_JWT_SECRET` 任一即啟動失敗；**worker** 不載 AuthModule，僅對 `DATABASE_URL` / `REDIS_URL` fail-fast（不需 `AUTH_JWT_SECRET`）。
5. **前端以相對路徑 `/api/*` 呼叫**：Vite proxy 只在 dev 生效；正式機需由反向代理把 `/api` 導到 API、其餘路徑走 SPA fallback（react-router）。
6. **Migration 不在開機時自動跑**（憲章與既有慣例）：schema code-first，靠顯式 `pnpm db:migrate`（`scripts/db-migrate.ts`）套用；seed（`scripts/db-seed.ts`）含主題庫 220 列 + 帳號白名單。
7. **所有 LLM/密鑰設定皆後端 env、絕不進前端 bundle**（CR-004）：`OPENAI_API_KEY`、`AUTH_JWT_SECRET`、`DATABASE_URL`、`AUTH_ACCOUNTS` 等只能在後端容器，不可 build 進 web 靜態檔。

**目標**：產出一套 **production 導向的 Docker Compose 部署**，讓維運者在一台主機上以**單一指令**帶起完整堆疊（nginx 邊緣 + api + worker + postgres + redis + 一次性 migrate+seed job），環境變數由 `.env` 注入、資料以具名 volume 持久化、migration 由獨立一次性 job 在 api 對外服務前自動完成、映像不內嵌任何密鑰。

---

## 已定案決策（2026-06-10 clarify）

> 以下三項已確認，作為 plan 的固定前提。

1. **Postgres / Redis 來源 = 都包進 compose（含具名 volume）**。compose 內直接跑 `postgres` 與 `redis` 服務；資料以具名 volume 持久化。單機自包式部署。
   → plan 需含 `postgres`/`redis` service、volume、healthcheck，以及「app 等依賴就緒才起」的依賴表達。

2. **對外邊緣 = compose 內 nginx 反代（HTTP only；TLS 由上游處理）**。nginx 服務 web 靜態檔 + 反代 `/api` → api，對外只開 80。TLS/憑證交給上游 LB / Cloudflare；compose 內不終結 TLS。
   → plan 需含 `nginx`（或同義邊緣）service、SPA fallback 設定、`ALLOWED_ORIGIN` 設為對外網域、`TRUST_PROXY=1`（取得真實 client IP）。

3. **DB migration + seed = 部署時皆自動**。一次性 `migrate` job 在 api/worker 之前自動套用 migration；seed（主題庫 + 帳號白名單）亦自動執行。沿用**現有 seed 語意**（不在本 feature 改動其交易邊界，詳見 FR-009）：accounts 與 themes 各為 idempotent upsert、theme batch 為 all-or-nothing，故重複部署安全。
   → plan 需定義一次性 job container（與 api 共用 image，依序跑 `db:migrate` →（成功後）`db:seed`），api/worker `depends_on` 其成功完成；seed 來源帳號取自 `AUTH_ACCOUNTS` env。

---

## 已鎖定的範圍決策

1. **產物形式 = Docker Compose（單一 compose 檔，production 導向）**，搭配 per-app `Dockerfile`。不納入 Kubernetes / Swarm / Terraform（超出本 feature）。
2. **API 與 worker 共用同一個 image**（同一份程式碼、`apps/api`），以**啟動指令不同**區分（`src/main.ts` vs `src/worker/worker.main.ts`）。避免重複建置。
3. **web 為靜態產物**：在 build 階段 `vite build`，正式機由邊緣容器服務靜態檔，**不跑 Node 服務前端**。
4. **執行期沿用 tsx**（不另外導入編譯到 dist 的建置鏈），維持與現行行為一致、降低風險；image 內含 `apps/api` 原始碼 + workspace 套件（`packages/domain`、`packages/contracts`）+ `tsx`。
5. **設定全部由環境注入**：沿用既有 env **變數名稱契約**（以 `.env.example` 為準），production 範本由 `.env.production.example` 提供；compose 以 `env_file`/`environment` 提供；**映像不內嵌密鑰**，`.env`/憑證不進 image、不進 git。
6. **Migration 由獨立一次性 job 在 API 對外前自動完成**，維持「不在 API 程序 boot 時隱式 migrate」的憲章慣例（migrate 是專屬 job，不塞進 API 容器啟動腳本）；job 由 compose 自動觸發以達成部署一鍵化。
7. **不做**：CI/CD pipeline、自動化部署腳本、雲端供應（IaC）、多主機編排、藍綠/金絲雀、監控與告警堆疊、image registry 發佈流程。本 feature 只交付「可在一台主機 `docker compose up` 帶起正式堆疊」的產物與文件。
8. **不改動應用程式行為（除最小必要調整）**：唯一允許的 app 變更為「為容器化必要的最小調整」，明確包含：(i) 新增一個**免認證、回 200 的輕量 `GET /api/health`** endpoint 供 healthcheck（2026-06-10 clarify 定案）；(ii) host/CORS 等由 env 控制的範本。除此之外不更動既有 API/worker/前端的功能邏輯。

9. **healthcheck 範圍 = API 有、worker 無**（2026-06-10 clarify 定案）：API 以 `/api/health` 做 healthcheck，語意僅為 **liveness（HTTP server 活著）**；nginx 可據此作為「api HTTP 已就緒」的 `depends_on` 依據，但 **DB/Redis 的就緒判斷只歸 postgres/redis 各自的 healthcheck**（見 FR-007/FR-018/FR-019），`/api/health` 不代表後端依賴就緒。**worker 為非 HTTP 程序，不做 healthcheck**，改以 `restart: unless-stopped` 由 Docker 在 crash/fail-fast 退出時自動重起。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 一鍵帶起正式堆疊（Priority: P1）

維運者在一台乾淨主機上（已裝 Docker + Compose）取得 repo、填好正式 `.env`（密鑰、`OPENAI_API_KEY`、`AUTH_JWT_SECRET`、`AUTH_ACCOUNTS`，以及 Postgres 的 user/password/db 名），執行**單一 `docker compose up`（build + 起服務）**，即可得到一個對外可用的網站：能開登入頁、登入後送出生成、輪詢、預覽、下載 HTML。

> 註：`DATABASE_URL` / `REDIS_URL` 在 production 範本中**固定指向 compose 內部服務**（`postgresql://<user>:<pass>@postgres:5432/<db>`、`redis://redis:6379`），維運者只需填 DB 帳密與 db 名，不需自行組外接連線字串（本 feature 不支援 managed 外接模式）。

**Why this priority**：這是「上正式機」的核心交付；沒有它其餘都不成立。涵蓋全堆疊整合（邊緣 → API → worker → Redis/Postgres）一次驗證。

**Independent Test**：在乾淨環境填妥 `.env` 後 `docker compose up -d`；待 healthcheck 轉綠 → 對網站根路徑取得登入頁、`/api/auth/login` 可登入、提交一個 preview job 並輪詢到完成、下載產物。全程不需手動進容器補裝任何東西。

**Independent Demo**：螢幕錄製從 `docker compose up` 到瀏覽器完成一次生成+下載。

**Acceptance Scenarios**：
1. **Given** 乾淨主機 + 已填正式 `.env`，**When** `docker compose up -d --build`，**Then** 受 healthcheck 監測的服務（nginx / api / postgres / redis）轉 healthy、worker 維持 running 且 restart policy 生效，網站首頁（SPA）可開啟。
2. **Given** 堆疊已起，**When** 透過瀏覽器登入並提交一次非同步生成，**Then** job 由 worker 消費並於合理時間內完成，前端可預覽並下載 self-contained HTML。
3. **Given** API 容器以 `HOST=0.0.0.0` 啟動，**When** 邊緣容器把 `/api/*` 反代到 API，**Then** 前端的相對路徑請求成功（非 CORS 阻擋、非 connection refused）。
4. **Given** 缺少必填設定，**When** 啟動，**Then** 相關程序 fail-fast 並在 log 留明確原因（不靜默壞掉）：**API** 缺 `AUTH_JWT_SECRET` / `DATABASE_URL` / `REDIS_URL` 任一即失敗；**worker** 不載 AuthModule，僅對其執行期必要設定（`DATABASE_URL` / `REDIS_URL`）fail-fast，不因缺 `AUTH_JWT_SECRET` 而擋啟動。

### User Story 2 - 資料持久化與安全重啟（Priority: P2）

維運者重啟主機或 `docker compose restart` 後，**已登入帳號、已生成並存檔的 decks、主題庫**仍在；重啟不丟資料、不需重跑 seed。

**Why this priority**：正式機資料不可因重啟蒸發；驗證 Postgres 具名 volume 與 migration 狀態的正確性。

**Independent Test**：生成並存一份 deck → `docker compose down`（不加 `-v`）再 `up` → 該 deck 仍可在「我的簡報」看到；主題庫仍可瀏覽。

**Acceptance Scenarios**：
1. **Given** 已存在 deck 與帳號，**When** `docker compose down` 後再 `up`（保留 volume），**Then** deck 與帳號仍存在、可正常登入與讀取。
2. **Given** 容器重啟，**When** API/worker 重新連線 Redis/Postgres，**Then** 連線池正常建立、不因暫時性連線競賽而崩潰（依賴服務先就緒）。

### User Story 3 - 部署時自動套用 schema migration 與 seed（Priority: P3）

部署時，一次性 job **自動依序**跑 `db:migrate` →（成功後）`db:seed`，並在該 job 成功完成後才放行 api/worker 啟動。維運者不需手動操作；文件另提供手動 rerun / 除錯命令（進容器重跑同一 job 指令）供升級或排錯時使用。此 job 與 API 程序的 boot 解耦（migration 不在 API boot 時隱式執行），維持憲章慣例又達成部署自動化。

**Why this priority**：兼顧「migration 不在 API 開機時自動跑」的憲章慣例與「部署一鍵到位」；升級可控、可回顧。

**Independent Test**：對一個空 DB 啟動堆疊 → migrate+seed job 自動跑完（schema 建立、主題庫 220 列就位）→ api 隨後啟動；重複部署時 job 再跑為 idempotent（themes batch 不重複；accounts upsert 不重複）。

**Acceptance Scenarios**：
1. **Given** 空的正式 DB，**When** `docker compose up`，**Then** migrate+seed job 自動依序執行成功，api/worker 在其成功後才啟動。
2. **Given** 堆疊已部署過一次，**When** 再次 `docker compose up`（job 再跑），**Then** migrate 無待套用變更、seed 為 idempotent upsert（不產生重複資料）。
3. **Given** migrate+seed job 尚未成功（migrate 失敗或 theme seed 驗證失敗），**When** 啟動，**Then** api/worker 因 `depends_on` 條件不被放行，不會在未就緒的 schema 上對外服務（不出現「表不存在」執行期錯誤）。
4. **Given** 需要排錯或補跑，**When** 維運者依文件手動重跑該 job 指令，**Then** 可獨立重跑且因 idempotent 而安全。

### Edge Cases

- **依賴服務尚未就緒**：Postgres/Redis 還在啟動時 API/worker 先起 → 以 `depends_on: condition: service_healthy`（綁 postgres/redis 的 healthcheck）gate app 啟動，避免啟動競賽直接 crash 退出。
- **API 只 listen 127.0.0.1**：若忘了設 `HOST=0.0.0.0`，邊緣會 connection refused — 部署範本必須預設帶上。
- **CORS 與反代**：同源反代下前端與 API 同網域，理論免 CORS；但 `NODE_ENV=production` 時 API 會依 `ALLOWED_ORIGIN` 限制 → 範本需給出與部署網域一致的值，且 `TRUST_PROXY=1`（讓登入 rate-limit 取得真實 client IP）。
- **密鑰外洩面**：`.env`/憑證/`AUTH_ACCOUNTS` 不可進 image layer、不可進 git；web 靜態 bundle 不可含任何後端密鑰。
- **down -v 誤刪資料**：文件需明確標示 `-v` 會清掉資料 volume 的風險。
- **映像體積/建置**：tsx runtime + 整個 workspace 進 image 的體積與 build 快取；`node_modules`、`apps/*/preview`、測試產物應排除（`.dockerignore`）。
- **記憶體/逾時**：LLM job 可能長時間執行（既有設計刻意不給 OpenAI fetch timeout）；worker 容器不應被過低的記憶體/OOM 設定誤殺（worker 無 healthcheck，故不會被探測逾時殺掉）。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 提供 per-app `Dockerfile`，能在乾淨主機上重現建置出 API（含 worker，共用 image）與 web 靜態產物的映像；**主機只需 Docker（+ Compose），不需預裝 Node/pnpm** — 建置所需的 Node/pnpm（透過 corepack）皆在 Dockerfile 內取得。
- **FR-002**: 系統 MUST 提供單一 production 導向的 `docker compose` 設定，一個指令即可帶起完整堆疊（nginx 邊緣 + api + worker + postgres + redis + 一次性 migrate+seed job）。
- **FR-003**: API 容器 MUST 以 `HOST=0.0.0.0` 對容器網路提供服務，並可由 env 覆寫 `PORT`。
- **FR-004**: 邊緣服務 MUST 服務 web 靜態檔，並將 `/api/*` 反向代理至 API 容器；非 `/api` 路徑 MUST 走 SPA fallback（回 `index.html`，支援 react-router 深連結）。
- **FR-005**: 所有設定 MUST 由環境注入（沿用 `.env.example` 既有變數名）；映像 MUST NOT 內嵌任何密鑰；`.env`/憑證 MUST NOT 進 image 或 git。
- **FR-006**: web 靜態 bundle MUST NOT 含任何後端密鑰或後端專用設定（維持 CR-004 邊界）。
- **FR-007**: 依賴就緒 gate MUST 由 **postgres / redis 各自的 healthcheck**（如 `pg_isready`、redis `PING`）表達：api / worker / migrate-job MUST `depends_on` 兩者 healthy 才啟動，避免啟動競賽導致 crash。**不得**以 `/api/health`（liveness，見 FR-018）作為「DB/Redis 已就緒」的證明 —— DB pool 為 lazy connect，HTTP 200 不代表後端依賴已連上。
- **FR-008**: 系統 MUST 以**獨立的一次性 job**（非 API 容器開機腳本內隱式執行）在 API 對外服務前套用 DB migration；維持「不在 API 程序 boot 時隱式 migrate」的憲章慣例，即使該 job 由 compose 自動觸發。
- **FR-009**: 該一次性 job MUST 於 migrate 成功後自動執行 seed（帳號白名單取自 `AUTH_ACCOUNTS`、主題庫取自既有 seeds），沿用**現有 seed 語意**：accounts 與 themes 皆為 **idempotent upsert**；**theme batch 為 all-or-nothing**（任一列無效即整批中止）；accounts 先於 themes 獨立 commit（故 theme 驗證失敗時 accounts 可能已寫入，但因 idempotent 故重跑安全）。seed 以非零退出碼失敗時 MUST 阻擋 job 成功（進而擋住 api/worker 啟動）。本 feature **不**改動既有 seed 的交易邊界。
- **FR-010**: 系統 MUST 以具名 volume 持久化 Postgres（及視需要 Redis）資料，使「保留 volume 的重啟」不丟資料；文件 MUST 標示清除 volume（如 `down -v`）的破壞性。
- **FR-011**: 系統 MUST 提供 production 範本 `.env.production.example`（變數名沿用 `.env.example` 契約）與一份部署說明（README/部署文件），涵蓋必填密鑰、`ALLOWED_ORIGIN`/`TRUST_PROXY`、正規 `cp .env.production.example .env` 流程、migrate/seed 步驟、啟停與資料風險。
- **FR-012**: 建置 MUST 透過 `.dockerignore` 排除 `node_modules`、本機 `.env`、`apps/*/preview`、測試/E2E 產物等非執行期內容，控制映像體積與避免洩漏。
- **FR-013**: worker 容器 MUST 能承受長時間執行的生成 job（不被過低的資源限制 / OOM 設定誤殺），對應既有「不給 OpenAI fetch timeout」的設計。（worker 無 healthcheck，見 FR-019。）
- **FR-014**: 容器 MUST 正確處理停止訊號（沿用 app 既有的 `enableShutdownHooks`）以利優雅關閉（關閉 Redis 連線、佇列、sweep）。

*以下為 clarify 定案後的明確 FR：*

- **FR-015**: 系統 MUST 在 compose 內含 `postgres` 與 `redis` 服務，各以具名 volume 持久化資料，並提供 healthcheck 供 app 依賴判斷就緒。
- **FR-016**: 系統 MUST 在 compose 內以 nginx 邊緣服務 web 靜態檔並反代 `/api` → api，對外只開 HTTP（80）；TLS 由上游處理。部署範本 MUST 將 `ALLOWED_ORIGIN` 設為對外網域、`TRUST_PROXY=1`，使 production CORS 與登入 rate-limit 的 client IP 正確。
- **FR-017**: 系統 MUST 在部署時以一次性 job 自動依序執行 `db:migrate` 後再 `db:seed`，job 成功完成後 api/worker 才啟動；seed 沿用現有語意（accounts/themes 各為 idempotent upsert、theme batch all-or-nothing，見 FR-009），重複部署安全。
- **FR-018**: 系統 MUST 新增一個**免認證、回 200** 的輕量 `GET /api/health` endpoint（不受 JWT guard 攔截），語意為 **liveness（HTTP server 活著）**，MUST NOT 在其中查 DB/Redis、也 MUST NOT 被宣稱為「依賴就緒」的證明（就緒由 FR-007 的 postgres/redis healthcheck 負責）。此為本 feature 唯一的功能性 app 變更，MUST 不影響既有任何路由行為。
- **FR-019**: worker 容器 MUST NOT 設 healthcheck（非 HTTP，無探測表面），改以 `restart: unless-stopped` 確保 crash/fail-fast 退出後自動重起；api 容器 MUST 以 `/api/health` 設 healthcheck（liveness）。nginx MAY 以 api 的 `/api/health` 作為「HTTP server 已就緒」的 `depends_on` 依據；**DB/Redis 的就緒判斷仍只歸 FR-007 的 postgres/redis healthcheck**，`/api/health` 不得被用來代表後端依賴就緒。

### HTML Slides Agent Constitution Requirements *(mandatory for slide-generation features)*

> 本 feature 為**部署/基礎設施**，不改動投影片生成行為，故多數內容導向 CR 標 **N/A**；保留與本 feature 真正相關者。

- **CR-001 Source Fidelity**: N/A — 不觸及內容生成或來源事實處理。
- **CR-002 Review Report**: N/A — 不產生投影片/審查報告。
- **CR-003 Web-First Output**: N/A（不改變產物形式；self-contained HTML 仍為應用產物，部署不影響）。
- **CR-004 Backend-Configured LLM Boundary**: **適用** — 部署 MUST 確保 provider/model/密鑰僅存在於後端容器 env，絕不進前端 bundle 或公開欄位；見 FR-005/FR-006。
- **CR-005 Design System**: N/A。
- **CR-006 Semantic Titles**: N/A。
- **CR-007 Data Visualization**: N/A。
- **CR-008 TDD Coverage**: **適用（調整形式）** — 基礎設施以**可執行的驗證**取代單元測試：定義 smoke/healthcheck 驗證腳本與步驟（堆疊起得來、`/api` 反代通、登入、提交 job 到完成、重啟不丟資料）。見 Success Criteria 與 User Story 的 Independent Test。
- **CR-009 Domain Model**: N/A — 不新增領域概念（部署拓樸非領域模型）。
- **CR-010 Lean Test Scope**: **適用** — 驗證聚焦於可觀察的部署結果（healthcheck、端到端 smoke、持久化），不做冗餘測試。
- **CR-011 Behavior-Driven Value**: **適用** — 以 Given/When/Then 描述維運者可獨立示範的部署行為（見 User Stories）。
- **CR-012 Code Simplicity**: **適用** — 範圍嚴格限縮（單機 compose；不做 K8s/CI/IaC/監控）；API 與 worker 共用 image 避免重複；不引入投機抽象。見「不做」清單。
- **CR-013 Consistent Language**: **適用** — 服務命名與 env 變數 MUST 與既有文件/`.env.example` 一致（如 `web`/`api`/`worker`/`redis`/`postgres`、`DATABASE_URL`、`REDIS_URL`、`AUTH_JWT_SECRET`…）。
- **CR-014 Performance and Evidence**: **適用** — 需聲明預期資源/啟動行為並留證據：映像可建置、堆疊可起、smoke 通過的紀錄（log/截圖）；不對吞吐做硬性 SLA（標示 N/A 之處註明）。
- **CR-015 Manual Verification**: **適用** — TLS/網域、實機重啟、密鑰注入正確性等難以全自動者，定義人工驗證路徑（見 Success Criteria）。
- **CR-016 Verification**: N/A（slide JSON/HTML/鍵盤導覽屬應用層，既有 feature 已涵蓋；本 feature 僅確保部署後該行為仍可經 User Story 1 的端到端 smoke 觀察到）。

### Key Entities *(include if feature involves data)*

> 此處「entity」指部署拓樸的服務單元，非領域資料模型。

- **edge（nginx）**：服務 web 靜態檔 + 反代 `/api` → api + SPA fallback；對外只開 HTTP（80），TLS 由上游處理。
- **api**：HTTP 後端容器（NestJS via tsx），`HOST=0.0.0.0`；依賴 Redis + Postgres。
- **worker**：與 api 共用 image 的非 HTTP 容器，跑 BullMQ 消費者；依賴 Redis + Postgres。
- **redis**：BullMQ 佇列（compose 內含，具名 volume 可選）；提供 `PING` healthcheck。
- **postgres**：持久化資料（decks/帳號/主題庫；compose 內含）；搭配具名 volume 與 `pg_isready` healthcheck。
- **migrate+seed（一次性 job）**：在 api/worker 前自動依序跑 `db:migrate` → `db:seed` 的短命容器（與 api 共用 image）；`depends_on` postgres/redis healthy，api/worker 再 `depends_on` 其成功完成。
- **設定/密鑰**：`.env` / secrets / TLS 憑證 — 注入而非內嵌。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 在一台**只裝了 Docker（+ Compose）、未裝 Node/pnpm** 的乾淨主機上，從填好 `.env` 到 `docker compose up -d --build` 完成、受 healthcheck 監測的服務（nginx/api/postgres/redis）轉 healthy 且 worker running，**單一指令、無需手動進容器補裝**即可完成。
- **SC-002**: 端到端 smoke 全綠：開啟首頁 → 登入 → 提交一次非同步生成 → 輪詢至完成 → 預覽並下載 self-contained HTML。
- **SC-003**: 持久化驗證：保留 volume 的 `down` → `up` 後，既有 deck 與帳號 100% 仍在、可讀。
- **SC-004**: migrate+seed job 受控：對空 DB 自動套用 migration 後 api 可起；再次部署時 seed 為 idempotent upsert（不產生重複資料）、theme batch all-or-nothing（不留半批無效 theme）。
- **SC-005**: 安全面：web 靜態 bundle 內**零**後端密鑰；image layer 與 git 內**無** `.env`/憑證；缺各自必填設定時對應程序 fail-fast 並有明確 log（API：JWT/DB/Redis；worker：DB/Redis）。
- **SC-006**: 映像可重現建置；`.dockerignore` 生效（不含 `node_modules`/`.env`/`preview` 等），體積在合理範圍（plan 階段給目標值）。

## Assumptions

- 目標為**單一主機**的 Docker Compose 部署；多主機/叢集編排不在範圍。
- 主機已安裝相容版本的 Docker Engine 與 Docker Compose v2。
- 維運者能提供正式密鑰與設定（`OPENAI_API_KEY`、`AUTH_JWT_SECRET`、`AUTH_ACCOUNTS`、Postgres 帳密與 db 名）；`DATABASE_URL`/`REDIS_URL` 由範本固定指向 compose 內部服務，非維運者自組。
- 沿用既有 `.env.example` 的變數契約；本 feature 不重新設計設定結構。
- 沿用既有 tsx 執行模型；不在本 feature 導入編譯到 dist 的建置鏈（若日後要做屬另一 feature）。
- 應用程式碼維持現狀；僅允許為容器化必要的最小、不改行為的調整（例如 host 由 env 控制的範本/文件）。
- 三個關鍵決策已於 2026-06-10 clarify 定案（內含 Postgres+Redis、nginx HTTP 反代、migrate+seed 自動），作為 plan 的固定前提。

## Review and Safety Notes *(mandatory for generated-content features)*

> 本 feature 不產生內容，以下聚焦**部署面的安全與可回顧性**。

- **Assumptions to Surface**: 部署文件 MUST 明確列出必填密鑰、`ALLOWED_ORIGIN`/`TRUST_PROXY` 的正確設定、以及未設妥時的失敗症狀。
- **Omitted or Compressed Content Policy**: N/A（無內容生成）。
- **Uncertain Claims Policy**: N/A。
- **Sensitive Content Handling**: 密鑰（OpenAI key、JWT secret、帳號 hash、DB 連線字串）MUST 僅存在後端容器 env / secrets，**絕不**進 web bundle、image layer 或 git；文件 MUST 提醒輪替已外洩密鑰。
- **Evidence and Traceability**: 交付 MUST 附可回顧證據：成功 `docker compose up` 與 smoke 的紀錄（log / 截圖 / 簡短錄製），以及 `.dockerignore`/無密鑰入庫的檢查結果。
- **Manual Verification Path**: TLS/網域生效、實機重啟後資料留存、缺密鑰 fail-fast、web bundle 無密鑰，這些以人工/腳本檢查清單驗證（Success Criteria 對應條目）。

---

## 下一步

1. ✅ 三個關鍵決策已 clarify 定案（2026-06-10）。
2. 進 `plan.md`：定服務拓樸（nginx + api + worker + migrate-job + postgres + redis）、Dockerfile 策略（多階段 / workspace 安裝 / tsx 執行）、nginx SPA fallback + `/api` 反代設定、`GET /api/health` 新增點與 JWT guard 排除、api healthcheck + worker `restart: unless-stopped`、`depends_on` 就緒條件、一次性 migrate+seed job 機制、`.dockerignore` 清單、production `.env` 範本（`HOST=0.0.0.0`、`NODE_ENV=production`、`ALLOWED_ORIGIN`、`TRUST_PROXY=1`）。
3. 視需要補 `contracts/`（compose 服務契約、env 契約）與 `tasks.md`。

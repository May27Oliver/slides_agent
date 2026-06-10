# Implementation Plan: 容器化部署（Docker Compose 一鍵起前後端 + worker + Redis/Postgres）

**Branch**: `012-docker-compose-deploy` | **Date**: 2026-06-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/012-docker-compose-deploy/spec.md`

## Summary

把目前「本機手動三程序（`pnpm dev:iterm`）+ 開發者自備 Redis/Postgres」的啟動方式，變成**單機、可一鍵帶起的 production Docker Compose 部署**：`nginx`（服務 web 靜態檔 + 反代 `/api`）+ `api` + `worker` + 一次性 `migrate` job + `postgres` + `redis`。應用程式碼僅做**一處**功能性變更（新增 liveness `GET /api/health`），其餘全靠容器化與設定注入完成。

**Artifact Language**: 本 plan 及相關 Spec Kit 產物以繁體中文撰寫。

**鎖定決策（2026-06-10 clarify，詳見 spec）**：
1. **Postgres + Redis 都包進 compose**（具名 volume）。
2. **nginx 反代（HTTP 80；TLS 上游處理）**。
3. **migrate + seed 由一次性 job 自動跑**（migrate→seed 依序；job 成功後 api/worker 才起）。
4. **新增 `/api/health`（免認證、liveness、不查 DB/Redis）** 供 api healthcheck；worker **無 healthcheck**，靠 `restart: unless-stopped`。
5. 依賴就緒由 **postgres/redis 各自 healthcheck**（`pg_isready` / redis `PING`）gate，**不**用 `/api/health` 代表後端就緒。

## Technical Context

**Language/Runtime**：沿用既有 monorepo（TypeScript；NestJS via **tsx runtime**，無 transpile 產物；React 19 + Vite + Tailwind v4）。Node `20.19.5`、pnpm `10.30.3`（`packageManager` 釘版，建置時用 corepack 取得）。

**新基礎設施依賴（皆官方 image，無新 npm 套件）**：
- `node:20.19.5-slim`（api/worker/web build 階段）
- `nginx:1.27-alpine`（邊緣）
- `postgres:16-alpine`、`redis:7-alpine`

**唯一的 app 變更**：新增 `GET /api/health`（liveness 回 `200 {status:"ok"}`）。**不新增** npm 套件、**不**改既有路由、**不**移動 `tsx` 到 dependencies（image 安裝完整 deps，含 devDep `tsx`）。

**Storage**：沿用既有 `themes`/`decks`/帳號 schema 與已 commit 的 migrations（`apps/api/src/infra/db/migrations/0000–0002 + meta`）。`db-migrate.ts` 用 `drizzle-orm/node-postgres/migrator`（**不需 drizzle-kit runtime**）。

**Target Platform**：單一 Linux 主機，Docker Engine + Compose v2。

**Project Type**：基礎設施 / 部署（非投影片生成功能）。

**Performance/Constraints**：無硬性吞吐 SLA（標 N/A）；目標為「乾淨主機一鍵 `docker compose up -d --build` → healthchecked 服務轉 healthy → 端到端 smoke 通過」。映像體積靠 `.dockerignore` + 多階段控制（plan 目標：api image 安裝完整 workspace deps 可接受；web 最終 image 為 nginx + 靜態檔，極小）。

---

## 關鍵技術決策（research，內聯）

> 本 feature 無領域資料模型（`data-model.md` = N/A）；研究結論直接記於此，供 /tasks 展開。

### DR-001：api / worker / migrate 共用**單一** image（多階段 `Dockerfile.api`）
三者跑同一份 `apps/api` 程式碼，差異只在啟動指令。**只建一個 image**，compose 以 `command:` 區分：
- api：`node --import tsx src/main.ts`
- worker：`node --import tsx src/worker/worker.main.ts`
- migrate job：`sh -c 'node --import tsx scripts/db-migrate.ts && node --import tsx scripts/db-seed.ts'`

WORKDIR = `/app/apps/api`（migrate 的 `migrationsFolder: "./src/infra/db/migrations"` 為相對 CWD）。
**Rejected**：分別建 api/worker image → 重複建置、易漂移。

### DR-002：production 不重用 dev 的 `--env-file` / `--watch`，**直接跑 tsx 入口**
dev 的 `dev`/`worker:dev`/`db:migrate` script 帶 `--env-file=../../.env`（容器內無此檔）與 `--watch`。production **不**新增 package.json script（保持「唯一 app 變更 = /api/health」）；compose `command:` 直接呼叫 **與 dev 相同的 tsx 入口/腳本**（`src/main.ts`、`src/worker/worker.main.ts`、`scripts/db-migrate.ts`、`scripts/db-seed.ts`），env 由容器注入。
**Rejected**：新增 `start`/`worker:start` 等 prod script → 多動 app 檔、與「最小變更」承諾衝突；inline command 已足夠且無漂移（跑的是同一份實體腳本）。

### DR-003：image 安裝**完整** deps（含 `tsx`），不 `--prod` prune
tsx runtime 需 devDep `tsx`；`pnpm install --prod` 會剪掉它導致無法啟動。故 api image 安裝完整 workspace deps。可用 `pnpm install --frozen-lockfile --filter "@slides-agent/api..."` 限縮到 api + 其 workspace 依賴（domain/contracts），避免裝 web devDeps。
**Rejected**：把 `tsx` 移到 dependencies → 改動 app package.json、且語意上 tsx 是建置/執行工具；保持完整安裝最單純。

### DR-004：web 為多階段 `Dockerfile.web` → **nginx baked 靜態檔 + 反代設定**
Stage1（node）：corepack pnpm、裝 workspace deps、`pnpm --filter @slides-agent/web build`（Vite 經 `domain-alias` 解析 `packages/*/src`，故 build context 需含 domain/contracts 原始碼）→ `dist/`。
Stage2（nginx:alpine）：複製 `dist` → `/usr/share/nginx/html`，複製 `nginx.conf`：
- `location /api/ { proxy_pass http://api:3000; }`（保留 `/api` 前綴；帶 `X-Forwarded-For`/`X-Forwarded-Proto`/`Host`）
- `location / { try_files $uri /index.html; }`（SPA fallback，支援 react-router 深連結）
- `listen 80;`
**Rejected**：用 Node serve 前端 → 多一個 Node 程序、無必要；nginx 靜態 + 反代最省。

### DR-005：依賴就緒 gate = postgres/redis healthcheck + `depends_on` 條件
- `postgres`：`healthcheck: pg_isready -U $POSTGRES_USER`
- `redis`：`healthcheck: redis-cli ping`
- `migrate`：`depends_on: { postgres: service_healthy, redis: service_healthy }`，`restart: "no"`，跑完退 0。
- `api` / `worker`：`depends_on: { migrate: service_completed_successfully, postgres: service_healthy, redis: service_healthy }`。
- `api`：`healthcheck` 打 `/api/health`（liveness）；`worker`：**無** healthcheck，`restart: unless-stopped`。
- `nginx`：`depends_on: { api: service_healthy }`，`restart: unless-stopped`，`ports: ${HTTP_PORT:-80}:80`。
`/api/health` 僅證明 HTTP server 活著（DB pool lazy connect，200 不代表 DB 就緒）——就緒判斷只靠上述 pg/redis healthcheck。

### DR-006：設定單一真實來源，`DATABASE_URL` 由 `POSTGRES_*` 組出（不重複）
compose `environment` 對 api/worker/migrate 注入：
```
DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
REDIS_URL:    redis://redis:6379
NODE_ENV: production   HOST: 0.0.0.0   PORT: 3000
ALLOWED_ORIGIN: ${ALLOWED_ORIGIN}   TRUST_PROXY: 1
```
其餘密鑰（`OPENAI_API_KEY`、`AUTH_JWT_SECRET`、`AUTH_JWT_ISSUER`、`AUTH_ACCOUNTS`、模型、rate-limit…）以 `env_file: .env` 注入。`postgres` 服務本身吃 `POSTGRES_USER/PASSWORD/DB`。維運者只填 `POSTGRES_*` + 密鑰 + `ALLOWED_ORIGIN`，**不自組 DSN**。

**正規單一路徑（避免 compose 插值 vs `env_file` 的歧義）**：compose 的 `${VAR}` 插值（用於組 `DATABASE_URL`、`HTTP_PORT`）在**容器啟動前**讀取，且預設只讀**專案根目錄 `.env`**；而 `env_file: .env` 是把同一個檔注入容器內。為讓兩者吃**同一份檔**，正規流程固定為：
```
cp .env.production.example .env      # 在 repo 根目錄
# 編輯 .env 填入 POSTGRES_* / 密鑰 / ALLOWED_ORIGIN
docker compose up -d --build
```
即「**複製成根目錄 `.env`**」是唯一支援路徑（不採 `--env-file <其他檔>`，以免插值與注入讀到不同檔）。quickstart 與 tasks MUST 只寫這一條路徑。
**Rejected**：(a) 在 .env 另寫整條 `DATABASE_URL` → 與 `POSTGRES_*` 兩處易漂移；(b) 用 `--env-file .env.production` 而檔名非根 `.env` → 插值/注入來源不一致、易踩雷。

---

## Constitution Check

*GATE：投影片生成相關原則對本部署 feature 多數 N/A；逐項如下。*

- **Specification First**：spec 已 clarify 定案、無 `NEEDS CLARIFICATION`（內含 DB/Redis、nginx HTTP 反代、自動 migrate+seed、/api/health liveness、worker restart-only）。無殘留阻擋問題。
- **Behavior-Driven User Value**：3 條 User Story 皆有 Given/When/Then 且可獨立示範（一鍵帶起 / 持久化重啟 / 自動 migrate+seed）。
- **Source Fidelity / Reviewable Generation / Web-First / Design System / Semantic Titles / Data Viz**：**N/A** — 不觸及內容生成、不改產物形式與設計系統。
- **Backend-Configured LLM Boundary（CR-004）**：**適用** — 密鑰/provider/model 只在後端容器 env；web 靜態 bundle 零後端密鑰；`.env`/憑證不進 image/git（見 `.dockerignore` 與 Evidence）。
- **Code Quality and Simplicity**：最小可讀方案 + 反模式不變式如下節。唯一 app 變更（`/api/health`）依現有 `modules/<name>/<name>.controller.ts + .module.ts` 慣例新增、無 guard、無新依賴。
- **TDD / DDD**：第一個失敗測試 = `apps/api/test/health.controller.test.ts`（先 RED：**純 controller 單元測試** —— 直接實例化 `HealthController`、呼叫其方法、斷言回傳 `{status:"ok"}`，不啟 HTTP/不測路由字串）→ 再加 controller（GREEN）。「免認證 + 實際路徑 `/api/health`」由結構保證（無 guard、沿用 `setGlobalPrefix("api")`），不在單元測試斷言路由。部署層行為以**可執行 smoke**（compose 起堆疊 → healthcheck → 端到端）驗證，非單元測試。無新領域概念。
- **Lean Test Scope**：只測 `/api/health` 一個單元 + 一份端到端 smoke 清單；不對 compose 內部細節寫冗餘斷言。
- **Consistent UX and Language**：服務名與 env 變數沿用既有（`api`/`worker`/`nginx`/`postgres`/`redis`、`DATABASE_URL`/`REDIS_URL`/`AUTH_JWT_SECRET`…與 `.env.example` 一致）。
- **Performance and Operational Evidence**：吞吐 SLA = N/A；Evidence 見下節（build 成功、healthcheck green、smoke log/截圖、無密鑰入庫檢查）。
- **Manual Verification Path**：TLS/網域、實機重啟資料留存、缺密鑰 fail-fast、web bundle 無密鑰 → 人工/腳本檢查清單（quickstart）。
- **Release Verification**：投影片 JSON/HTML/鍵盤導覽屬應用層既有覆蓋；本 feature 以 User Story 1 端到端 smoke 確認部署後該行為仍可觀察（登入→生成→預覽→下載）。

### 反模式不變式（實作與收尾稽核強制）

- **No drift（單一真實來源）**：
  - api/worker/migrate **共用同一 image**（一個 `Dockerfile.api`，三服務只差 `command:`）；不建多個 api image。
  - production 跑的是**與 dev 相同的實體入口/腳本**（`main.ts`/`worker.main.ts`/`db-migrate.ts`/`db-seed.ts`），不另寫 prod-only 啟動邏輯。
  - `DATABASE_URL` 由 `POSTGRES_*` 單一來源組出（DR-006），不在 .env 重複整條 DSN。
  - nginx 路由設定只有一份 `nginx.conf`。
- **No dead code（每個檔案都有消費者）**：`Dockerfile.api`→api/worker/migrate；`Dockerfile.web`/`nginx.conf`→nginx；`health.controller`→api healthcheck + smoke；`.env.production.example`→維運者；`.dockerignore`→build。**不**新增投機服務（排程器/備份容器/registry 步驟等，spec「不做」清單）。
- **No shim（不加相容層）**：production **不**保留 dev 的 `--env-file`/`--watch`；env 由容器注入，**不**做「同時支援 .env 檔與注入」的雙路徑參數。若想加轉接層代表設計錯，回頭改。
- **No unlabeled legacy（相容碼標明）**：dev script（`dev`/`worker:dev`/`db:migrate`/`db:seed`，帶 `--env-file`/`--watch`）= **刻意保留的 DEV 路徑**，本 feature 不動、不移除；production 路徑為 compose `command:`。兩者各自標明用途。**不**新增 prod package.json script（守住「唯一 app 變更 = /api/health」）。

## Project Structure

### Documentation (this feature)

```text
specs/012-docker-compose-deploy/
├── spec.md          # 已完成（clarify 定案）
├── plan.md          # 本檔
├── quickstart.md    # Phase 1：部署/驗證手冊（取代 data-model；data-model = N/A）
└── tasks.md         # /speckit-tasks 產出（本 plan 不建）
```

### Source / artifacts to add (repository)

```text
docker/
  Dockerfile.api          # 多階段：corepack pnpm → 裝 deps（含 tsx）→ 複製 domain/contracts/api 源 + tsconfig.base.json → WORKDIR apps/api（api/worker/migrate 共用）
  Dockerfile.web          # 多階段：Stage1 vite build → Stage2 nginx baked dist + nginx.conf
  nginx.conf              # /api 反代 → api:3000 + SPA fallback + listen 80 + X-Forwarded-*
docker-compose.yml        # 根：nginx + api + worker + migrate(once) + postgres + redis；volumes + healthchecks + depends_on
.dockerignore             # 根：排除 node_modules / .env* / apps/*/preview / **/dist / .git / specs / coverage / playwright-report …
.env.production.example   # prod env 範本：POSTGRES_* / 密鑰 / ALLOWED_ORIGIN（DATABASE_URL/REDIS_URL 由 compose 組，不在此手填）

apps/api/src/modules/health/
  health.controller.ts    # @Controller("health") @Get() → { status: "ok" }（public，liveness，不查 DB/Redis）
  health.module.ts        # 提供 HealthController
apps/api/src/app/app.module.ts   # （編輯）imports 加 HealthModule
apps/api/test/health.controller.test.ts   # 單元測試（先 RED）

docs/ 或 README             # 部署章節：必填 env、ALLOWED_ORIGIN/TRUST_PROXY、up/down、migrate+seed 自動、down -v 風險、手動 rerun/除錯命令
```

**Structure Decision**：Dockerfile 放 `docker/`，compose build `context: .`（需整個 monorepo）、`dockerfile: docker/Dockerfile.*`。`/api/health` 依既有 `modules/<name>/` 慣例落點並於 `app.module.ts` 註冊。

## 實作階段（供 /tasks 展開）

### Phase A — app 變更：`/api/health`（先 TDD）
1. `health.controller.test.ts`：**純單元測試** —— 實例化 `HealthController`、呼叫方法、斷言回傳 `{status:"ok"}`（RED，不啟 HTTP、不斷言路由字串）。
2. `health.controller.ts`（`@Controller("health")` + `@Get()` → `{status:"ok"}`，無 guard）+ `health.module.ts`；`app.module.ts` 註冊（GREEN）。
3. 結構性確認（非單元斷言）：global prefix `api` 下實際路徑為 `/api/health`、無 guard 攔截 —— 留待 Phase F smoke 以 `curl /api/health` 驗證。

### Phase B — api/worker/migrate image：`docker/Dockerfile.api`
1. 多階段：base `node:20.19.5-slim` → corepack enable → 複製 workspace manifests（`pnpm-workspace.yaml`/root `package.json`/`pnpm-lock.yaml`/`packages/*/package.json`/`apps/api/package.json`）→ `pnpm install --frozen-lockfile --filter "@slides-agent/api..."`。
2. 複製源：`packages/domain`、`packages/contracts`、`apps/api`（src/scripts/tsconfig/migrations/seeds）+ root `tsconfig.base.json`。
3. `WORKDIR /app/apps/api`；預設 `CMD` 為 api 入口（compose 對 worker/migrate 覆寫 `command:`）。

### Phase C — web/nginx image：`docker/Dockerfile.web` + `nginx.conf`
1. Stage1 build（含 domain/contracts 源）→ `dist`。
2. Stage2 nginx baked dist + `nginx.conf`（/api 反代、SPA fallback、X-Forwarded-*、listen 80）。

### Phase D — `docker-compose.yml` + `.dockerignore` + `.env.production.example`
1. 六服務 + 具名 volume（`pgdata`，redis 視需要）+ healthchecks + `depends_on` 條件（DR-005）+ env 注入（DR-006）+ `restart` 策略（api/worker/nginx = unless-stopped；migrate = no）+ `ports: ${HTTP_PORT:-80}:80`。
2. `.dockerignore`：排除非執行期內容、避免密鑰/體積問題（FR-012）。
3. `.env.production.example`：`POSTGRES_USER/PASSWORD/DB`、`OPENAI_API_KEY`、`AUTH_JWT_SECRET`、`AUTH_JWT_ISSUER`、`AUTH_ACCOUNTS`、`ALLOWED_ORIGIN`、（可選）`HTTP_PORT`、模型與 rate-limit。

### Phase E — 部署手冊 `quickstart.md`（+ README 連結）
正規流程固定為 `cp .env.production.example .env` →（填 `POSTGRES_*`/密鑰/`ALLOWED_ORIGIN`）→ `docker compose up -d --build`（**只寫這一條 env 路徑**，DR-006）。另含：必填 env 與失敗症狀、healthcheck 觀察（`docker compose ps`）、端到端 smoke、`down`/`down -v` 風險、migrate+seed 自動 + 手動 rerun/除錯命令。

### Phase F — 驗證（Evidence）
1. `docker compose config` 通過（語法/插值）。
2. build 成功；`up -d --build` → `docker compose ps` 顯示 nginx/api/postgres/redis healthy、worker running、migrate exited 0。
3. 端到端 smoke：首頁 → 登入 → 提交生成 → 輪詢完成 → 預覽 + 下載。
4. 持久化：`down`（保留 volume）→ `up` → deck/帳號仍在。
5. 安全檢查：web bundle 無後端密鑰（grep dist）、git/image 無 `.env`、缺密鑰 fail-fast log。

## Complexity Tracking

無憲章違反需豁免。新增的容器/服務皆為 spec 鎖定範圍的必要單元（nginx/api/worker/migrate/postgres/redis），api 與 worker 共用 image 已避免重複；未引入任何投機抽象或超範圍服務。

## Evidence Plan

- **Automated Evidence**：`health.controller.test.ts`（單元，api vitest 套件內）；`docker compose config` 通過紀錄。
- **Manual / Operational Evidence**：`docker compose ps`（healthcheck 狀態）、端到端 smoke 的 log/截圖/簡短錄製、`down`→`up` 後資料留存截圖。
- **Security Evidence**：`grep` web `dist` 無 `OPENAI_API_KEY`/`AUTH_JWT_SECRET` 等；`git ls-files | grep .env` 為空；image history 不含密鑰；缺 `AUTH_JWT_SECRET` 時 api fail-fast log（worker 不因缺 JWT 而擋）。
- **Decision Evidence**：本 plan 的 DR-001~006（含 rejected alternatives）即決策依據。

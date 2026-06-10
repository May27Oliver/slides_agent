---
description: "Task list — 012 容器化部署（Docker Compose 一鍵起前後端 + worker + Redis/Postgres）"
---

# Tasks: 容器化部署（Docker Compose）

<!-- Spec Kit artifacts in Traditional Chinese. -->

**Input**: `/specs/012-docker-compose-deploy/`（spec / plan）

**範圍**：單機 production Docker Compose：`nginx` + `api` + `worker` + 一次性 `migrate` job + `postgres` + `redis`。唯一 app 變更 = 新增 liveness `GET /api/health`。**無新 npm 套件、無 DB migration**（沿用既有 0000–0002）。

**Tests**: TDD；`/api/health` 為純 controller 單元測試（api vitest）。部署層行為以**可執行 smoke**（compose 起堆疊 → healthcheck → 端到端）驗證——基礎設施特性，非單元測試。

**組織**：Foundational = 把堆疊「起得來」的所有產物（blocks 所有 US）；US1/US2/US3 = 對同一堆疊可**獨立執行**的驗證切片（smoke / 持久化 / 自動 migrate+seed）。

---

## Phase 1：Setup
- [ ] T001 確認分支 `012-docker-compose-deploy`（疊在 main 上）。本批**無 DB migration**（沿用既有 `apps/api/src/infra/db/migrations/0000–0002 + meta`）、**無新 npm 套件**。
- [ ] T001a 編輯前 impact（CLAUDE.md）：對**唯一要編輯的既有 symbol** `AppModule`（`apps/api/src/app/app.module.ts`，將 import `HealthModule`）跑 `gitnexus_impact({target:"AppModule", direction:"upstream"})`。HIGH/CRITICAL 先警示。

---

## Phase 2：Foundational（可建置的部署產物 — BLOCKS 所有 US）

### 2a. 唯一 app 變更：`/api/health`（先 TDD）
- [ ] T002 [P] 失敗測試 `apps/api/test/health.controller.test.ts`：**純 controller 單元測試** —— 實例化 `HealthController`、呼叫方法、斷言回傳 `{status:"ok"}`（RED；不啟 HTTP、不斷言路由字串）。
- [ ] T003 `apps/api/src/modules/health/health.controller.ts`（`@Controller("health")` + `@Get()` → `{status:"ok"}`，**無 guard**）+ `apps/api/src/modules/health/health.module.ts`（提供 controller）（GREEN）。
- [ ] T004 `apps/api/src/app/app.module.ts`：`imports` 加 `HealthModule`（依 T001a impact 結果）。實際路徑 `/api/health` 由 `setGlobalPrefix("api")` 保證，留待 Phase 5 smoke 以 `curl` 驗證。

### 2b. api/worker/migrate 共用 image（DR-001/002/003）
- [ ] T005 `docker/Dockerfile.api`（多階段）：base `node:20.19.5-slim` → `corepack enable` → 複製 workspace manifests（`pnpm-workspace.yaml`/root `package.json`/`pnpm-lock.yaml`/`packages/*/package.json`/`apps/api/package.json`）→ `pnpm install --frozen-lockfile --filter "@slides-agent/api..."` → 複製源（`packages/domain`、`packages/contracts`、`apps/api`〔src/scripts/tsconfig/migrations/seeds〕+ root `tsconfig.base.json`）→ `WORKDIR /app/apps/api` → 預設 `CMD` 為 api 入口（`node --import tsx src/main.ts`；worker/migrate 由 compose 覆寫 `command:`）。**不 `--prod` prune**（保留 devDep `tsx`）。

### 2c. web/nginx 邊緣 image（DR-004）
- [ ] T006 [P] `docker/nginx.conf`：`location /api/ { proxy_pass http://api:3000; }`（保留 `/api` 前綴 + `X-Forwarded-For`/`X-Forwarded-Proto`/`Host`）；`location / { try_files $uri /index.html; }`（SPA fallback）；`listen 80;`。
- [ ] T007 `docker/Dockerfile.web`（多階段）：Stage1 `node:20.19.5-slim` + corepack pnpm + 裝 workspace deps（含 `packages/domain`/`contracts` 源，供 `domain-alias` 解析）→ `pnpm --filter @slides-agent/web build` → `dist`；Stage2 `nginx:1.27-alpine` 複製 `dist` → `/usr/share/nginx/html` + 複製 `nginx.conf`。

### 2d. compose + 支援檔（DR-005/006）
- [ ] T008 `docker-compose.yml`（根）：六服務 ——
  - `postgres`（`postgres:16-alpine`，env `POSTGRES_USER/PASSWORD/DB`，volume `pgdata:/var/lib/postgresql/data`，`healthcheck: pg_isready -U $POSTGRES_USER`）。
  - `redis`（`redis:7-alpine`，`healthcheck: redis-cli ping`）。
  - `migrate`（build `Dockerfile.api`，`command: sh -c 'node --import tsx scripts/db-migrate.ts && node --import tsx scripts/db-seed.ts'`，`depends_on: {postgres: service_healthy, redis: service_healthy}`，`restart: "no"`）。
  - `api`（build `Dockerfile.api`，`command: node --import tsx src/main.ts`，env 見 DR-006：`NODE_ENV=production`/`HOST=0.0.0.0`/`PORT=3000`/`DATABASE_URL`〔由 `POSTGRES_*` 組〕/`REDIS_URL=redis://redis:6379`/`ALLOWED_ORIGIN`/`TRUST_PROXY=1` + `env_file: .env`，`depends_on: {migrate: service_completed_successfully, postgres: service_healthy, redis: service_healthy}`，`healthcheck` 打 `/api/health`，`restart: unless-stopped`）。
  - `worker`（build `Dockerfile.api`，`command: node --import tsx src/worker/worker.main.ts`，env 同 api（`DATABASE_URL`/`REDIS_URL` 必要），`depends_on` 同 api，**無 healthcheck**，`restart: unless-stopped`）。
  - `nginx`（build `Dockerfile.web`，`ports: ${HTTP_PORT:-80}:80`，`depends_on: {api: service_healthy}`，`restart: unless-stopped`）。
  - volumes：`pgdata`（必），redis 視需要。
- [ ] T009 [P] `.dockerignore`（根）：排除 `node_modules`、`.env`、`.env.*`、`apps/*/preview`、`**/dist`、`.git`、`specs`、`docs`、`coverage`、`playwright-report`、`**/*.test.*` 等非執行期內容（FR-012）。
- [ ] T010 [P] `.env.production.example`（根）：`POSTGRES_USER/PASSWORD/DB`、`OPENAI_API_KEY`、`AUTH_JWT_SECRET`、`AUTH_JWT_ISSUER`、`AUTH_ACCOUNTS`、`ALLOWED_ORIGIN`、（可選）`HTTP_PORT`、模型與 rate-limit。**註明** `DATABASE_URL`/`REDIS_URL` 由 compose 組、不在此手填。
  - **同步改 `.gitignore`**：現有規則為 `.env` / `.env.*` / `!.env.example`，`.env.production.example` 會命中 `.env.*` 被 ignore → **新增例外 `!.env.production.example`**（緊接 `!.env.example` 後），讓範本可被追蹤。`git add .env.production.example` 後 `git check-ignore` 應回空。
- [ ] T011 `docker compose config` 通過（語法 + `${POSTGRES_*}` 插值；以 `cp .env.production.example .env` 後驗證，DR-006 正規路徑）。

**✅ Checkpoint A**：映像可建置、compose 設定有效；唯一 app 變更 `/api/health` 單元測試綠。

---

## Phase 3：User Story 1 — 一鍵帶起正式堆疊（Priority: P1）🎯 MVP

**Goal**：乾淨主機一條指令起完整堆疊並完成一次生成。
**Independent Test**：`cp .env.production.example .env`（填測試值）→ `docker compose up -d --build` → 端到端 smoke 通過。

- [ ] T012 [US1] build + up：`cp .env.production.example .env`（填測試值）→ `docker compose up -d --build` → `docker compose ps` 確認 **nginx/api/postgres/redis healthy、worker running、migrate exited(0)**（spec AC1）。
- [ ] T013 [US1] 端到端 smoke：首頁 SPA 可開 → `curl -fsS /api/health` 回 `200 {status:"ok"}` → 登入（`/api/auth/login`）→ 提交非同步生成 → 輪詢至完成 → 預覽 + 下載 self-contained HTML（spec AC2）。
- [ ] T014 [US1] 反代/HOST 驗證：確認 `HOST=0.0.0.0` + nginx `/api` 反代下，前端相對 `/api/*` 請求成功（非 CORS 阻擋、非 connection refused）（spec AC3）。
- [ ] T015 [US1] fail-fast 驗證：清空 `AUTH_JWT_SECRET` → **api** fail-fast 且 log 明確；**worker** 不因缺 JWT 擋（另測 worker 缺 `DATABASE_URL`/`REDIS_URL` 才 fail）（spec AC4）。

**✅ Checkpoint B（MVP）**：乾淨主機一鍵起 + 完整一次生成 + 下載。

---

## Phase 4：User Story 2 — 資料持久化與安全重啟（Priority: P2）

**Goal**：保留 volume 的重啟不丟資料。
**Independent Test**：生成並存 deck → `down`（保留 volume）→ `up` → deck 仍在。

- [ ] T016 [US2] 持久化：登入後生成並存一份 deck → `docker compose down`（**不加 `-v`**）→ `docker compose up -d` → 該 deck 與帳號仍在、可登入讀取、主題庫仍可瀏覽（spec US2 AC1）。
- [ ] T017 [US2] 重啟連線競賽：`docker compose restart` 後 api/worker 重新連 postgres/redis 正常建立連線池、不 crash loop（驗證 `depends_on: service_healthy` gate 生效）（spec US2 AC2）。

---

## Phase 5：User Story 3 — 部署時自動 migrate + seed（Priority: P3）

**Goal**：一次性 job 自動 migrate→seed，成功後才放行 api/worker。
**Independent Test**：空 DB 首次 up → job 自動跑完 → api 起；再 up → idempotent。

- [ ] T018 [US3] 空 DB 首次 up：在**全新 compose project / 乾淨 volume**（`docker compose -p ttl-us3 up -d --build`，或對主 project 先受控 `down -v`）跑，**不要**用 T012 已 seed 的堆疊 —— migrate+seed job **自動依序成功**（schema 建立、主題庫 220 列就位）→ api/worker 在其 `service_completed_successfully` 後才啟動（spec US3 AC1）。測畢 `docker compose -p ttl-us3 down -v` 清掉，避免誤刪主驗證資料。
- [ ] T019 [US3] 再部署 idempotent：再次 `up`（job 再跑）→ migrate 無待套用、seed 為 idempotent upsert（不重複）、theme batch all-or-nothing（不留半批無效 theme）（spec US3 AC2）。
- [ ] T020 [US3] job 失敗擋啟動：以**安全可重複、不動 committed seed** 的方式讓 job 非零退出 —— 用 throwaway compose override（`docker compose -f docker-compose.yml -f <override>.yml -p ttl-fail up`）把 `migrate` 服務的 `command` 覆寫為刻意失敗（如 `sh -c 'exit 1'`，或將其 `DATABASE_URL` 指向不存在的 host）→ 觀察 migrate `exited(1)`、api/worker 因 `depends_on: service_completed_successfully` **不被放行**（不在未就緒 schema 上服務）→ `docker compose -p ttl-fail down -v` 清掉。**不**編輯 `apps/api/src/infra/db/seeds/*`（spec US3 AC3）。
- [ ] T021 [US3] 手動 rerun/除錯：用 `docker compose run --rm migrate`（即重跑同一 one-shot job：`sh -c 'node --import tsx scripts/db-migrate.ts && node --import tsx scripts/db-seed.ts'`）手動補跑，確認因 idempotent 而安全（spec US3 AC4）。此命令稍後由 T022 記入 quickstart（**本任務不依賴 quickstart 完成**）。

---

## Phase 6：收尾（quickstart / 安全 evidence / 反模式稽核 / scope）
- [ ] T022 [P] `specs/012-docker-compose-deploy/quickstart.md`（+ README 連結）：正規 `cp .env.production.example .env` → 填 `POSTGRES_*`/密鑰/`ALLOWED_ORIGIN` → `docker compose up -d --build`（**只寫這一條 env 路徑**，DR-006）；必填 env 與失敗症狀；`docker compose ps` healthcheck 觀察；端到端 smoke；`down`/`down -v` 風險（`-v` 清資料 volume）；migrate+seed 自動 + 手動 rerun/除錯命令。
- [ ] T023 [P] 安全 evidence（SC-005）：`grep` web `dist` 無 `OPENAI_API_KEY`/`AUTH_JWT_SECRET` 等後端密鑰；**無實密鑰檔被追蹤** —— `git ls-files | grep -E '(^|/)\.env(\.|$)' | grep -vE '\.example$'` 為空（`*.example` 範本為刻意追蹤、不算密鑰）；image history（`docker history`）不含密鑰；缺 `AUTH_JWT_SECRET` 時 api fail-fast log（worker 不因缺 JWT 擋）。
- [ ] T024 **反模式稽核（drift / dead code / shim / legacy — 對齊 plan Constitution Check）**：
  - **drift**：確認 api/worker/migrate **共用同一 `Dockerfile.api` image**（grep compose 無第二個 api build）；production `command:` 跑的是與 dev **同一份**實體入口/腳本（`main.ts`/`worker.main.ts`/`db-migrate.ts`/`db-seed.ts`），無 prod-only 啟動邏輯；`DATABASE_URL` 由 `POSTGRES_*` 單一來源組出（無第二處整條 DSN）；nginx 路由僅一份 `nginx.conf`。
  - **dead code**：每個新檔都有消費者（`Dockerfile.api`→api/worker/migrate；`Dockerfile.web`/`nginx.conf`→nginx；`health.controller`→api healthcheck + smoke；`.env.production.example`→維運者；`.dockerignore`→build）；**未**新增投機服務（排程器/備份容器/registry 步驟）。
  - **shim**：production **未**保留 dev 的 `--env-file`/`--watch`；env 由容器注入，**無**「同時支援 .env 檔與注入」雙路徑參數。
  - **legacy**：dev script（`dev`/`worker:dev`/`db:migrate`/`db:seed`，帶 `--env-file`/`--watch`）= 刻意保留的 DEV 路徑、未動；**未**新增 prod package.json script（守住「唯一 app 變更 = /api/health」）。
  - 產出：稽核 checklist 結果記於 PR 描述。
- [ ] T025 `gitnexus_detect_changes()` 確認影響範圍（預期：`health.*` 新檔 + `app.module.ts` 編輯；`docker/`、`docker-compose.yml`、`.dockerignore`、`.env.production.example` 為新檔，不影響既有 execution flow）。提交前執行（CLAUDE.md）。

**✅ Checkpoint C**：部署文件齊備、安全 evidence 通過、反模式稽核全綠、影響範圍符合預期。

---

## Dependencies & Execution Order
- **Phase 1 Setup** → **Phase 2 Foundational**（BLOCKS 所有 US）→ **Phase 3–5 US1/US2/US3**（Foundation 完成後可平行驗證；建議依 P1→P2→P3）→ **Phase 6 收尾**。
- Phase 2 內：2a（health TDD：T002→T003→T004 順序）可與 2b/2c/2d 平行；`docker compose config`（T011）需 2b/2c/2d 完成。
- T012（up）依賴整個 Phase 2。**US2（T016/T017）** 對 T012 已起、已 seed 的主堆疊驗證（保留 volume 重啟）。**US3（T018/T020）** 的空 DB / 失敗模擬須在**獨立 compose project（`-p ttl-*`）或乾淨 volume** 上跑，跑完 `down -v` 清掉，**絕不**毀掉主驗證堆疊的資料；T019（再部署 idempotent）/T021（手動 rerun）可在主堆疊上跑。

## Parallel Opportunities
- `[P]`：T002（health 測試）、T006（nginx.conf）、T009（.dockerignore）、T010（.env 範本）、T022（quickstart）、T023（安全 evidence）可與各自相鄰任務平行（不同檔、無依賴）。

## 明確不在本批
- Kubernetes / Swarm、CI/CD pipeline、IaC（Terraform 等）、多主機編排、藍綠/金絲雀、監控告警堆疊、image registry 發佈流程。
- TLS 終結（交上游 LB/Cloudflare）、managed 外接 DB/Redis 模式。
- 改動既有 seed 的交易邊界、把 `tsx` 移到 dependencies、新增 prod package.json script。
- 任何投影片生成 / 設計系統 / 領域邏輯變更（除 `/api/health` 外不動 app）。

## Notes
- 提交前跑 `gitnexus_detect_changes()`（T025）；編輯 `AppModule` 前跑 `gitnexus_impact`（T001a）。
- 每個任務或邏輯群組完成後 commit；可在任一 Checkpoint 停下獨立驗證。
- smoke/持久化/migrate 驗證的 log/截圖留作 evidence（spec Review & Safety Notes）。

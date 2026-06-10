# Quickstart — Docker Compose 單機部署（012）

把整套（前端 + API + worker + 一次性 migrate + Postgres + Redis）用一條指令帶起。
**唯一支援的 env 路徑**：複製範本成 repo 根目錄 `.env`（DR-006）。

## 先決條件
- 一台 Linux 主機，安裝 **Docker Engine + Compose v2**（`docker compose version`）。
- 主機**不需** Node / pnpm / Postgres / Redis —— 全在容器內。
- TLS / 網域由**上游**（LB / Cloudflare）終結；本堆疊只聽 HTTP 80。

## 一鍵部署

```bash
cp .env.production.example .env      # 在 repo 根目錄
# 編輯 .env：至少填 POSTGRES_* / AUTH_JWT_SECRET / AUTH_ACCOUNTS / ALLOWED_ORIGIN（見下）
docker compose up -d --build
```

compose 會：建 image → 起 `postgres`/`redis` 並等其 healthcheck → 跑一次性 `migrate`
（migrate→seed 依序）→ 成功後才放行 `api`/`worker` → 最後起 `nginx`。

開站點：`http://<主機>:${HTTP_PORT:-80}`。

## 必填 env 與失敗症狀

| 變數 | 用途 | 沒填的症狀 |
|------|------|-----------|
| `POSTGRES_USER`/`PASSWORD`/`DB` | Postgres + 組出 `DATABASE_URL` | 缺 → migrate/api/worker 連不上 DB、fail-fast |
| `AUTH_JWT_SECRET` | API 簽發/驗證 JWT | 空 → **api** 啟動即 fail-fast（log 明確）；**worker** 不受影響（無 AuthModule） |
| `AUTH_ACCOUNTS` | 帳號白名單（seed + 登入） | `[]` → seed 0 帳號、無法登入 |
| `ALLOWED_ORIGIN` | production CORS 來源 | 不符 → 前端 `/api/*` 被 CORS 擋 |
| `OPENAI_API_KEY` | 生成用 LLM（可空） | 空 → 走 deterministic fallback（仍可生成） |
| `HTTP_PORT`（選填） | nginx 對外埠（預設 80） | — |

> `DATABASE_URL` / `REDIS_URL` **不要**手填 —— compose 由 `POSTGRES_*` 與內部服務網路組出。

## 觀察健康狀態

```bash
docker compose ps
```

期望：`postgres`/`redis`/`api`/`nginx` 為 **healthy**、`worker` 為 **running**（無 healthcheck，
非 HTTP 程序）、`migrate` 為 **exited (0)**。

- `api` healthcheck 打 `GET /api/health`（liveness，不查 DB/Redis）。
- DB/Redis 就緒由各自 `pg_isready` / `redis-cli ping` gate，不靠 `/api/health`。

## 端到端 smoke

1. 首頁 SPA 開得起來。
2. `curl -fsS http://<主機>:${HTTP_PORT:-80}/api/health` → `200 {"status":"ok"}`。
3. 登入（`POST /api/auth/login`）→ 提交非同步生成 → 輪詢至完成 → 預覽 + 下載 self-contained HTML。

## migrate + seed（自動 / 手動）

- **自動**：每次 `up` 都會跑一次 `migrate` job（migrate 無待套用即略過；seed 為 idempotent
  upsert，重跑安全；theme batch all-or-nothing）。job 非零退出時，api/worker 因
  `depends_on: service_completed_successfully` **不會被放行**（不會在未就緒 schema 上服務）。
- **手動 rerun / 除錯**（補跑同一 one-shot job，idempotent 安全）：
  ```bash
  docker compose run --rm migrate
  ```

## 啟停與資料

```bash
docker compose down       # 停服務，保留資料 volume（pgdata/redisdata）→ 下次 up 資料還在
docker compose down -v    # ⚠️ 連同 volume 一起刪：清空 DB 與帳號/deck，務必確認
docker compose restart    # 重啟；api/worker 經 depends_on gate 重新連線、不 crash loop
```

## 安全注意
- 後端密鑰（`OPENAI_API_KEY` / `AUTH_JWT_SECRET` / 帳號雜湊 / DB 連線字串）**只**存在於後端容器 env，
  **不**進 web bundle、**不**進 image 層、**不**進 git。
- `.env` 與憑證受 `.gitignore` / `.dockerignore` 阻擋，不入庫/不入映像；範本 `.env.production.example`
  為刻意追蹤、不含實密鑰。

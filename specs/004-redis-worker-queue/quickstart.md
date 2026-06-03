# Quickstart: Redis Worker Queue for Preview Jobs

本文件提供 004 的手動驗證路徑。目標：確認生成已移出 API 主程序、job 狀態跨重啟／跨實例可追蹤、失敗與逾時安全收斂、無敏感細節外洩。

## 前置

- Node.js `v20.19.5`、pnpm `10.30.3`、Docker（用來跑本機 Redis）。
- 已安裝相依：`pnpm install`（含新增的 `bullmq`、`ioredis`）。

## 0. 啟動 Redis（必要）

```bash
docker run --rm -p 6379:6379 --name slides-redis redis:7
```

於 `.env` 設定（見 `.env.example`）：

```bash
REDIS_URL=redis://127.0.0.1:6379
# 其餘沿用既有 OPENAI_API_KEY 等設定；未設 OPENAI_API_KEY 時走 deterministic fallback
```

> **fail-fast 驗證**：若不啟動 Redis 就送出 job，API 必須回安全錯誤且不建立 job（不洩漏連線字串）。

## 1. 啟動 API 與 worker（兩個程序）

```bash
# 視窗 A：HTTP API
pnpm --filter @slides-agent/api dev

# 視窗 B：worker（不開 HTTP）
pnpm --filter @slides-agent/api worker:dev
```

兩者皆連到同一個 Redis。

## 2. 送出長時間 job 並驗證「主程序卸載」（US1）

```bash
# 送出一份較大的來源內容（會觸發多段 LLM 生成）
curl -s -X POST http://127.0.0.1:3000/api/slides/preview-jobs \
  -H 'content-type: application/json' \
  -d '{"sourceContent":"<貼上較長的內容>","deckBrief":{"purpose":"投資人簡報","audience":"投資人"}}'
# → 應在 2 秒內回 202 { jobId, status: "queued", ... }
```

在 job 仍在 worker 生成期間：

```bash
# 連續輪詢 + 再送一個 job，觀察 API 立即回應、不被生成阻塞
for i in $(seq 1 10); do \
  curl -s -o /dev/null -w "poll %{time_total}s\n" \
    http://127.0.0.1:3000/api/slides/preview-jobs/<jobId>; \
done
```

**預期**：輪詢回應時間與閒置時相近；生成進度由 worker 視窗的 log 推進（stage=content_planning → … → completed）。

## 3. 驗證持久化與跨重啟追蹤（US2）

1. 送出一個 job，等它進入 `running`。
2. **重啟 API 程序**（Ctrl-C 視窗 A 後重跑），worker 不動。
3. 以原 `jobId` 輪詢：

```bash
curl -s http://127.0.0.1:3000/api/slides/preview-jobs/<jobId>
# → 仍回真實狀態（running 或 succeeded），而非 unavailable
```

4.（選用）以第二個 API 埠啟動另一個 API 副本（`PORT=3001`），輪詢同一 jobId，應讀到相同狀態。

## 4. 驗證 worker 失敗與逾時收斂（US3）

- **生成失敗**：以可控失敗情境（例如配置一個會失敗的 provider 設定或注入錯誤）送出 job，輪詢應得 `failed` + 安全 `failure`（`code`、`failedStage`、`retryGuidance`），**不含** API key／provider 原始錯誤／prompt／stack trace。
- **worker 崩潰／逾時**：在 worker 處理途中強制結束 worker 程序。該 job 不會被重試；於建立後 5 分鐘內，API 端 timeout sweep 應把它標記為 `failed`（`code = PREVIEW_JOB_TIMEOUT`）。

```bash
curl -s http://127.0.0.1:3000/api/slides/preview-jobs/<jobId>
# → status: "failed"，failure.failedStage 指向中斷階段
```

## 5. 驗證重試與過期回收

- **重試**：對失敗的 job，前端「重試」或重送 `POST /preview-jobs` 會建立**新的 jobId**；舊 job 的狀態與 evidence 不被覆蓋。
- **過期回收**：完成／失敗的 job 過了 retention 後，輪詢回 `expired`/`unavailable`；可用 `redis-cli KEYS 'preview-job:*'` 觀察鍵隨 TTL 消失，確認結果不無限累積。

## 6. 收尾

```bash
docker stop slides-redis
```

## 驗收對應

| 步驟 | Spec 對應 |
|------|-----------|
| 2 | US1 / FR-001、FR-002 / SC-001、SC-002 |
| 3 | US2 / FR-003、FR-004 / SC-003、SC-004 |
| 4 | US3 / FR-008、FR-009、FR-014 / SC-005 |
| 5 | FR-012、FR-015 / SC-006 |
| 0（fail-fast） | FR-013 |
| 全程 | CR-004 安全邊界 / SC-007 evidence 可追溯 |

## Evidence

### 自動化（已通過）

實作於 `004-redis-worker-queue` 分支，TDD 逐項綠燈：

- `packages/domain` serialization 來回測試（Date↔ISO 可逆、結構不符丟錯）。
- `apps/api` 單元/整合測試（以 `ioredis-mock` 驗證 Redis 行為）:
  - `queue-config`：缺 `REDIS_URL` fail-fast、預設值。
  - `redis-preview-job-store`：create + active-set + TTL、findById、跨「程序」讀取、succeeded 移出 active-set、終態不被覆蓋、active 列表、expire 對帳、Redis 失敗回 sanitized 錯誤。
  - `bullmq-preview-job-runner`：只入列 `{ jobId }`、`attempts:1`、不含完整 request。
  - `preview-job-execution`：階段推進 + 成功結果、例外轉 sanitized failure（無 `sk-secret` 外洩）。
  - `preview-job-timeout-sweeper`：逾時 job 收斂 `failed`、未逾時不動、lease 被佔用時跳過。
- 全套件綠：domain 74、contracts 15、api 48、web 7；`apps/api` 與 `packages/domain` `tsc --noEmit` 通過。
- 既有 003 contract test（`slides-preview-jobs.contract.test.ts`）在新 fail-fast 控制器下仍通過。

### 待手動執行（需本機 Redis + 兩個程序）

上方第 0–5 節的 live 端到端（主程序卸載觀察、重啟後輪詢、worker 崩潰逾時收斂、過期 TTL 觀察）尚未在本環境實跑，請依步驟以 `docker` Redis + `api dev` + `worker:dev` 驗證並回填觀察結果。

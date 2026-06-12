# `pptx-export-jobs` 模組（015 US2）

> 維護導覽：把「某個 deck 的某個 revision」匯出成 .pptx 的非同步工作。完整鏡射 `preview-jobs` 的模式（Redis 狀態 + BullMQ 分發 + 跨程序消費 + 逾時掃描 + HTTP 輪詢），動手前請先讀那邊的 README——本檔只講差異。

## 1. 這個模組負責什麼

**把「server 渲染好的 deck html」轉成「每張投影片一頁滿版截圖的 .pptx」，以 owner-scoped 非同步工作交付。**

流程：`POST /api/decks/:id/pptx-exports`（驗 deck 所有權、revision = current、頁數 ≤ 60、單人併發 = 1）→ 入列 → worker 以無頭 chromium 載入該 revision html、逐張 `section[data-slide-id]` 截圖（1920×1080，走 deck runtime 的 `deck:goToSlide` postMessage）→ pptxgenjs 組裝 → artifact 寫入共享磁碟 → 前端輪詢 `GET .../:jobId` → done 後 `GET .../:jobId/file` 下載。

## 2. 與 preview-jobs 的差異

| 面向 | preview-jobs | pptx-export-jobs |
|------|--------------|------------------|
| 狀態機 | queued/running/succeeded/failed/expired（多 stage） | **queued/processing/done/failed** 四態（逾時歸 failed，`failure.reason="timeout"`） |
| 路由 | `/api/slides/preview-jobs*` | `/api/decks/:id/pptx-exports*`（掛在 deck 資源下，**owner scope：非 owner 一律 404**） |
| 產物 | JSON result（存 Redis） | **檔案 artifact**（`FsPptxArtifactStore`，數 MB 不塞 Redis；api 與 worker 共享 `PPTX_ARTIFACT_DIR` volume） |
| 併發 | rate limit | rate limit + **單人併發=1**（`findActiveByAccount` 擋 409） |
| 逾時 | 5 分鐘 | **3 分鐘**（`PPTX_EXPORT_JOB_TIMEOUT_MS`；≤30 頁目標 90 秒內） |
| sweeper 額外職責 | 無 | **artifact retention purge**（mtime 超齡刪檔；失敗時 execution 也主動刪部分檔） |
| worker 依賴 | SlidesService（LLM 生成） | **playwright chromium + pptxgenjs**（零 LLM、確定性） |

## 3. 檔案職責

- `pptx-export-jobs.controller.ts` — 三端點 + 全部建立驗證（FR-003a revision 鎖定、FR-006 單人併發、FR-019 頁數上限）。
- `redis-pptx-export-job-store.ts` — Redis JSON + TTL + active set（key 前綴 `pptx-export-job:`）。
- `fs-pptx-artifact-store.ts` — artifact 寫/讀/刪/超齡清理；ref 由系統產生，無 path traversal 面。
- `slide-screenshotter.port.ts` / `playwright-slide-screenshotter.ts` — 截圖能力 port 與 chromium adapter（單元測試 fake port）。
- `pptx-builder.ts` — 純函式：PNG[] → pptx Buffer（16:9 滿版）。
- `pptx-export-job-execution.ts` — worker 流程：re-verify revision → 截圖 → 組裝 → 寫檔 → done；任何失敗 → failed + 刪殘檔。
- `pptx-export-job-timeout-sweeper.ts` — 逾時掃描 + artifact purge（分散式 lease，API 程序 only）。
- 其餘（queue.config / tokens / providers / queue.service / bullmq runner / api.runtime / worker.runtime / module）= preview-jobs 同名檔的逐一鏡射。

## 4. 部署備忘（012/015）

- 共用 api image 內建 chromium（`docker/Dockerfile.api` 的 `playwright install --with-deps chromium`；`PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`）。
- `docker-compose.yml`：api 與 worker 同掛 `pptx-artifacts` volume；`PPTX_ARTIFACT_DIR=/data/pptx-artifacts`（backend-env）。
- chromium 啟動參數 `--no-sandbox --disable-dev-shm-usage`（容器內必要）。
- env knobs：`PPTX_QUEUE_NAME` / `PPTX_WORKER_CONCURRENCY` / `PPTX_TIMEOUT_SWEEP_INTERVAL_MS` / `PPTX_ARTIFACT_DIR` / `PPTX_RATE_LIMIT_*`。

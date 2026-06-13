# Contract: PPTX 匯出工作（015，三段式非同步）

**用途**：把某 deck 的**目前 current revision** 匯出為 .pptx（每張 slide 一頁、1920×1080 截圖滿版）。鏡射 003/004 preview-jobs 子系統：建立 → 入列 → worker（無頭 chromium 逐頁截圖 + pptxgenjs 組裝）→ 前端輪詢 → 下載 artifact。匯出為 current-only：request 帶 adopted revision，後端驗證它仍是 current（被其他 tab 推進則失敗要求 reload），不退而匯出其他版本。

**Auth**：三個端點皆 `JwtAuthGuard`；artifact 與狀態 **scope 綁 owner 帳號**（`job.accountId === req.user.id`，否則 404，不洩漏存在性）。

---

## 1) 建立工作 — `POST /api/decks/:id/pptx-exports`

**Request**
```ts
{ revision: number }     // adopted 版本；MUST 仍為該 deck 的 current revision
```

**驗證**
1. deck 存在且屬 `req.user.id` → 否則 **404 `DECK_NOT_FOUND`**。
2. `revision` 仍為該 deck 的 **current** revision → 否則 **400 `PPTX_REVISION_MISMATCH`**（FR-003a：current-only；被其他 tab 推進為非 current 即失敗並要求 reload，不退而匯出他版）。
3. 該 revision 頁數 ≤ `PPTX_MAX_PAGES`(60) → 否則 **400**（FR-019）。
4. **原子 create-if-no-active**：store 的 `createIfNoActive` 以 per-account Redis `SET NX` 鎖在建立的同一原子操作內擋既有 in-flight（queued/processing）工作 → 已有 active 則 **409**（FR-006，單人併發=1，無 TOCTOU；非「先查 active 再 create」）。
5. 速率限制沿用既有 per-IP（鏡射 preview-jobs rate limit）。

**Response 202**
```ts
{ jobId: string; status: "queued"; statusUrl: "/api/decks/:id/pptx-exports/:jobId" }
```

---

## 2) 查詢狀態 — `GET /api/decks/:id/pptx-exports/:jobId`

**驗證**：`jobId` 格式合法；`job.accountId === req.user.id` 且 `job.deckId === :id` → 否則 **404**。

**Response 200**
```ts
{
  jobId: string;
  status: "queued" | "processing" | "done" | "failed";
  pageCount?: number;            // 進度/驗收
  downloadUrl?: string;          // status=done 時：/api/decks/:id/pptx-exports/:jobId/file
  failure?: { reason: "timeout" | "export"; message: string };   // status=failed（逾時 reason="timeout"，其餘 "export"）
  createdAt: string; updatedAt: string;
}
```
- 不存在 / 已過 TTL → **404**（內部 expired 對外即 404，鏡射 preview-jobs）。
- 進度粒度至少四態（FR-020）。

---

## 3) 下載 artifact — `GET /api/decks/:id/pptx-exports/:jobId/file`

**驗證**：同上 owner/deck scope；`status === "done"` 且 artifact 未過 TTL → 否則 **404**。

**Response 200**
- `Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation`（FR-017）
- `Content-Disposition: attachment; filename="<sanitized-title>-rev<N>.pptx"`
- body = pptx 二進位（由 artifactRef 串流）。

---

## 工作生命週期與資源（worker）

1. `queued`：建立即入列（BullMQ）。
2. `processing`：worker 取件 → 載入「該 revision 的 server 渲染 html」於 chromium（viewport 1920×1080）→ 逐張 `section[data-slide-id]` 切頁截圖（postMessage `deck:goToSlide` 或 DOM 顯示，畫面穩定後截）→ pptxgenjs 逐頁 full-bleed 嵌圖。
3. `done`：artifact 以 `${jobId}.pptx` 寫入專屬目錄（檔案 / local disk / 容器 volume + TTL 清理，已定案，見 research R5），存 `pageCount/byteSize`。
4. `failed`：截圖/組裝失敗或逾時 → 標記 failed、**冪等刪除該 job 的暫存與部分檔**（FR-018）；前端可重試（重建工作）。

**逾時/清理**：鏡射 preview-job timeout sweeper（分散式鎖、active set 掃描）；`PPTX_EXPORT_JOB_TIMEOUT_MS` 逾時歸 failed（`failure.reason="timeout"`）；artifact 到 `expiresAt` 由 `FsPptxArtifactStore.purgeOlderThan` 清理。`failure.reason` 為 `"timeout" | "export"` 列舉。

**併發**：單人 =1（store `createIfNoActive` 原子 `SET NX` 鎖，無 TOCTOU）；全域沿用 worker concurrency（`queue.config`）。

## 不變式

- **版本鎖定（current-only）**：匯出內容 = 經驗證仍為 current 的 adopted `revision` 的 server html，與該版線上預覽一致（含主題、圖表、文字樣式覆寫——截圖自動涵蓋，無額外處理）；非 current 即失敗，不匯出他版。
- **隔離**：跨帳號一律 404；artifact 不可被非 owner 取得。
- **無殘檔**：失敗/逾時/過期皆清理，無可下載半成品。

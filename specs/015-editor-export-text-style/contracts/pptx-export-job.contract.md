# Contract: PPTX 匯出工作（015，三段式非同步）

**用途**：把某 deck 的**某具體 revision** 匯出為 .pptx（每張 slide 一頁、1920×1080 截圖滿版）。鏡射 003/004 preview-jobs 子系統：建立 → 入列 → worker（無頭 chromium 逐頁截圖 + pptxgenjs 組裝）→ 前端輪詢 → 下載 artifact。

**Auth**：三個端點皆 `JwtAuthGuard`；artifact 與狀態 **scope 綁 owner 帳號**（`job.accountId === req.user.id`，否則 404，不洩漏存在性）。

---

## 1) 建立工作 — `POST /api/decks/:id/pptx-exports`

**Request**
```ts
{ revision: number }     // 目標版本；MUST 為該 deck 現存 revision
```

**驗證**
1. deck 存在且屬 `req.user.id` → 否則 **404 `DECK_NOT_FOUND`**。
2. `revision` 為該 deck 現存版本 → 否則 **400**（FR-003a：只匯出使用者指定且看得到的版本，不退而匯出他版）。
3. 該 revision 頁數 ≤ `PPTX_MAX_PAGES`(60) → 否則 **400**（FR-019）。
4. 該使用者無 in-flight（queued/processing）PPTX 工作 → 否則 **409**（FR-006，單人併發=1）。
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
  failure?: { reason: string; message: string };   // status=failed（逾時 reason="timeout"）
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
3. `done`：artifact 寫入可下載位置（建議檔案 + TTL，見 research R5），存 `pageCount/byteSize`。
4. `failed`：截圖/組裝失敗或逾時 → 標記 failed、**刪除暫存與部分檔**（FR-018）；前端可重試（重建工作）。

**逾時/清理**：鏡射 preview-job timeout sweeper（分散式鎖、active set 掃描）；`PPTX_EXPORT_JOB_TIMEOUT_MS` 逾時歸 failed；artifact 到 `expiresAt` 清理。

**併發**：單人 =1（建立時擋 in-flight）；全域沿用 worker concurrency（`queue.config`）。

## 不變式

- **版本鎖定**：匯出內容 = 指定 `revision` 的 server html，與該版線上預覽一致（含主題、圖表、文字樣式覆寫——截圖自動涵蓋，無額外處理）。
- **隔離**：跨帳號一律 404；artifact 不可被非 owner 取得。
- **無殘檔**：失敗/逾時/過期皆清理，無可下載半成品。

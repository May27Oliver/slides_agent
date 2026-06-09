# Quickstart / 手動驗證路徑：Deck 編輯頁（010，US1–US3）

前置：已登入；帳號下至少有一份成功生成（`status="ready"`、有 `currentRevision`）的 deck，最好含一張帶圖表的 slide。

## US1 編輯 → 重渲染 → 存版本

1. 從 `/decks` 或切換器開啟某 deck 的編輯頁 `/decks/:id/edit`。
2. 左欄純文字列表（編號 + 標題）點選一張 slide → 中欄載入該張可編欄位。
3. 改標題、訊息、一條 bullet、講者備註 → **右欄即時預覽（debounced）反映**。
4. 結構編輯：加一條 bullet、刪一條、重排；加一張新 slide、刪一張、把某張往前移。
5. 含圖表的 slide：確認圖表區顯示「本期暫不可編輯」且不可改。
6. 按「儲存」→ 預覽以 server 回傳 `html` 刷新。驗證：
   - `/decks/:id` 詳情顯示新版本內容；版本 +1、舊版仍在。
   - **parity**：存檔前右欄預覽與存檔後 iframe 逐字一致。
   - 保留的含圖 slide：**圖表與存檔前逐字一致**（持久化 chartIntents 生效）；新增 slide 為純文字、無圖。
   - （legacy deck：本欄位之前生成、無持久化 chartIntents）編輯後圖表退表格/文字 fallback 並有誠實標示，不謊報。
   - 改寫過的 bullet 溯源已清空、未改的仍在（如有檢視管道/測試輔助）。
7. 反例：把某 slide 必要欄位清空 / 刪到整份空 → 按儲存應**報錯、不建立版本**。

## US2 跨 deck 切換器

8. 在生成頁 `/` 與編輯頁 topbar 開啟切換器：搜尋框 + 最近 8 份（標題/狀態/時間）+「瀏覽全部歷史 →」。
9. 搜尋框輸入關鍵字 → 最近清單即時過濾。
10. 點某份 → 路由到其 `/decks/:id/edit` 並載入。
11. 「瀏覽全部歷史」→ `/decks` 列表頁（含搜尋）。
12. 編輯頁有未存變更時，透過切換器切換 → 應先提醒未存。

## US3 localStorage 草稿

13. 編輯數欄 → 等暫存週期（或測試注入 timer）→ 重整頁面 → 出現「還原未儲存編輯」提示 → 還原成功恢復編輯。
14. 按 DB「儲存」後重整 → 不再提示（草稿已清）。
15. 模擬他處已存新版本（`baseRevision` 落後）→ 重新進入 → 提示版本衝突並**載入顯示目前最新 revision**。
16. 有未存變更時關閉分頁 → 觸發離開提醒。

## 後端強制（對抗性，建議以測試覆蓋）

17. 直接以落後 `baseRevision` 打 `POST /api/decks/:id/revisions` → **409**。
18. payload 篡改保留 slide 的圖表塊 / 新增 slide 夾帶 chart_placeholder → **400**、無新版本。
19. 別人的 deck id → **404**。

## 跨切面

20. zh-TW/en/ja 三語、窄視窗（三欄堆疊）、`prefers-reduced-motion` 各檢一輪；編輯器與切換器鍵盤可操作、focus 可見。

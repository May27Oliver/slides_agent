# Quickstart / 手動驗證：主題庫手動選擇（011）

前置：已登入；DB 已 seed 主題（font 57 / palette 96 / style 67）。

## US1 — 生成頁指定主題（第一次就做對，零 token）
1. 在生成頁設計區，點「瀏覽全部」開主題瀏覽器。
2. 切到三軸（font / palette / style），各看到 swatch 清單、可搜尋/分頁；各挑一個（或只挑想換的軸）。
3. 「目前組合摘要」顯示三軸選擇（未挑的軸標「自動」）。
4. 送出生成 → 驗證：
   - 生成結果的 `selectedTheme` 三軸 id = 所挑（未挑的軸 = 關鍵字 baseline）。
   - 與「不開瀏覽器、直接生成」相比，**LLM 呼叫數相同**（主題不影響 token）。
5. 反例：完全不開瀏覽器 → 行為與現況一致（6 張卡 / 關鍵字 selectTheme）。

## US2 — 編輯頁換主題（WYSIWYG、確定性）
6. 開某 deck 編輯頁，進主題 picker 入口（沿用 010 版面）。
7. 換 palette（或任一軸）→ 右側即時預覽以新 styleKit 重渲染；**文字/條列/圖表不變**。
8. 按儲存 → 新版本（version +1），`selectedTheme` 反映換後主題；舊版保留；**過程零 LLM**。

## US3 — 瀏覽完整主題庫
9. palette 軸（96 筆）→ 捲動/搜尋順暢（輕量 swatch、非 live 全渲染）。
10. 每筆顯示 name + swatch（顏色/字體樣本/風格標籤）。

## 失敗安全 / Edge
11. 指定一個已停用/不存在的主題 id（用 API 直打）→ 該軸退回 baseline、有 fallback 標記、不報錯、仍生成。
12. 只指定 palette → font/style 走 baseline（自動）。
13. legacy deck（無三軸 id）編輯換主題 → baseline 退回重跑 selectTheme/預設，仍可換。

## 跨切面
14. zh-TW/en/ja 三語、窄視窗（三軸 picker 可堆疊）、`prefers-reduced-motion`；picker 鍵盤可操作、focus 可見。

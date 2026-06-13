# Quickstart / 手動驗證: 016 即時預覽就地更新

**Branch**: `016-live-preview-incremental-update`

驗證「編輯時不再整頁重載、不重抓字型、不跳頁、無閃爍」，且 Save/換主題/切 deck 仍正確。

## 前置

- 起前後端、登入、開一個多頁 deck（含字型/顏色覆寫）的編輯頁，切到第 3 張之後。

## US1 — 編輯就地更新、零重載（核心）

1. F12 → Console 貼上（量 iframe 是否重載）：
   ```js
   (function(){var f=document.querySelector('iframe[sandbox]');var n=0;
     f.addEventListener('load',function(){console.log('FULL RELOAD #'+(++n));});
     console.log('watching reloads');})();
   ```
2. 在**第 3 張**編輯標題文字、拖文字大小、改顏色。
   - **預期**：預覽即時更新、**停在第 3 張**、無白屏/動畫重播閃爍；Console **不再印 `FULL RELOAD`**（編輯不觸發重載）。
3. F12 → Network → 篩 `css2`/Font → 清空 → 做一個**不換字型**的編輯。
   - **預期**：**沒有**新的字型/css2 請求（FR-003 #2 / SC-002）。
4. 把某欄位字型改成**先前沒用過**的家族。
   - **預期**：只新增/更新該字型請求、預覽改用新字型、**仍不印 FULL RELOAD**。
5. 連續拖文字大小滑桿。
   - **預期**：預覽連續跟隨、無逐次閃爍。

## US2 — 重載情境仍正確

1. **換主題**（主題挑選器選一軸）→ 預覽整體更新正確（允許重載，Console 可印 FULL RELOAD）。
2. **Save** → 預覽顯示 server 權威 html（與下載一致）。
3. **切換到另一個 deck**（DeckSwitcher）→ 預覽重新初始化為新 deck。
4. **全螢幕（F）下編輯** → 就地更新同樣生效、不跳出全螢幕。

## Parity（自動為主，人工抽查）

- 編輯後就地更新的畫面，與「重新整理頁面（全量重載）」後同一份 deck 的畫面**一致**（同字型/大小/顏色/版面）。
- Save 後下載 HTML / 匯出 PPTX，與預覽一致（沿用 015 驗證）。

## 效能對照（可選）

- 用先前的 `srcdoc→load` instrumentation：改版前每次編輯 ~185–302ms 一次重載；改版後同樣編輯應為 **0 次重載**，就地更新主執行緒成本 ≤ ~30ms 量級。

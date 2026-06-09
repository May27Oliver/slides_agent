# Quickstart / 手動驗證：Frontend Style Controls

驗證 009 三條 user story 與無障礙約束。前置：本機可跑 `apps/web` + `apps/api`、能登入並生成簡報。

## US1 — 生成前可預覽風格選擇（P1）

1. 開生成表單 → 確認風格區為 **radio card gallery**，每張卡含：名稱、2–4 色票、heading/body 字體樣本、2–3 特徵 chip、密度標示（**非**純文字清單）。
2. 鍵盤 Tab/方向鍵可選取，focus 樣式可見。
3. 選「科技新創」→ 送出 → 驗證請求 `styleDirection` 帶該 preset 既定關鍵字、**無** `themeId`。
4. 切 zh-TW/en/ja → 標籤翻譯但所選關鍵字方向不變。
5. 窄視窗（<768px）→ 改單欄/水平可掃描 grid，不退化純文字。
6. 開系統 reduced-motion → 卡片動效預覽降為靜態。

## US2 — 生成後設計/圖表透明度（P2）

1. 準備兩份內容：(A) 含可成圖數列（收入占比、月營收時間序列、區域比較）；(B) 含「資料不足會 fallback」的數字（單位不一致/單點）。
2. 生成 A → 設計面板呈現：主題名稱(kitName)、色票(accentHues)、heading/body 字體樣本、視覺密度、結構特徵 chip（radius/shadow/glow/texture/animation 視主題而定）。
3. A 的圖表面板：標出實際 `visualKind`（pie_donut/line/bar，顯示為 i18n label）並可追溯對應 slide。**比對實際 deck 渲染**一致。
4. 生成 B → 圖表面板對 fallback 項標示為 **fallback（含 note code/message）**，**不**呈現為已畫圖。
5. 選到會退回 default 的主題情境（某軸無命中）→ 面板據 `ids`(null) / `fallback` 誠實標示，不捏造缺失特徵。
6. 確認面板資料**全來自 response metadata**（可於 network 檢視 `generationSummary.selectedTheme` / `renderedCharts`），前端未 parse HTML/CSS。
7. reduced-motion → 生成後動效標示降為靜態。

## US3 — 圖表 preset 預覽（P3）

1. 檢視 4 個 chart preset → 每個顯示代表圖型示意 + 一句說明（comparison→bar/pie、trend→line、metric→指標卡），且不暗示一定成圖。
2. 選「趨勢」→ 送出 → `chartEmphasis` 帶對應關鍵字，後端流程不變。

## 通用無障礙 / 一致性

- WCAG AA：色票與文字、按鈕/卡片對比達標。
- 詞彙一致：theme/kitName、visualDensity、structureFeatures、visualKind、fallback 在 UI 與面板一致。
- 截圖留證：card gallery、設計面板、圖表面板（含 fallback）、reduced-motion 靜態、窄視窗、三語。

## 自動化對應（非手動）

- 投影純函式、chart 結果收集、contracts schema、card gallery/面板/preset 元件、Playwright US1/US2 流程（見 plan.md Evidence Plan）。

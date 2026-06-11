# Quickstart: 014 編輯頁圖表編輯（驗證路徑）

## 前置

```bash
brew services start redis     # Redis（004 必要）
pnpm install
pnpm db:migrate               # 既有 migration（014 零新增）
pnpm dev:iterm                # API + worker + web
```

需要一份**含圖表**的 deck：在 <http://localhost:5173> 用含數字的內容（可用 `sample-deck-input.md`）生成並儲存。

## US1 — 換視覺類型（P1）

1. 「我的簡報」→ 開啟 deck → 進編輯頁，左欄選一張帶圖表的 slide。
2. 中欄圖表卡片 → 視覺選擇器把「長條」改「折線」→ 右欄 preview **即時**（無網路請求，DevTools Network 可驗）變折線。
3. 改選「圓餅」且數據非 part-to-whole → preview 呈降級視覺＋可讀 note（「比例總和不合法…」）。
4. 改回「auto」→ 與原生成結果一致。儲存 → 重新整理 → 維持所選視覺。
5. **驗證 parity**：儲存後 server 回傳的 html 與儲存前 preview 的 html 完全一致（測試自動驗；手動可比 iframe srcdoc）。

## US2 — 移除／從來源新增（P2）

1. 帶圖表的 slide → 「移除圖表」→ preview 版面回無圖布局。儲存後 DB 驗證：`revision.chartIntents` 仍含該 intent（未放置）。
2. 無圖內容頁 → 「新增圖表」→「從來源資料」清單：全部 intents 列出、已放置者標註「已用於第 N 頁」。
3. 挑一個放上 → 版面切圖文分欄（`has-chart-split`）。
4. 負面：對封面頁不顯示新增入口；API 直打 opening slide 的 add_chart → 400。

## US3 — 編輯數據點（P3）

1. 圖表卡片 →「編輯數據」表格：每列 label／數值／單位＋「來源資料」徽章。
2. 改一格數值 → 徽章變「使用者提供」＋單列還原鈕；preview 即時更新。
3. 新增一列（如 Q4 / 4.0 / M）、刪一列、拖曳排序、改圖表標題。
4. 刪到剩 1 點 → preview 降級 metric card ＋ `series_insufficient` note。
5. 儲存 → 重開：揭露註記「本圖表含使用者提供的數據點（n/m）」可見（編輯器與 summary 面板）。
6. 共享圖表（同 intent 兩頁）編輯時顯示「此圖表也用於第 N 頁」，兩頁連動。

## US4 — 手動輸入新增（P3）

1. 無圖頁 →「新增圖表」→「手動輸入」：標題＋視覺＋ 3 點數據 → 放置。
2. 儲存後驗證 `chartIntents` 多一個 `chart_user_r*` intent、facts 全為 `user_provided`、揭露 3/3。

## 自動化驗證

```bash
pnpm test            # domain + contracts + api + web（014 各層測試在內）
pnpm test:e2e        # Playwright：編輯圖表 happy path + 降級 note 呈現
pnpm lint && pnpm format
```

關鍵測試錨點（lean，spec CR-008/CR-010）：

| 層 | 檔案（新增） | 驗什麼 |
|----|----|----|
| domain | `packages/domain/test/deck-edit/apply-chart-operations.test.ts` | §4 套用規則矩陣、確定性 id、零部分套用、繼承封閉性、`[]` 回歸不變式 |
| domain | `packages/domain/test/rendering/chart-visual-override.test.ts` | override 各值×series 合格/不合格 → 視覺/降級/fallback 旗標 |
| domain | `chart-series-extractor` 既有測試擴充 | `metric` short-circuit＋無 metric 零變化；user 數據降級 table 顯示正確（鏡像） |
| contracts | `packages/contracts` 既有測試擴充 | `chartOperations` 形狀驗證＋對抗性形狀 |
| api | `decks.controller` 既有測試擴充 | 透傳、400/409、201 含 `userDataDisclosures` |
| web | `ChartEditorCard/ChartDataTable/AddChartPanel` 元件測試＋draft mutators 測試 | 徽章切換、還原、清單標註、共享提示、operations 合併規則 |

## 手動驗證（無法自動化，spec CR-015）

- [ ] 圖表視覺可讀性：split 版面下 label 不重疊、降級視覺對比足夠 → 編輯頁 preview 抽查 ＋ 下載 self-contained HTML 開檔目視。
- [ ] 鍵盤導覽（左右鍵翻頁）與 16:9 縮放在編輯後的 deck 不退化。

## 驗證紀錄（implement 完成時，2026-06-11）

- [x] **自動化全綠**：domain 314 ／ contracts 59 ／ api 227 ／ web 163 ／ Playwright e2e 12（含 `chart-editing.spec.ts` 2 條：US1 happy path 換視覺→preview 即時→儲存帶 operations；line override 降級＋note）。
- [x] **零 migration**：`pnpm db:generate` 無 schema 變更、drizzle 目錄零 diff。
- [x] **parity**：`live-preview-render` 測試證明 client/server html byte 一致、衍生 id 與揭露相同（含 chartOperations 路徑）。
- [x] **lint**：014 觸碰範圍零錯誤（repo 殘留 6 errors ＋ 1 warning 皆為既有檔案：`rate-limit.guard.test`、`slides-preview-jobs.contract.test`、`ThemePicker`、`death-inventory`，與本 feature 無關）。
- [ ] 上方兩項目視走查（split 可讀性／降級對比／鍵盤導覽／16:9）待人工於瀏覽器確認。

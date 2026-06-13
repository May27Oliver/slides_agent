---
description: "Task list — 016 即時預覽就地更新（取代 iframe 整頁重載）"
---

# Tasks: 即時預覽就地更新（postMessage 就地抽換投影片，消除 iframe 整頁重載）

<!-- This project writes Spec Kit artifacts in Traditional Chinese by default. -->

**Input**: `/specs/016-live-preview-incremental-update/`（plan.md / spec.md / research.md / data-model.md / contracts/ / quickstart.md）

**範圍**：US1（P1 編輯零重載/不閃爍/不跳頁）、US2（P2 換主題/Save/切 deck 仍正確 + parity）。兩個 US 高度耦合於同一條改動鏈，**一起交付**才有價值。

**鐵則（貫穿全程）**：**純增量** — 既有 `renderTemplateDeck` 的 `html` 輸出與 deck runtime 既有行為**逐字不變**。護欄 = 既有 domain 渲染測試（asserting html）必須全綠；任一紅燈即代表破壞增量原則，停下重審。

**Tests**: TDD——先寫聚焦失敗測試再實作。domain 用 vitest；web 元件 vitest+RTL；關鍵流程 Playwright。

## 路徑慣例

- domain 測試：`packages/domain/test/rendering/*.test.ts`
- web 元件測試：`apps/web/src/features/deck-editor/*.test.tsx`
- web e2e：`apps/web/tests/e2e/*.spec.ts`

**格式**：`[ID] [P?] [Story] 描述`。`[P]` = 不同檔案、無相依，可並行。

---

## Phase 1：Setup

- [ ] T001 確認分支 `016-live-preview-incremental-update`、`pnpm test` 基線全綠；本 feature **零 migration、零新依賴、零後端/契約變動**（`pnpm db:generate` 無 diff）。
- [ ] T001a **編輯前 impact 分析（CLAUDE.md）**：已對 `renderTemplateDeck`、`buildDeckRuntimeScript` 跑 upstream impact = **CRITICAL**（餵養生成/下載/PPTX/preview 全線）。化解 = 純增量。動工時若臨時觸及其他符號（`buildDeckStyleCss`、`renderLivePreview`、`LivePreview`）比照補跑；**全程以既有渲染測試全綠為護欄**。

---

## Phase A：domain `renderSlidesRegion`（plan A；純重構，html 不變）

- [ ] T002 [US1] `packages/domain/test/rendering/template-html-renderer.*`（擴充）先寫失敗：
  - `renderSlidesRegion(input)` 回 `{ slidesHtml, renderedCharts }`，其 `slidesHtml` == 既有 `renderTemplateDeck(input).html` 內的投影片 sections 區（同一份字串）。
  - **回歸護欄**：對既有 fixture，`renderTemplateDeck(input).html` **逐字不變**（snapshot/equality；確保抽出重構零輸出差異）。
- [ ] T003 [US1] 重構 `packages/domain/src/rendering/template-html-renderer.ts`：抽出並 `export function renderSlidesRegion`（既有 slides loop + join），`renderTemplateDeck` 改呼叫它組裝文件（head + fontLink + overrideFontLink + region + script，組裝結果不變）。`packages/domain/src/index.ts` 匯出 `renderSlidesRegion` 與 `RenderedSlidesRegion`。
- [ ] T004 [US1] 跑 `packages/domain` 全測試（尤其既有 rendering 測試）全綠 → 確認 html 輸出未變。

---

## Phase B：deck runtime patch handler + 動畫抑制 CSS（plan B）

- [ ] T005 [US1] `packages/domain/test/rendering/*`（runtime 字串/行為測試，可用 jsdom 執行 runtime 字串）先寫失敗：
  - runtime 含 `deck:patchSlides` handler，且**只接受 `event.source === window.parent`**；
  - 收到 patch → 換投影片 sections、重抓 `.slide`、依新數量重建 dots、`show(clamp(index))`、`deck` 加 `deck-static` class、依 `fontsHref` 維護 `#override-fonts` link（同 href 不動、null 移除）；
  - **既有行為不變**：`deck:goToSlide` 仍切頁、`deck:slideChanged` 廣播時機不變、`show(0)` 初始化不變。
- [ ] T006 [US1] 重構 `packages/domain/src/rendering/deck-runtime-script.ts`：
  - 把 init 的「抓 slides / 建 dots」改為可重呼叫 `refreshSlides()` / `rebuildDots()`；
  - 投影片 sections 包進可定位容器（或以標記界定），讓 patch **只換 sections、不動 progress/sidedots/controls**；
  - 新增 `deck:patchSlides` handler（含來源檢查、`ensureOverrideFontLink`、`deck-static`）；既有 handler/輸出結構不變。
- [ ] T007 [P] [US1] `packages/domain/src/rendering/deck-style-css.ts`：新增 **inert** 規則
  `.deck.deck-static .anim{animation:none!important;opacity:1;transform:none}` + chart 進場 selectors `animation:none!important`。既有 CSS 測試（sanitization/contrast/bgrade）回歸綠（class 永不於下載/standalone 加上 → 零影響）。
- [ ] T008 [US1] 若 sections 容器化動到 `template-html-renderer`（B 與 A 交界），重跑 domain 全測試確認 html 仍逐字不變（容器若新增需同步更新 A 的回歸 snapshot，並確認下載/生成輸出可接受該容器——以「inert、不影響呈現」為準）。

---

## Phase C：web 橋 + LivePreview frameKey 分流（plan C）

- [ ] T009 [US1] `apps/web/src/features/deck-editor/live-preview-render.test.ts`（擴充）先寫失敗：`renderLivePreview` 成功時回傳 `slidesHtml`（來自 `renderSlidesRegion(merged deck)`），且與 `html` 內投影片區一致。
- [ ] T010 [US1] `apps/web/src/features/deck-editor/live-preview-render.ts`：`LivePreviewResult` 增 `slidesHtml`；以 `payload.slideDeck/designPlan/chartIntents` 呼叫 `renderSlidesRegion` 取得。
- [ ] T011 [US1][US2] `apps/web/src/features/deck-editor/LivePreview.test.tsx`（新增/擴充）先寫失敗（mock `iframe.contentWindow.postMessage`）：
  - 同 frameKey（`deckId:revision:themeKey`）下編輯（workingDeck 變）→ **送 `deck:patchSlides`（含 slidesHtml/index/fontsHref）、不更換 srcDoc**；
  - frameKey 變（換 themeSelection / base.revision / deckId）→ **更換 srcDoc（重載）**、不送 patch；
  - load 完成後補送一次最新 patch（覆蓋載入期間的編輯）。
- [ ] T012 [US1][US2] 重構 `apps/web/src/features/deck-editor/LivePreview.tsx`：
  - 計算 `frameKey`；`frameHtml`（srcDoc）只在 frameKey 變時更新（= `authoritativeHtml ?? local.html`）；
  - 同 frameKey 的 `slidesHtml`/`selectedIndex`/`fontsHref` 變 → `postMessage({type:"deck:patchSlides", slidesHtml, index, fontsHref})`（`fontsHref = buildOverrideFontsHref(該 deck 用到的家族)`）；
  - `onLoad` → 記 `loadedFrameKey` + `deck:goToSlide(selectedIndex)` + 補送一次 patch；
  - 降級：`loadedFrameKey !== frameKey` 時不送 patch（load 完補送）。既有 16:9 stage/scale/全螢幕/debounce/reverse-sync 不動。

---

## Phase D：e2e + 效能驗證（plan D）

- [ ] T013 [US1] `apps/web/tests/e2e/preview-incremental.spec.ts`（新增）：多頁 deck 編輯第 N 張 → 預覽更新且**整個編輯期間 iframe 無 `load` 事件**（在頁面注入 load 計數）、預覽**停在第 N 張**；hermetic route-mock（沿用既有 deck-editor e2e 模式）。
- [ ] T014 [US2] 同檔或新增：**換主題 / Save / 切 deck** → 確認走 srcDoc 重載且結果正確（換主題後全域樣式更新、Save 顯示權威 html）。
- [ ] T015 [US1] parity e2e：就地更新後的預覽 DOM 與「重新整理頁面（全量重載）」後一致（抽查 `.slide-title` style / 字型 / 頁數）。
- [ ] T016 [US1] quickstart 人工：Console 編輯零 `FULL RELOAD`、Network 不換字型則零 `css2` 請求、目視無閃爍/不跳頁、全螢幕下就地更新生效；對照 185–302ms → 0 次重載。

---

## Phase E：收尾

- [ ] T017 **提交前 `gitnexus_detect_changes()`**（CLAUDE.md）：核對影響面只落在 `template-html-renderer`/`deck-runtime-script`/`deck-style-css`/`live-preview-render`/`LivePreview` 與其測試；**確認既有 domain 渲染測試全綠（html 不變護欄）**；任一非預期擴散即停下重審。
- [ ] T018 全綠驗證：`pnpm test`（domain/contracts/api/web）+ `apps/web` e2e + `pnpm -r exec tsc --noEmit` 全綠。

---

## Dependencies & Execution Order

- **A → B → C → D → E**（嚴格相依鏈）：A 提供 `renderSlidesRegion`（C 依賴）；B 提供 runtime patch handler（C 送的訊息要有人收）；C 串接送出 patch；D 驗證；E 收尾。
- 唯一可並行：T007（CSS inert 規則）與 T005/T006（runtime）不同檔可並行 [P]。
- 本 feature 無法分階段交付價值（要 A+B+C 都到位編輯才會走 patch）；但每階段獨立可測。

## Notes

- 守鐵則：**既有 `renderTemplateDeck` html 與 runtime 既有行為逐字不變**；每改一步先跑既有 domain 渲染測試。
- 零依賴、零 migration、零後端/契約變動、零 LLM。
- 降級回退（通道未就緒）保底，永不卡住編輯/預覽。
- 每完成一任務或邏輯群組即 commit。

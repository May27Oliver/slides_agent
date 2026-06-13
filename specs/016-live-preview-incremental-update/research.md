# Research: 016 即時預覽就地更新

**Branch**: `016-live-preview-incremental-update` | **Date**: 2026-06-13

> ⚠️ **Impact = CRITICAL（已知、且以「純增量」化解）**：`renderTemplateDeck` / `buildDeckRuntimeScript` 餵養整條生成+預覽管線（`generatePreview`、`applyDeckEdit`、preview scripts、下載 HTML、PPTX）。本 feature 的鐵則是 **既有 `html` 輸出與 runtime 既有行為逐字不變**——只做加法（新匯出函式、新回傳欄位、新 inbound 訊息、inert CSS class）。domain 既有渲染測試（asserting html）即護欄；任一既有測試紅燈代表破壞了增量原則。

---

## R1. 「投影片區標記」來源 = 抽出 `renderSlidesRegion`（clarify #2）

**現況**：`renderTemplateDeck`（template-html-renderer.ts）內部已算 `const slides = rendered.map(r => r.html).join("\n")`，再組進整份文件。`RenderedTemplateDeck = { html, renderedCharts }`。

**決策**：把「投影片區渲染」抽成獨立純函式並匯出，全量渲染與就地更新**共用同一支**（parity 結構上保證）：

```ts
// template-html-renderer.ts
export interface RenderedSlidesRegion { slidesHtml: string; renderedCharts: RenderedChartSummary[]; }
export function renderSlidesRegion(input: TemplateDeckInput): RenderedSlidesRegion { /* 現有 slides loop + join */ }

export function renderTemplateDeck(input): RenderedTemplateDeck {
  const region = renderSlidesRegion(input);
  // …head + fontLink + overrideFontLink + region.slidesHtml + script…（既有組裝，html 輸出不變）
}
```

**取得路徑（web）**：`renderLivePreview` 已用 `applyDeckEdit` 得到 merged deck（`payload.slideDeck` / `payload.designPlan` / `payload.chartIntents`）。額外呼叫 `renderSlidesRegion({ deck: payload.slideDeck, designPlanningResult: payload.designPlan, chartIntents: payload.chartIntents })` 取 `slidesHtml`，放進 `LivePreviewResult`。
- 多一次 slides 渲染（~1–2ms，已量測可忽略），但**不污染 applyDeckEdit 的持久化 payload**（slidesHtml 不入 DB）。
- parity：renderSlidesRegion 就是 renderTemplateDeck 用的同一支 → 與全量輸出逐字相同。

**否決替代**：(a) 把 slidesHtml 塞進 `applyDeckEdit` payload / `PreviewArtifact` → 會被持久化/外洩到 DB 與 generation 路徑，污染契約；(b) runtime 解析整份 html 抽 sections（clarify 已否決，且每次解析整份）。

---

## R2. LivePreview：patch vs 全量重載的切換（核心）

**現況**：`html = authoritativeHtml ?? local.html` → `<iframe srcDoc={html}>`。`html` 一變 → React 換 `srcdoc` 屬性 → iframe 重載。

**決策**：引入 `frameKey`，把「換 srcDoc（重載）」與「postMessage patch（就地）」分流：

```
frameKey = `${deckId}:${base.revision}:${themeKey}`   // themeKey = JSON(themeSelection)
```
- **frameKey 改變**（切 deck / Save 後新 revision / 換主題）→ 設新的 `frameHtml`（= `authoritativeHtml ?? local.html`）給 `srcDoc` → **全量重載**（FR-006）。
- **frameKey 不變**（同一份 deck 的文字/樣式/結構編輯）→ **不動 srcDoc**；送 `deck:patchSlides` postMessage（FR-001）。

理由：
- 換主題改的是 `<style>`（全域 CSS）→ 必須重載（patch 投影片區無法套用新 CSS）；themeKey 進 frameKey 即可。
- Save 後 `base.revision` 變 → frameKey 變 → 以 server 權威 html 重載（FR-006 #2）。**parity 保證** server html 的投影片結構與本地一致，故後續對它 patch 安全。
- `savedHtml` **不**進 frameKey（否則「存檔後第一次編輯」清掉 savedHtml 會多觸發一次重載）；存檔當下 revision 已變 → 已重載。

**狀態機**（LivePreview）：
- `frameHtmlRef` / `loadedFrameKeyRef`：記住目前 iframe 載入的是哪個 frameKey。
- frameKey 變 → setState frameHtml=新 html（srcDoc 重載）；`onLoad` → `loadedFrameKey = frameKey` + 送一次 `deck:goToSlide(selectedIndex)` + 送一次 patch（補齊載入期間可能漏掉的最新 slides）。
- 同 frameKey、`slidesHtml`/index 變 → 若 `loadedFrameKey === frameKey` 送 `deck:patchSlides`；否則略過（載入完成時會補送）。

**降級回退（FR-007）**：runtime 必有 patch handler（我們產的 html 都含新 runtime）。唯一「未就緒」是 onLoad 前的短暫窗口 → 用「load 後補送 patch」覆蓋，不會漏更新。若未來要更保險，可在 N ms 內未收到 runtime ack 就改設 frameHtml 強制重載；但 MVP 不需 ack（單一受信任 iframe）。

---

## R3. deck runtime patch handler（buildDeckRuntimeScript 增量）

runtime 的 `slides`/`dots` 是 **init 時抓一次**。新增 inbound 訊息處理：

```js
window.addEventListener("message", function (event) {
  if (event.source !== window.parent) return;          // 來源限制（FR-008）
  var data = event.data;
  if (data && data.type === "deck:patchSlides" && typeof data.slidesHtml === "string") {
    deck.classList.add("deck-static");                 // 關閉進場動畫重播（FR-004）
    ensureOverrideFontLink(data.fontsHref);            // 新字型才更新 <link>（FR-003）
    var container = /* 投影片所在容器 */;
    container.innerHTML = data.slidesHtml;             // 整區全換（clarify #1）
    slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));  // 重抓
    rebuildDots();                                     // dots 依新數量重建
    show(typeof data.index === "number" ? data.index : current);  // 還原/夾住目前頁
  }
  // 既有 deck:goToSlide 不變
});
```
- 既有 `deck:goToSlide` handler 早於此存在的安全檢查只看 `data.type`；新增的 `event.source !== window.parent` 檢查**只加在新 handler**，不動既有（避免改變既有行為）。實作時兩個 handler 可合併並都套來源檢查（更嚴，且既有測試應仍綠——待驗）。
- `slides`/`dots`/`rebuildDots` 需把原本 init 區塊重構成可重呼叫的函式（純增量重構，輸出 html 不變）。
- **動畫抑制**：靠新 CSS `.deck.deck-static .anim{animation:none;opacity:1;transform:none}` + chart 進場同理（見 R4）。一旦進入編輯（首次 patch）即加 `deck-static`，之後不再播進場（初次載入仍有動畫）。
- **投影片容器**：目前 `<main class="deck">` 內直接是 `.slide` sections + progress/sidedots/controls。`innerHTML` 全換會連 progress/dots/controls 一起洗掉 → **改為只換 sections**。最穩做法：渲染時把 sections 包進一個容器（如 `<div class="slides-region">`）或以標記界定；plan 決定——傾向「runtime 移除舊 `.slide` 後插入新 slidesHtml 於 controls 之前」，不動 progress/sidedots/controls 節點。

---

## R4. 動畫抑制 CSS（deck-style-css 增量，inert）

新增（inert，除非 `.deck-static` 被加上，只有編輯預覽會加）：
```css
.deck.deck-static .anim{animation:none!important;opacity:1;transform:none}
.deck.deck-static .chart-line,.deck.deck-static .chart-bar,.deck.deck-static .chart-pie-slice,
.deck.deck-static .chart-value,.deck.deck-static .chart-dot{animation:none!important}
```
- 對下載/匯出/standalone deck **零影響**（class 永不加）。
- 既有 reduced-motion 區塊已有同類 selector 可參考。

---

## R5. 字型 link 動態更新（FR-003）

patch 訊息帶 `fontsHref`（= `buildOverrideFontsHref(該份 deck 用到的家族)`，015 已有此函式）。runtime `ensureOverrideFontLink(href)`：
- 維護一個 id 固定的 `<link id="override-fonts">`；href 與現有不同才更新（相同則不動 → 不重抓，FR-003 #2）。
- href 為 null（無覆寫字型）時移除該 link。
- 新字型 link 更新後字型非同步載入，patch 內容先以 fallback 顯示、載入完成自動換（可接受，不重載文件）。

---

## R6. 既有機制沿用

- 16:9 stage、scale、`selectedIndex` 同步、全螢幕、250ms debounce：**不動**。patch 走在 debounce 之後（同現行 `debounced` 時機）。
- `onSummary`（chart 卡片證據）：仍由 `local.generationSummary` 提供，不受 patch 影響。
- reverse-sync（`deck:slideChanged`）：不變。

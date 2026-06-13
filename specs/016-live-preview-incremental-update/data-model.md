# Data Model: 016 即時預覽就地更新

**Branch**: `016-live-preview-incremental-update` | **Date**: 2026-06-13

無持久化資料、無 DB/契約變動。新增的是**渲染輸出的取得方式**與**父視窗 ↔ iframe 的訊息協議**。

---

## §1. `renderSlidesRegion`（domain，新匯出純函式）

`packages/domain/src/rendering/template-html-renderer.ts`

```ts
export interface RenderedSlidesRegion {
  slidesHtml: string;                 // 只含 <section class="slide">… 的字串（join 後）
  renderedCharts: RenderedChartSummary[];
}
export function renderSlidesRegion(input: TemplateDeckInput): RenderedSlidesRegion;
```
- 由 `renderTemplateDeck` 內部既有的「slides loop + join」抽出；`renderTemplateDeck` 改為呼叫它組裝文件。**`renderTemplateDeck` 的 `html` 輸出逐字不變**（純重構）。
- parity：就地更新與全量渲染共用同一支 → 投影片標記必然相同。

## §2. `LivePreviewResult.slidesHtml`（web 渲染橋）

`apps/web/src/features/deck-editor/live-preview-render.ts`

```ts
type LivePreviewResult =
  | { ok: true; html: string; slidesHtml: string; generationSummary: GenerationSummary }
  | { ok: false; reason: string };
```
- `slidesHtml` = `renderSlidesRegion({ deck: payload.slideDeck, designPlanningResult: payload.designPlan, chartIntents: payload.chartIntents })`。
- `html` 仍保留（全量重載時用）。

## §3. PreviewPatchMessage（父 → iframe，postMessage）

```ts
interface DeckPatchSlidesMessage {
  type: "deck:patchSlides";
  slidesHtml: string;          // §1 的投影片區標記
  index: number;               // 套用後要停留的投影片索引（runtime 會夾到合法範圍）
  fontsHref: string | null;    // 該份 deck 用到的覆寫字型 Google Fonts href（015 buildOverrideFontsHref），無則 null
}
```
- 既有 `deck:goToSlide`（010）不變；`deck:slideChanged`（iframe→父，reverse-sync）不變。
- runtime 對 inbound 訊息加來源檢查 `event.source === window.parent`（FR-008）。

## §4. deck runtime 增量（buildDeckRuntimeScript）

新增/重構（輸出 html 結構不變，僅 runtime 行為加法）：
- 把 init 的「抓 slides / 建 dots」重構為可重呼叫：`refreshSlides()`、`rebuildDots()`。
- `ensureOverrideFontLink(href)`：維護 `<link id="override-fonts">`（href 同則不動、null 則移除）。
- `deck:patchSlides` handler：加 `.deck-static` → 更新字型 link → 換投影片區 innerHTML（只換 sections，不動 progress/sidedots/controls）→ `refreshSlides()` + `rebuildDots()` → `show(clamp(index))`。
- 投影片容器界定：渲染時把 sections 包進可定位的容器（plan 決定包法），讓 runtime 精準替換而不洗掉 progress/dots/controls。

## §5. 動畫抑制 CSS（deck-style-css 增量，inert）

```css
.deck.deck-static .anim{animation:none!important;opacity:1;transform:none}
.deck.deck-static .chart-line,.deck.deck-static .chart-bar,.deck.deck-static .chart-pie-slice,
.deck.deck-static .chart-value,.deck.deck-static .chart-dot{animation:none!important}
```
class 僅由編輯預覽 runtime 在首次 patch 時加；下載/匯出/standalone 永不加 → 零影響。

## §6. 型別流向

```
domain renderSlidesRegion ──┐(同一支，parity)
renderTemplateDeck ─────────┘→ 既有 html（生成/下載/PPTX 不變）
        │
web live-preview-render → LivePreviewResult.slidesHtml
        │
LivePreview：frameKey 變→srcDoc 重載；不變→postMessage deck:patchSlides
        │
deck runtime patch handler：換 sections + 重抓 slides/dots + 字型 link + show(index) + .deck-static
```

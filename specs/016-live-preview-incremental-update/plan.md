# Implementation Plan: 016 即時預覽就地更新（取代 iframe 整頁重載）

**Branch**: `016-live-preview-incremental-update` | **Date**: 2026-06-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-live-preview-incremental-update/spec.md`

## Summary

編輯頁預覽目前每次編輯都換 `<iframe srcDoc>` → 整頁重載（實測 185–302ms，重算僅 ~1ms）。改為 **iframe 只載一次、編輯以 `postMessage` 就地抽換投影片區**（不重載、不重抓字型、不跳頁、抑制進場動畫）；切 deck / Save / 換主題仍走全量重載。投影片標記由抽出的 domain `renderSlidesRegion` 產生，與全量渲染共用 → parity 不漂移。技術細節見 [research.md](./research.md)、型別見 [data-model.md](./data-model.md)、協議見 [contracts/](./contracts/)。

**Artifact Language**: 繁體中文。

## Technical Context

**Language/Version**: TypeScript（React + Vite web；domain 純函式 + iframe runtime script）。

**Primary Dependencies**: 既有；**零新依賴**、零後端、零 DB、零契約變動。

**Storage**: N/A（無持久化）。

**Testing**: vitest（domain renderer / runtime 字串 / live-preview-render）、web 元件 vitest+RTL、Playwright e2e（就地更新無重載、parity）。

**Target Platform**: 瀏覽器（編輯頁 + sandbox iframe）。

**Performance Goals**: 單次編輯 **0 次 iframe 文件重載**；不引入新字型則 0 次字型請求；就地更新 ≤ ~30ms 量級（vs 現行 185–302ms）。

**Constraints**: **既有 `renderTemplateDeck` html 輸出與 runtime 既有行為逐字不變**（純增量）；下載/匯出/生成路徑零影響。

**Scale/Scope**: 編輯頁預覽；不含 4a 逐欄位 patch、不換 iframe 技術。

## Constitution Check

- **Specification First**：spec accepted（含量測證據 + clarify）；無阻擋問題。
- **Behavior-Driven User Value**：US1/US2 皆有 Given/When/Then、可獨立展示（US1 編輯零重載、US2 重載情境正確）。
- **Source Fidelity / Reviewable Generation**：N/A — 不產生/改寫內容；只改「同一份渲染輸出」的傳輸/套用。
- **Web-First Deliverable**：自包含 HTML 不變（下載/匯出走既有 `renderTemplateDeck` 輸出，逐字不變）。
- **Backend LLM Boundary**：N/A — 純前端 + iframe runtime；零 LLM/後端。
- **Coherent Design System**：套用標記由既有 renderer 產生，主題/版型/字型一致；新增 CSS 為 inert `.deck-static` gate。
- **Semantic Titles / Data Viz**：N/A。
- **Code Quality & Simplicity**：就地更新與全量渲染**共用 `renderSlidesRegion`**（無第二套渲染）；降級回退即現行 srcDoc 行為（不留並存死碼）；runtime 把 init 重構成可重呼叫函式（純重構）。**No dead code / shims**：`renderTemplateDeck` 重構後 html 不變、舊路徑不保留分支。型別/檔案分工沿用既有 rendering 模組。
- **TDD & DDD**：先寫失敗測試——(a) `renderSlidesRegion` 輸出 == `renderTemplateDeck` 內投影片區 + 既有 renderTemplateDeck html 回歸不變；(b) runtime 字串含 `deck:patchSlides` handler + 來源檢查 + `.deck-static`；(c) live-preview-render 回傳 slidesHtml；(d) LivePreview frameKey 分流（patch vs srcDoc）；(e) e2e 編輯零 `load`。
- **Lean Test Scope**：聚焦可觀察行為（零重載/停留頁/字型不重抓/parity/降級），不重測既有渲染內容。
- **Consistent UX & Language**：固定詞彙——就地更新、整頁重載、patch 訊息、降級回退、parity、`.deck-static`。
- **Performance & Operational Evidence**：基準已量（185–302ms）；驗收以 instrumentation（編輯 0 `load`、Network 0 字型重抓）+ parity 測試為證據。
- **Manual Verification**：見 [quickstart.md](./quickstart.md)。
- **Release Verification**：domain 既有渲染測試全綠（= html 輸出不變的護欄）、鍵盤導覽/responsive/16:9 不退化。

**風險（已知並化解）**：`renderTemplateDeck`/`buildDeckRuntimeScript` impact = **CRITICAL**（餵養生成/下載/PPTX/preview 全線）。化解 = **純增量**：抽 `renderSlidesRegion` 不改組裝結果、runtime 只加 handler/重構、CSS 加 inert class。護欄 = 既有 domain 渲染測試（asserting html）必須全綠；任一紅燈即代表破壞增量原則，停下。

## Project Structure

### Documentation
```
specs/016-live-preview-incremental-update/
├── plan.md / research.md / data-model.md / quickstart.md
├── contracts/preview-patch-protocol.contract.md
└── tasks.md   # /speckit.tasks 產出
```

### Source（受影響的真實路徑）
```
packages/domain/src/rendering/
├── template-html-renderer.ts     # 抽出並匯出 renderSlidesRegion；renderTemplateDeck 改用它(html 不變)
├── deck-runtime-script.ts        # init 重構為可重呼叫 + deck:patchSlides handler + 來源檢查 + ensureOverrideFontLink + .deck-static
└── deck-style-css.ts             # 新增 inert `.deck-static` 動畫抑制規則

apps/web/src/features/deck-editor/
├── live-preview-render.ts        # LivePreviewResult 增 slidesHtml(呼叫 renderSlidesRegion)
└── LivePreview.tsx               # frameKey 分流：patch(postMessage) vs srcDoc(重載) + load 後補送

packages/domain/test/rendering/*  + apps/web/.../*.test.tsx + apps/web/tests/e2e/*
```

**Structure Decision**：沿用既有 rendering 模組與 web deck-editor；無新模組、無新依賴。

## 實作階段（供 /speckit.tasks 展開）

### Phase A — domain renderSlidesRegion（TDD，純重構，html 不變）
- 先寫：`renderSlidesRegion` 輸出 == renderTemplateDeck 內投影片區；`renderTemplateDeck` 既有 html 回歸測試**逐字不變**（跑既有 rendering 測試全綠）。
- 重構 template-html-renderer 抽出 + 匯出 `renderSlidesRegion`；index 匯出。

### Phase B — deck runtime patch handler（TDD on 字串/行為）
- 先寫：runtime 字串含 `deck:patchSlides`、`event.source` 來源檢查、`.deck-static`、ensureOverrideFontLink；既有 `deck:goToSlide`/`deck:slideChanged` 行為不變。
- 重構 init（refreshSlides/rebuildDots 可重呼叫）+ 新 handler + 投影片容器界定（只換 sections，不動 progress/dots/controls）。
- deck-style-css 加 inert `.deck-static` 規則 + 既有 CSS 測試（sanitization/contrast）回歸綠。

### Phase C — web 橋 + LivePreview 分流（TDD）
- live-preview-render：回傳 `slidesHtml`（呼叫 renderSlidesRegion）；測試 ok 時帶 slidesHtml。
- LivePreview：frameKey 計算、frameKey 變→srcDoc 重載、不變→postMessage `deck:patchSlides`、onLoad 後補送；測試（mock iframe.contentWindow.postMessage）斷言：同 frameKey 編輯→送 patch 不換 srcDoc；換主題/切 deck→換 srcDoc。

### Phase D — e2e + 效能驗證
- e2e：多頁 deck 編輯第 N 張 → 預覽更新且**無 iframe `load`**（hook load 計數）、停在第 N 張；換主題/Save → 走重載；parity（就地 vs 重新整理一致）。
- quickstart 人工：Network 0 字型重抓、目視無閃爍/跳頁；對照 185–302ms → 0 次重載。

### Phase E — 收尾
- `gitnexus_detect_changes` 核對影響面只落在預期符號、且**既有渲染測試全綠**（html 不變護欄）；全測試 + tsc + e2e 綠。

## Complexity Tracking

無新抽象/依賴。唯一「複雜度」是 LivePreview 的 frameKey 分流狀態，但取代了「每次換 srcDoc」的舊邏輯（淨複雜度持平、效能大增），並有降級回退保底。

## Evidence Plan

- **Automated**：renderSlidesRegion==全量區塊 + renderTemplateDeck html 回歸、runtime 字串/行為測試、live-preview-render slidesHtml、LivePreview 分流測試、e2e 零 `load` + parity。
- **Manual**：quickstart（Console 零 FULL RELOAD、Network 零字型重抓、目視無閃爍/不跳頁、全螢幕）。
- **Operational**：效能對照（185–302ms 重載 → 0 次重載）。
- **Decision**：research.md（slidesHtml 來源、frameKey 分流、動畫抑制、字型 link、降級的被否決替代）。

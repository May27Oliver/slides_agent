# Implementation Plan: Frontend Style Controls（暴露 007/008 樣式能力到控制台）

**Branch**: `009-frontend-style-controls` | **Date**: 2026-06-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-frontend-style-controls/spec.md`

## Summary

把 007（design theme system）與 008（chart rendering）已加進 deck 輸出、卻對使用者隱形的樣式能力，暴露到 `apps/web` 控制台。三條 user story：

- **US1（P1）**：生成前的 **radio card gallery 可預覽風格選擇**——取代現有 6 個純文字 preset，選擇仍只發既有 `styleDirection` 關鍵字（不 override、`selectTheme` 確定性不變）。
- **US2（P2）**：生成後的**設計/圖表透明度面板**——以**補強後的 readonly response 結果證據**呈現實際套用主題 token 與實際渲染圖表類型，誠實標示 fallback。
- **US3（P3）**：4 個 chart preset 可預覽、語意更清楚。

**技術取向**：009 不改任何後端**決策邏輯**（`selectTheme` / `composeKit` / chart-intent 規劃 / 渲染決策）。後端改動**僅限唯讀結果證據暴露**——以**純函式投影**把已算好的 `styleKit` 投成 `selectedTheme` 摘要，並讓 chart renderer 在渲染時**順帶回傳結構化結果**收集成 `renderedCharts`。前端以 `ui-ux-pro-max` skill 設計新 UI（FR-014），只讀這些 metadata、不 parse HTML/CSS。

**Artifact Language**: 本 plan 及相關 Spec Kit 產物以繁體中文撰寫。

## Technical Context

**Language/Version**: TypeScript（strict）；前端 React 19 + Vite 5。

**Primary Dependencies**: 前端 React 19 / React Router 7 / Tailwind v4 / 既有 i18n（zh-TW/en/ja）；domain 純 TypeScript（無框架）；api **NestJS（`@nestjs/platform-express`）**（既有）。設計引導：`ui-ux-pro-max` skill。

**Storage**: N/A（009 不新增 DB；007 themes 表唯讀沿用，且 009 不直接讀——走既有 `selectTheme` 已選結果）。

**Testing**: vitest + @testing-library/react（前端）；vitest（domain/contracts）；Playwright（既有 e2e，US1/US2 關鍵流程補一條）。

**Target Platform**: Web（桌面為主，需基本 RWD 至窄視窗）。

**Project Type**: Web monorepo（`apps/web` + `apps/api` + `packages/domain` + `packages/contracts`）。

**Performance Goals**: N/A（純呈現層加值）。預覽 UI 不得引入明顯渲染負擔；色票/字體樣本為輕量呈現。

**Constraints**: 公開 request contract 不變（FR-013）；response 僅加 readonly 結果 metadata；不 parse HTML/CSS；WCAG AA 對比、鍵盤操作、`prefers-reduced-motion` 降級。

**Scale/Scope**: 前端約 3–5 個新元件 + 既有 2 個面板增強；domain 1 個投影純函式 + chart renderer 結果收集；contracts/api 型別同步；6 風格 + 4 圖表 preset 的 curated 預覽 metadata。

## Constitution Check

*GATE：Phase 0 前必過；Phase 1 設計後再查一次。*

- **Specification First**: 已接受 spec（`spec.md`，三輪 clarify、零 `[NEEDS CLARIFICATION]`）。無未解問題阻擋規劃。
- **Behavior-Driven User Value**: 三條 user story 皆具 Given/When/Then 且可獨立展示/測試（spec US1–US3）。US1=生成前引導、US2=生成後透明度、US3=圖表提示清晰化，各自為可交付增量。
- **Source Fidelity**: 009 不改生成、不處理 source facts。透明度面板**只忠實反映** response 結果證據（`selectedTheme` token、`renderedCharts`）；數字/標籤沿用既有輸出，呈現層**不得**改寫或強化。投影為**保值純函式**（token → 摘要欄位），無資訊新增。
- **Reviewable Generation**: fallback 與主題退回以 **`renderedCharts[].notes{code,message}`** 與 `selectedTheme.fallback`／三軸 `ids`（null=退回）呈現為可見輸出；reuse 008 既有 review note `code`。
- **Web-First Deliverable**: 本 feature 主交付物即 `apps/web` 控制台；deck 仍為自包含 HTML（009 不改渲染輸出）。
- **Backend-Configured LLM Boundary**: 風格/圖表選擇僅為既有 brief 關鍵字（`styleDirection`/`chartEmphasis`），非 provider/model。request contract 不變；response 僅加「已發生結果」之 readonly 證據（沿用 007 將 `selectedTheme` 置於 `generationSummary` 的既有邊界）。
- **Coherent Deck Design System**: 009 不改 deck 設計一致性；反而把 deck 的 palette/typography/density/結構特徵**如實暴露**給使用者審閱。新控制台 UI 以 `ui-ux-pro-max` 設計，與 deck 同源素材（007 即取自該 skill 的 CSV）。
- **Semantic Titles and Data Visualization**: 標題生成不變（CR-006 N/A）；「何時成圖」決策不變，009 僅**呈現** 008 已決定的成圖/ fallback 結果。
- **Code Quality and Simplicity**: 最小可讀路徑，且**修正既有 drift**——
  - 後端新增**一個純函式投影** `selected-theme-summary`（`*.ts` 純函式，consumer=api 回應組裝 + 前端面板）取代 `slides.service.ts:166` 手拼的 `{...ids, fallback}`；
  - **單一來源 render（D12）**：`renderChartIntent` 不動（已回傳 `RenderedChart` canonical output）；`renderTemplateDeck` 回傳 `string`→`RenderedTemplateDeck{html,renderedCharts}`，在**既有那一次** render 收集圖表證據；`collectChartReviewNotes` 由「自己再 render 一次」**降級為純投影**，消滅既有雙重 render；
  - 前端 curated 預覽 metadata 為**資料常數**（不新增端點/服務）。
  - **拒絕的較簡單替代**：(1) 前端 parse HTML/CSS 取 token（脆弱、違反 FR-005/006）；(2) 保留 flat `selectedTheme` 再加平行欄位（雙形狀分歧，故**取代**舊 flat shape，不留 alias）；(3) **新增第三次走訪的加法 collector**（blast radius 小但擴大 drift surface，違反 no-drift，故拒絕，改採 D12 單一來源 render，CRITICAL blast radius 有意識接受——見 Complexity Tracking）。
  - 型別/行為分檔：投影放 `*.ts` 純函式、型別放 `*.types.ts`（domain）/ contracts；無新增 port/adapter（不碰 DB）。每個新欄位都有近期可測 consumer（面板呈現 + 投影測試）。
- **TDD and DDD**: 首批失敗測試——(1) `selected-theme-summary` 投影純函式（given styleKit+density → 期望摘要；含 fallback/缺軸）；(2) chart renderer 結果收集（given 多 slide intents → renderedCharts 含正確 visualKind/fallback/notes）；(3) 前端 card gallery 渲染 + 選擇→`styleDirection` 映射；(4) 透明度面板據 metadata 呈現 + fallback 誠實標示。Domain 概念：`SelectedThemeSummary` / `RenderedCharts`（結果證據值物件），住 `packages/domain`；型別語言於 `*.types.ts`，無 adapter。
- **Lean Test Scope**: 測試聚焦可觀察行為（投影輸出、收集結果、面板輸入即 metadata、選擇映射），**不**重測 `selectTheme`/`composeKit`/chart 決策（008/007 已覆蓋）。前端只測「metadata→呈現」與「選擇→請求欄位」契約點。
- **Consistent UX and Language**: 跨 UI/report/docs 一致詞彙：風格 / 主題（theme/kitName）/ 視覺密度（visualDensity）/ 結構特徵（structureFeatures）/ 圖表類型（visualKind enum）/ fallback。`visualKind` 一律用 008 enum 值、UI label 另行 i18n。
- **Performance and Operational Evidence**: 效能目標 N/A（呈現層）。證據=前端/domain 自動測試 + 三語文案檢查 + 截圖（card gallery / 透明度面板 / fallback 標示 / reduced-motion）。
- **Manual Verification Path**: 視覺正確性（色票對比、字體樣本、預覽動效觀感、面板 vs 實際 deck 一致、fallback 誠實）以手動檢查（quickstart.md）；含 zh-TW/en/ja、窄視窗、reduced-motion 各一輪。
- **Release Verification**: 驗收涵蓋——request JSON 合約不變（無 override 欄位）、新增 response 結果 metadata 之 schema 有效性、新 UI HTML 渲染、鍵盤導覽、基本 RWD（spec CR-016）。

**結論：GATE PASS。** 無憲章違反，Complexity Tracking 留空。

## Project Structure

### Documentation (this feature)

```text
specs/009-frontend-style-controls/
├── plan.md          # 本檔
├── research.md      # Phase 0：決策彙整（多數已於 spec clarify 鎖定）
├── data-model.md    # Phase 1：SelectedThemeSummary / RenderedCharts / 投影映射
├── quickstart.md    # Phase 1：手動驗證路徑
├── contracts/
│   └── generation-summary.contract.md  # response 結果 metadata 契約 delta
└── tasks.md         # Phase 2（/tasks 產出，非本步驟）
```

### Source Code (repository root)

```text
packages/domain/src/
├── design/
│   ├── design-style-kit.types.ts          # 既有：DesignStyleKit token 來源（投影輸入）
│   ├── selected-theme-summary.ts          # 新增：styleKit + visualDensity → SelectedThemeSummary 純函式投影
│   └── selected-theme-summary.types.ts    # 新增：SelectedThemeSummary 型別
├── rendering/
│   ├── chart-rendering.types.ts           # 既有：ChartVisualKind enum + RenderedChart fragment（勿動）；新增 RenderedChartSummary 型別
│   ├── chart-renderer.ts                  # renderChartIntent 不動；collectChartReviewNotes 降為純投影（input: {renderedCharts, chartIntents}）
│   └── template-html-renderer.ts          # 修改：renderTemplateDeck 回傳 RenderedTemplateDeck{html,renderedCharts}；renderSlide/renderChartFragments 收集 RenderedChartSummary（含 slideId）
└── deck/
    ├── deck.types.ts                      # 修改：GenerationSummary.selectedTheme 改 nested + 新增 renderedCharts
    └── generation-summary.ts              # 修改：buildGenerationSummary 加必填 renderedCharts 參數 + enriched selectedTheme

packages/domain/src/rendering/html-deck-renderer.ts  # 修改：取 renderTemplateDeck 的 {html,renderedCharts}；renderedCharts 傳入 buildGenerationSummary

packages/contracts/src/
├── index.ts                               # 修改：GenerationSummaryContract（selectedTheme nested + renderedCharts）
└── openapi.ts                             # 修改：GENERATION_SUMMARY_SCHEMA 對應

apps/api/src/modules/slides/
└── slides.service.ts                      # 修改：render 一次→從 charts 投影 review notes→併 reviewReport；selectedTheme 投影取代 line 166

apps/api/scripts/                          # 修改（D12 call-site 遷移，非 shim）
├── preview-themes.ts                      # renderTemplateDeck(...) → 取 .html
└── preview-chart-matrix.ts                # renderTemplateDeck(...) → 取 .html

apps/web/src/features/slide-generation/
├── style-presets.ts                       # 新增：6 風格 curated 預覽 metadata（含 preview.structureFeatures.animation）
├── chart-presets.ts                       # 新增：4 圖表 preset 代表圖型示意 metadata
├── StyleCardGallery.tsx                   # 新增：US1 radio card gallery
├── DesignPlanningPanel.tsx                # 修改：US2 主題 token 摘要（色票/字體/密度/結構 chip）
├── RenderedChartsPanel.tsx               # 新增：US2 已渲染圖表類型 + fallback 誠實標示
├── ChartPresetPreview.tsx                 # 新增：US3 chart preset 可預覽
├── SlideGenerationForm.tsx                # 修改：接 StyleCardGallery / ChartPresetPreview
└── slide-generation.types.ts              # 修改：designSystem→selectedTheme nested + renderedCharts 讀型別

apps/web/src/i18n/translations.ts          # 修改：新 UI 三語文案 + visualKind label
```

**Structure Decision**: 沿用既有 Web monorepo（`apps/web` 前端 + `apps/api` 服務 + `packages/domain` 純領域 + `packages/contracts` 契約）。009 改動集中在 domain 結果投影/收集、contracts/api 型別同步、apps/web 呈現；**不新增專案、不新增 DB、不新增端點**。

## 實作階段（phase 切分，供 /tasks 展開）

> 依 user story 優先序與「契約先行、TDD」排序。每階段可獨立交付/展示。

### Phase A — 後端結果證據契約（US2 的資料基礎，先行）
1. **型別**：`deck.types.ts` 的 `GenerationSummary.selectedTheme` 由 flat 改 nested（三軸入 `ids`）+ 新增 `renderedCharts`；`chart-rendering.types.ts` **新增 `RenderedChartSummary`**（**勿覆寫既有 `RenderedChart` fragment 型別**，語意不同）；新增 `selected-theme-summary.types.ts`。
2. **投影純函式**（TDD）：`selected-theme-summary.ts`——`styleKit + visualDensity → SelectedThemeSummary`（map：`effects.cardRadiusPx→radiusPx`、`cardShadow→shadow:boolean`、`cardBackdropBlurPx→backdropBlurPx`、`glow→glow:boolean`、`background.textureOverlay→texture`、`background.gradientAnimation→animation`、`accentHues→{name,base}[]`、`fonts→{heading,body}`、`styleKit.kitName→kitName`、`ids`/`fallback` 沿用）。
3. **單一來源 render（TDD，D12）**：`renderChartIntent` 不動；`renderChartFragments`/`renderSlide` 在既有那次 render 收集 `RenderedChartSummary`（`visualKind`/`notes` 既有就算出；**`fallback` 僅由 `fallback_used` note 判定**——`table`/`table_truncated`/`series_extracted` 不算）；`renderTemplateDeck` 回傳 `RenderedTemplateDeck{html,renderedCharts}`。
4. **collectChartReviewNotes 降為純投影**（TDD）：簽章改 `{ renderedCharts, chartIntents }`、移除自身 `renderChartIntent` 走訪；更新其 test。
5. **call-site 遷移（無 shim）**：`html-deck-renderer`（取 `{html,renderedCharts}` 傳入 summary）、dev scripts `preview-themes.ts`/`preview-chart-matrix.ts`（取 `.html`）。
6. **summary 組裝**：`buildGenerationSummary` 加**必填** `renderedCharts` 參數 + enriched selectedTheme；`slides.service.ts` 改 render 一次→投影 review notes→併 reviewReport→selectedTheme 投影取代 line 166。
7. **contracts/openapi 同步** + 既有測試更新（flat→nested 遷移，無 alias）。

### Phase B — US1 生成前可預覽風格選擇（P1）
1. `style-presets.ts`：6 風格 curated 預覽 metadata（沿用既有 `styleDirection` 關鍵字片語，新增 `preview`：色票/字體樣本/特徵 chip/密度/optional animation）。
2. `StyleCardGallery.tsx`（TDD + `ui-ux-pro-max` 設計）：radio card gallery，選擇→寫入既有 `styleDirection`；鍵盤/focus；窄視窗單欄/水平 grid 不退化純文字。
3. 接進 `SlideGenerationForm.tsx`；i18n 三語標籤；生成前動效預覽以 `preview.structureFeatures.animation` gate + reduced-motion 降級。

### Phase C — US2 生成後透明度面板（P2）
1. `slide-generation.types.ts`：讀型別改 nested selectedTheme + renderedCharts。
2. `DesignPlanningPanel.tsx` 增強（`ui-ux-pro-max`）：主題名稱/色票/字體樣本/密度/結構 chip；軸退回（id=null / fallback）誠實標示。
3. `RenderedChartsPanel.tsx`：依 `renderedCharts` 標出 visualKind（i18n label）+ 可追溯 slide；`fallback` 與 `notes{code}` 誠實標示，不謊報已畫圖。
4. 生成後動效標示以 `selectedTheme.structureFeatures.animation` gate + reduced-motion 降級。

### Phase D — US3 圖表 preset 預覽（P3）
1. `chart-presets.ts` + `ChartPresetPreview.tsx`：4 preset 代表圖型示意 + 一句說明（不暗示必成圖）；選擇仍寫 `chartEmphasis`。

### Phase E — 驗證收尾
1. Playwright 補 US1（選風格→請求帶關鍵字）、US2（生成後面板據 metadata 呈現 + fallback 標示）關鍵流程。
2. 三語 + 窄視窗 + reduced-motion 手動檢查（quickstart.md）；截圖證據。

## Complexity Tracking

| Violation / Added Complexity | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| **`renderTemplateDeck` 回傳契約破壞性變更（`string`→`RenderedTemplateDeck`）＝ CRITICAL blast radius**（d=1：`renderTemplateDeckArtifact` + 2 dev scripts；`collectChartReviewNotes` 簽章亦變更，caller 限 `slides.service` + test） | 009 要暴露「實際渲染結果」，最乾淨來源即該次 render 的副產物；單一來源讓 html／renderedCharts／review notes 同源、消滅既有雙重 render 的 drift。call site 有限且全在本 repo，每處乾淨遷移、無 shim/alias/legacy | **加法 collector（第三次走訪）**：blast radius 小但**擴大** drift surface（render 三次），違反明定的「no legacy/shim/drift」。**保留 flat selectedTheme + 平行欄位**：雙形狀分歧。皆拒絕 |

> 其餘不新增專案/DB/端點/抽象層；新增為一個純函式投影、`RenderedTemplateDeck`/`RenderedChartSummary` 型別、一組 curated 前端常數，皆有近期 consumer。

## Evidence Plan

- **Automated Evidence**：`selected-theme-summary` 投影測試、chart 結果收集測試、contracts schema 測試、前端 card gallery/面板/preset 測試、Playwright US1/US2 流程。
- **Manual Verification**：quickstart.md——生成含真圖與觸發 fallback 兩份內容，比對面板 vs 實際 deck 一致、fallback 誠實；zh-TW/en/ja、窄視窗、reduced-motion 各一輪。
- **Operational Evidence**：card gallery / 透明度面板 / fallback 標示 / reduced-motion 靜態降級 截圖。
- **Decision Evidence**：spec Clarifications（三輪）記錄 不 override / response-only 結果證據 / ChartVisualKind reuse / flat→nested 取代 / 兩階段 reduced-motion gate / `ui-ux-pro-max` 設計依據 等決策與被拒替代。

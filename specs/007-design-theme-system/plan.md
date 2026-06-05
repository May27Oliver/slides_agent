# Implementation Plan: Design Theme System(builtin themes 入庫 + selection 必經 + 引擎 token 擴充)

**Branch**: `007-design-theme-system` | **Date**: 2026-06-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-design-theme-system/spec.md`

## Summary

把「設計風格」從寫死常數升級為**資料驅動的 builtin theme 目錄**,並讓「選 theme」成為設計階段的**獨立必經步驟**。三個來源 CSV(typography 57 / colors 96 / styles 67)經 dev-time 轉換腳本產出 committed JSON,`pnpm db:seed` 以 idempotent upsert 灌進 `themes` 表;表新增 `kind` 欄(`font` | `palette` | `style`)區分三軸,`style_kit` 為分 kind 的 partial token。新增 `selectTheme`(domain 純函式)對三軸各自關鍵字評分挑一,`composeKit` 合併成完整 `DesignStyleKit`——即把既有 `selectDesignStyleKit`(font×palette×default-structure)一般化、三軸候選改自 DB(經 `ThemeStore` adapter 撈出後傳給純函式 `selectTheme`)。`selectTheme` 只負責 `styleKit`;`designSystem`/`slidePatternAssignments`/`chartTreatmentPlans` 仍由 LLM design planner 或 fallback 產出,且**兩條路徑都套到 curated styleKit**(修掉現況 fallback 無風格的缺口)。渲染引擎擴充 B 級四類 token(backdrop blur / glow / grain 紋理 / 漸層動畫),B 級隨之 partial→full。domain 維持純淨(`ThemeStore` port + `selectTheme`/`composeKit` 純函式),DB 存取走 adapter;DB 為 theme 資料單一事實來源,`defaultDesignStyleKit` 為唯一最終 fallback。

**Artifact Language**: 繁體中文。

## Technical Context

**Language/Version**: TypeScript 5 / Node 20,執行採 tsx(無 decorator metadata → Nest DI 用顯式 `@Inject`)。

**Primary Dependencies**: NestJS 10、Drizzle ORM(`drizzle-orm` + `drizzle-kit`)、`pg`(node-postgres Pool)。轉換腳本讀 CSV(dev-time);測試用 `@electric-sql/pglite` + `drizzle-orm/pglite`。設計/渲染層為 `packages/domain` 純函式(無框架)。

**Storage**: PostgreSQL 16(`themes` 表,006 已建結構,007 加 `kind` 欄並灌資料)。

**Testing**: vitest。domain 純函式(`selectTheme`/`composeKit`/B 級 token CSS)為單元測試(無 DB);`DrizzleThemeStore`/`seedThemes` 對 pglite 跑真 SQL;Nest module bootstrap 驗 DI 邊界。

**Target Platform**: Linux/macOS server(API 與 worker 兩個 process;生成在 worker)。

**Project Type**: pnpm workspace monorepo(apps/api + apps/web + packages/domain + packages/contracts)。

**Performance Goals**: `selectTheme` 為記憶體內關鍵字評分,候選列總量小(≤ ~220 列:57+96+67),`listSelectable` 走複合索引;對單次生成延遲影響可忽略。其餘 N/A。

**Constraints**: domain 不得含 SQL;DB 來的每個 token 值逐值 sanitize;漸層動畫遵守 `prefers-reduced-motion`;`db:seed` runtime 不得依賴 `.claude/skills` 目錄;選擇為確定性(同輸入同輸出)。

**Scale/Scope**: builtin themes ~219 列(全 seed);個位數帳號;本版不含 account 主題、不渲染 C 級。

## Constitution Check

*GATE: 規劃前必過,設計後重查。*

- **Specification First**: 已有 accepted [spec.md](./spec.md);兩個 clarify session(範圍/B 級 token、架構五題)解決主要不確定性,剩餘為 plan 執行細節(本 plan 的 research.md 以 DR 收斂)。無阻擋規劃的未解問題。
- **Behavior-Driven User Value**: 3 個 user story 各有 Given/When/Then 且可獨立展示/測試(US1 兩路徑都套具名 theme、US2 全量 seed 目錄、US3 B 級 token 升 full)。
- **Source Fidelity**: 不重新生成內容;只改「選 theme + 渲染」。被選三軸 id 記入 `generationSummary` 作可追溯證據。
- **Reviewable Generation**: `generationSummary` 新增 `selectedTheme`(style/palette/font id 或退回 default 的標記),隨 revision 持久化以供回看。
- **Web-First Deliverable**: 維持——自包含 HTML 仍為主交付;新 token 只改 CSS。
- **Backend-Configured LLM Boundary**: provider/model 仍為後端設定;`selectTheme` 為確定性 domain 邏輯,**不依賴 LLM**;LLM 不參與 theme 選擇。`DATABASE_URL` 屬機密不入公開欄位。
- **Coherent Deck Design System**: **本 feature 核心**。deck 級 palette/typography/spacing/density/layout/可重用 slide pattern 由被選三軸 `composeKit` 合併的 `DesignStyleKit` 表達;引擎 `buildDeckStyleCss` 逐值 sanitize 確保一致且安全。
- **Semantic Titles and Data Visualization**: N/A 變更(不改內容/標題語意;chart 觸發由既有 design plan 決定,theme 只影響視覺 token)。
- **Code Quality and Simplicity**: 最小可讀做法——`selectTheme` 沿用既有 `pickBest` 評分;`composeKit` 重用既有 `buildPaletteHues`/`buildCuratedEffects`/`buildBackground`(引擎留下,只移除 9+9 寫死資料);`ThemeStore` 沿用既有 port/adapter/module 慣例。每個新型別/port 都有當下消費者(見下表)。被否決替代見 Complexity Tracking。
- **TDD and DDD**: 首批失敗測試 = `selectTheme(brief, candidates)` 純函式(三軸評分 + 確定性 + 缺軸降級)。domain 概念:`Theme`/`ThemeKind`/`SelectedTheme`、`ThemeStore` port、`selectTheme`/`composeKit` 純函式;bounded context = 設計主題選擇。語言檔 `*.types.ts`、port 檔 `*.port.ts`、純函式檔;DB 決策在 adapter。
- **Lean Test Scope**: 測可觀測行為(選了哪三軸、輸出 CSS 是否帶 token、非法值是否被擋、seed idempotent),不重測 Drizzle/ORM 或既有 sanitize regex 本身。
- **Consistent UX and Language**: 統一 `theme`、`kind`(font/palette/style)、`applies_to`、`support`(full/partial/raw)、`styleKit`、`selectTheme`、`composeKit`,跨 DB/domain/文件一致。
- **Performance and Operational Evidence**: 見 Technical Context;證據 = 轉換腳本輸出、`db:seed` 列數/標籤分佈、被選 theme 記錄、B 級 token 渲染快照、測試報告。
- **Manual Verification Path**: `pnpm db:generate`/`db:migrate`/`db:seed`、登入生成、肉眼比對不同 brief→不同 theme、fallback 仍有風格、B 級玻璃/漸層效果,於 [quickstart.md](./quickstart.md)。
- **Release Verification**: slide JSON schema 仍有效(內容未變);HTML 渲染帶正確 token 並通過既有 `validateGeneratedHtml`;keyboard/responsive 不因新 token 退化(回歸綠燈);新 keyframe 受 `prefers-reduced-motion` 守衛。

## Project Structure

### Documentation (this feature)

```text
specs/007-design-theme-system/
├── plan.md          # 本檔
├── spec.md          # 已完成(含 Clarifications:範圍 + 架構五題)
├── research.md      # 本階段產出:DR-001~ 決策記錄
├── data-model.md    # 本階段產出:themes+kind、partial style_kit、ThemeStore、seed JSON
├── quickstart.md    # 本階段產出:migrate + 轉換 + seed + 生成驗證
├── contracts/
│   └── theme-selection.md   # ThemeStore port / selectTheme / composeKit / seed JSON 契約
└── tasks.md         # 由 /tasks 產出(不在本階段)
```

### Source Code (repository root)

```text
packages/domain/src/design/                      # 既有資料夾,擴充
├── theme.types.ts              # 新增:Theme / ThemeKind / SelectableTheme / SelectedTheme
├── theme-store.port.ts         # 新增:ThemeStore(listSelectable / findById)
├── select-theme.ts             # 新增:selectTheme(brief, candidates) → SelectedTheme(純函式)
├── compose-kit.ts              # 新增:composeKit(style,palette,font) → DesignStyleKit
│                               #   (移入並重用 buildPaletteHues/buildCuratedEffects/buildBackground)
├── design-style-kit.types.ts   # 修改:擴充 B 級 token(backdropBlurPx/glow/textureOverlay/gradientAnimation)
├── ui-ux-pro-max-knowledge.ts  # 修改:移除 CURATED_FONT_PAIRINGS/CURATED_PALETTES 寫死資料
│                               #   (型別 CuratedFontPairing/CuratedPalette 視需要保留供轉換腳本)
├── select-design-style-kit.ts  # 移除/重構:邏輯被 selectTheme + composeKit 取代
└── design-planner.ts           # 修改:planner 不再注入 styleKit(改由 slides.service 設定)

packages/domain/src/rendering/
└── deck-style-css.ts           # 修改:渲染 B 級新 token(blur/glow/grain/漸層動畫)+ sanitize + reduced-motion

packages/domain/src/deck/
└── deck.types.ts               # 修改:GenerationSummary += selectedTheme { style,palette,font | null }

apps/api/src/infra/db/
├── schema.ts                   # 修改:themes += kind 欄;新增/調整選擇用複合索引
├── migrations/0001_*.sql       # drizzle-kit generate 產出(ADD COLUMN kind + 索引)
├── seeds/                      # 新增:committed JSON(轉換腳本產出 + 人工補 style token)
│   ├── theme-fonts.json        #   kind=font(57)
│   ├── theme-palettes.json     #   kind=palette(96)
│   └── theme-styles.json       #   kind=style(67;A=full、B=full、C=raw)
└── seed-themes.ts              # 新增:seedThemes(db, source) idempotent upsert + kind-aware 驗證

apps/api/scripts/
├── convert-csv-to-theme-seeds.ts  # 新增:dev-time,讀 .claude/skills CSV → seeds JSON 骨架
└── db-seed.ts                  # 修改:在 accounts 之後也 seed themes(讀 seeds/*.json)

apps/api/src/modules/themes/    # 新增(仿 modules/decks 慣例)
├── themes.module.ts            # 提供 THEME_STORE
├── drizzle-theme-store.ts      # 實作 ThemeStore(DRIZZLE);listSelectable 穩定排序
└── themes.tokens.ts            # THEME_STORE

apps/api/src/modules/slides/
├── slides.service.ts           # 修改:design 階段載入候選 → selectTheme → 設 result.styleKit + 記 selectedTheme
├── slides.module.ts            # 修改:import ThemesModule / 注入 THEME_STORE
└── ...
apps/api/src/app/worker.module.ts   # 修改:worker(生成路徑)也注入 THEME_STORE
```

**Structure Decision**: 沿用既有 monorepo 與 port/adapter/module 慣例(`modules/decks` → `modules/themes`)。設計主題邏輯在 `packages/domain/src/design`(語言檔/port/純函式分離),DB adapter 在 `apps/api`。**關鍵分工**:`ThemeStore` 讀候選在 API 層(`slides.service`),把候選清單交給 domain 純函式 `selectTheme`,使 design planner 與 `selectTheme`/`composeKit` 全程**無 SQL、可純測**。生成在 worker,故 `worker.module` 與 slides 路徑都需 `THEME_STORE`。

### 新增物件的消費者(避免投機抽象)

| 新增 | 當下消費者 |
|---|---|
| `Theme`/`ThemeKind`/`SelectableTheme` types | `ThemeStore`、`DrizzleThemeStore`、`selectTheme`、seed 驗證 |
| `SelectedTheme`(三軸 id + styleKit) | `slides.service`(設 styleKit + 記 generationSummary) |
| `ThemeStore` port | `slides.service` 生成路徑(`listSelectable`)|
| `selectTheme()` 純函式 | `slides.service` design 階段(兩路徑) |
| `composeKit()` 純函式 | `selectTheme` 內部合併三軸 |
| B 級 token 欄位(blur/glow/grain/gradient) | `buildDeckStyleCss` 渲染 + `style` kind seed |
| `DrizzleThemeStore`/`ThemesModule`/`THEME_STORE` | `slides.module`、`worker.module` |
| `seedThemes()` + seeds/*.json | `db:seed`、seed 測試 |
| `convert-csv-to-theme-seeds.ts` | dev-time authoring(一次性,不在 runtime) |
| `GenerationSummary.selectedTheme` | 生成證據持久化 + 回看 |

## Complexity Tracking

| 新增複雜度 | 為何需要 | 否決的更簡單替代 |
|---|---|---|
| `themes` 加 `kind` 欄(破例:006 曾稱「不改結構」)| 模型 C 需以 kind 區分三軸(font/palette/style)於同一張表 | 三張獨立表:多兩張表 + 三套 port/adapter,且 selection 仍要 join;違 inventory「全入一庫」 |
| `style_kit` 分 kind 的 partial token + kind-aware 驗證 | 每軸只裝自己那塊(font 只有 fonts、palette 只有色) | 每列存完整 kit:資料重複、author 成本高、與「三軸正交組合」矛盾 |
| `ThemeStore` port + `ThemesModule` | domain 純淨、`selectTheme` 可純測、沿用既有 store 慣例 | slides.service 直接查 DB:domain 不純、難測、違反既有 port/adapter 一致性 |
| B 級「結構特效」用 enum 預設(texture/gradientAnimation)而非自由 CSS | 紋理/keyframe 若吃自由 CSS 難 sanitize(可注入 keyframe);enum 由引擎映射成內建 CSS,安全且確定 | 自由 CSS 值:sanitize 無法擋 keyframe 名/複雜結構;違「引擎留 codebase」 |
| 轉換腳本與 runtime seed 分離(committed JSON) | runtime 不依賴 `.claude/skills`;JSON diff 可審查、可重現 | runtime 直讀 CSV:production/CI 無該目錄;每次轉換結果不可審 |

> 註:`ThemeStore` 雖只一個實作(Drizzle),仍保留——讓 domain 純淨、`selectTheme` 依抽象候選清單、測試可換 fake;與既有 `UserAccountStore`/`DeckStore` 一致。`composeKit` 的引擎函式(`buildPaletteHues`/`buildCuratedEffects`/`buildBackground`/`pickBest`)為**保留既有程式碼**,非新增——只是把 9+9 寫死「資料」移進 DB。

## Evidence Plan

- **Automated Evidence**: `selectTheme` 單元測試(三軸評分/確定性/無命中取第一筆/缺軸降級);`composeKit` 合併順序與缺值測試;B 級 token CSS 輸出 + sanitize + `prefers-reduced-motion` 測試;`DrizzleThemeStore` pglite 測試(kind/applies_to/support/active 過濾 + 穩定排序);`seedThemes` idempotent + kind-aware 驗證測試;`themes-schema` 更新(kind 欄 + 索引);slides 整合測試(兩路徑都得 styleKit、`selectedTheme` 入 generationSummary);全 monorepo 回歸。
- **Manual Verification**: [quickstart.md](./quickstart.md) —— `db:generate`/`db:migrate`、轉換腳本、`db:seed`、登入生成、肉眼比對不同 brief→不同 theme、fallback 仍有風格、Glassmorphism(blur)/Aurora(漸層動畫)效果。
- **Operational Evidence**: 0001 migration SQL、轉換腳本輸出、`db:seed` 各 kind/applies_to/support 列數分佈、`listSelectable` 查詢 EXPLAIN(走索引)。
- **Decision Evidence**: 本 plan 的 Complexity Tracking、spec Clarifications(架構五題)、research.md 的 DR、`THEME_SEED_INVENTORY.md`(分級盤點理由)。

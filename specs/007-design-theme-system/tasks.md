---
description: "Task list for feature 007 design-theme-system"
---

# Tasks: Design Theme System(builtin themes 入庫 + selection 必經 + 引擎 token 擴充)

**Input**: `specs/007-design-theme-system/`(plan.md / spec.md / research.md / data-model.md / contracts/)

**Tests**: 每個 slice TDD——先寫會失敗的聚焦測試,再實作最小行為。domain 純函式(`selectTheme`/`composeKit`/B 級 token CSS)為無 DB 單元測試;`DrizzleThemeStore`/`seedThemes` 對 pglite 跑真 SQL。

**Organization**: 依 user story 分組,各自可獨立實作/測試/展示。

## Format: `[ID] [P?] [Story] Description`
- **[P]**:不同檔案、無相依,可並行。
- **[Story]**:US1/US2/US3。

---

## Phase 1: Setup(共用基礎)

- [x] T001 [P] 轉換腳本相依:`pnpm --filter @slides-agent/api add -D csv-parse`(供 `convert-csv-to-theme-seeds.ts` 解析 CSV;dev-time only)。
- [ ] T002 [P] 確認既有 `db:generate`/`db:migrate`/`db:seed` script(006 已有)可用;`db:seed` 待 US2 擴充以含 themes。

---

## Phase 2: Foundational(阻擋所有 user story)

**⚠️ 完成前任何 user story 不得開工。** 純型別/schema 為下游共用。

- [ ] T003 `apps/api/src/infra/db/schema.ts`:`themes` 加 `kind` text NOT NULL;`themes_select_idx` 以 `kind` 為前導重建為 `(kind, applies_to, support)`(依 data-model.md / DR-007)。
- [ ] T004 產生並檢入 migration:`pnpm db:generate` → `apps/api/src/infra/db/migrations/0001_*.sql`(ADD COLUMN kind + 重建索引;006 表為空,無回填問題)。
- [ ] T005 [P] `packages/domain/src/design/theme.types.ts`:`ThemeKind`/`ThemeSupport`/`ThemeAppliesTo`、`SelectableTheme`、`SelectedTheme`,及 `FontStyleKit`/`PaletteStyleKit`/`StyleStyleKit`/`RawStyleKit`(partial kit 形狀,依 data-model.md)。
- [ ] T006 [P] `packages/domain/src/design/theme-store.port.ts`:`ThemeStore`(`listSelectable(): Promise<SelectableTheme[]>`)。
- [ ] T007 [P] `packages/domain/src/design/design-style-kit.types.ts`:擴充 `DesignEffects.cardBackdropBlurPx?`/`glow?`、`DesignBackground.textureOverlay?`/`gradientAnimation?`(皆 optional;DR-008)。
- [ ] T008 [P] `packages/domain/src/deck/deck.types.ts`:`GenerationSummary` 加 optional `selectedTheme { style/palette/font: string|null; fallback: boolean }`。
- [ ] T009 更新 `apps/api/test/themes-schema.test.ts`:驗 `kind` 欄存在、選擇索引含 `(kind, applies_to, support)`(先失敗 → T003/T004 後綠)。

**Checkpoint**:schema + 共用型別就緒,user story 可開工。

---

## Phase 3: User Story 1 - 每份簡報都套到具名 builtin theme,fallback 不再裸奔(P1)🎯 MVP

**Goal**:`selectTheme` 成設計階段必經;LLM 成功與 fallback 兩路徑都套到 DB 選出的三軸 theme;被選 id 入 `generationSummary`;DB 空時安全退回 default。

**Independent Test**:灌幾筆 A 級 theme(測試內直接 insert)後,兩路徑都套具名 theme 且 HTML 帶對應 token;DB 空 → 退回 default 不報錯。

### Tests(先寫,須失敗)⚠️
- [ ] T010 [P] [US1] `packages/domain/test/design/compose-kit.test.ts`:三軸 partial kit 合併順序(default→style→palette→font);缺某軸 → 該部分用 default;輸出為完整合法 `DesignStyleKit`。
- [ ] T011 [P] [US1] `packages/domain/test/design/select-theme.test.ts`:三 kind 各 `pickBest`;`styleDirection` 強於 purpose/audience;無命中/平手取第一筆(候選依 id 排序時即 `00` 序位安全預設);某 kind 無候選 → 該軸 null + `fallback=true`;全空 → `defaultDesignStyleKit`;**確定性**(同輸入同輸出)。
- [ ] T012 [P] [US1] `apps/api/test/drizzle-theme-store.test.ts`(pglite):`listSelectable` 只回 `scope='builtin'` + active + `applies_to in (presentation,universal)`、`style` 排除 `support=raw`(明確排除 `scope='account'` fixture);`ORDER BY id` 穩定排序使 `00` 序位安全預設排首位;直接 insert 列為 fixture。
- [ ] T013 [US1] `apps/api/test/slides-service.theme-selection.test.ts`:LLM 成功與 fallback 兩路徑都把 `result.styleKit` 設為 selectTheme 結果;`generationSummary.selectedTheme` 記三軸 id;DB 空 → `fallback=true` 且不拋。

### Implementation
- [ ] T014 [US1] `packages/domain/src/design/compose-kit.ts`:`composeKit(parts)`;從 `select-design-style-kit.ts` 移入並重用 `buildPaletteHues`/`buildCuratedEffects`/`buildBackground`/`pickBest`(引擎留下)。
- [ ] T015 [US1] `packages/domain/src/design/select-theme.ts`:`selectTheme(brief, candidates)`——分組三 kind、各 `pickBest`、呼叫 `composeKit`、組 `SelectedTheme`(ids + fallback)。
- [ ] T016 [US1] `packages/domain/src/design/ui-ux-pro-max-knowledge.ts`:移除 `CURATED_FONT_PAIRINGS`/`CURATED_PALETTES` 寫死資料(型別視轉換腳本需要保留);`select-design-style-kit.ts` 移除或重構為薄包裝(DR-005)。
- [ ] T017 [US1] `packages/domain/src/design/design-planner.ts`:planner 不再注入 `styleKit`(移除 `withCuratedStyleKit`/`selectDesignStyleKit` 注入);`buildFallbackDesignPlanningResult` 不帶 styleKit。
- [ ] T018 [P] [US1] `apps/api/src/modules/themes/themes.tokens.ts`(`THEME_STORE`)+ `drizzle-theme-store.ts`(實作 `ThemeStore`,`@Inject(DRIZZLE)`,穩定排序)+ `themes.module.ts`(提供 `THEME_STORE`,import `DbModule`)。
- [ ] T019 [US1] `apps/api/src/modules/slides/slides.service.ts`:design 階段 `await themeStore.listSelectable()` → `selectTheme(deckBrief, candidates)` → 設 `result.styleKit` + 填 `generationSummary.selectedTheme`(DR-006)。
- [ ] T020 [US1] `apps/api/src/modules/slides/slides.module.ts` 與 `apps/api/src/app/worker.module.ts`:import `ThemesModule` / 注入 `THEME_STORE`(生成在 worker)。
- [ ] T021 [US1] 更新受影響既有測試:`packages/domain/test/design/select-design-style-kit.test.ts`(移除或改寫)、`design-planner.test.ts`(planner 不再帶 styleKit 的斷言)。

**Checkpoint**:US1 可獨立 demo——幾筆 theme 即可示範不同 brief→不同 theme、fallback 仍有風格。

---

## Phase 4: User Story 2 - CSV→seed 轉換腳本與全量 builtin theme 目錄(P2)

**Goal**:dev-time 轉換腳本把 3 CSV → committed JSON;`pnpm db:seed` idempotent upsert 全量 themes(font 57 / palette 96 / style 67),kind-aware 驗證。

**Independent Test**:乾淨 DB 跑 seed,列數/標籤分佈符合盤點;重跑 idempotent;不合法 `style_kit` 被攔。

### Tests(先寫,須失敗)⚠️
- [x] T022 [P] [US2] `apps/api/test/seed-themes.test.ts`(pglite):由 seed JSON upsert;**重跑 idempotent**(無重複列、可更新 updated_at);kind-aware 驗證——**一筆不合法則整批 rollback**(DB 維持原狀、回報所有壞列),不採跳過壞列的 partial success(FR-007)。
- [x] T023 [P] [US2] `apps/api/test/convert-csv-to-theme-seeds.test.ts`:對樣本 CSV 列,轉換產出符合 `ThemeSeed` 形狀(font/palette 自動轉、style 產骨架含 raw/待補標記)。

### Implementation
- [x] T024 [US2] `apps/api/src/infra/db/seed-themes.ts`:`seedThemes(db, seeds)` idempotent `onConflictDoUpdate`(target=`themes.id`)+ **kind-aware 驗證**(font/palette/style/raw 各一套 schema);**全量先驗證、單一 transaction 內任一壞列即整批 rollback** 並回報所有壞列。
- [x] T025 [US2] `apps/api/scripts/convert-csv-to-theme-seeds.ts`:dev-time,讀 `.claude/skills/ui-ux-pro-max/data/{typography,colors,styles}.csv` → 產 `seeds/theme-{fonts,palettes,styles}.json`(font/palette 完整、style 骨架)。
- [x] T026 [P] [US2] 執行轉換 + 人工補 `style` token:`apps/api/src/infra/db/seeds/theme-fonts.json`(57)、`theme-palettes.json`(96)、`theme-styles.json`(67;A 級 14 筆 full token、B 級 ~6 full、C 級 ~22 + N/A ~25 raw、非簡報主題標 `applies_to`)。id 用 `{kind}-{序位}-{slug}`,各 kind 安全預設給 `00` 序位(`style-00-minimalism`/`palette-00-safe-default`/`font-00-sans-default`)。對照 `data-model.md` 預期分佈表與 `THEME_SEED_INVENTORY.md` 逐筆確認。commit 進版控。
- [x] T027 [US2] `apps/api/scripts/db-seed.ts`:在 accounts 之後讀 `seeds/*.json` 呼叫 `seedThemes`;輸出各 kind 筆數。

**Checkpoint**:完整 theme 目錄入庫;US1 的 selection 有足夠候選。

---

## Phase 5: User Story 3 - B 級引擎 token 擴充,B 級風格升 full(P3)

**Goal**:渲染引擎支援 backdrop blur / glow / grain 紋理 / 漸層動畫;對應 B 級 theme 升 `support=full`。

**Independent Test**:用新 token 的 B 級 theme 渲染,CSS 帶對應輸出且 sanitize、漸層動畫受 reduced-motion 守衛;既有 A 級渲染不變(回歸)。

### Tests(先寫,須失敗)⚠️
- [x] T028 [P] [US3] `packages/domain/test/rendering/deck-style-css-bgrade.test.ts`:`cardBackdropBlurPx`→`backdrop-filter: blur(...)`(safeNumber)、`glow`→疊加陰影(safeCssValue/safeHex)、`textureOverlay`→`.deck::before` 內建紋理(enum)、`gradientAnimation`→`@keyframes` 受 `prefers-reduced-motion` 守衛;非法值被擋。
- [x] T029 [P] [US3] `apps/api/test/seed-themes.test.ts` 擴充或新增:B 級 style seed 以 `support=full` 載入且通過驗證。

### Implementation
- [x] T030 [US3] `packages/domain/src/rendering/deck-style-css.ts`:渲染四類新 token(`--card-backdrop-blur`、glow 陰影、`::before` 紋理疊層、漸層 `@keyframes`),全部走既有 `safeNumber`/`safeCssValue`/`safeHex`;keyframe 受 `motion.respectReducedMotion`/媒體查詢守衛。
- [x] T031 [US3] 把 B 級 style seed(Glassmorphism/Aurora/Y2K/Gradient Mesh/Vintage Analog 等)補上新 token 並改 `support=full`(更新 `theme-styles.json`)。

**Checkpoint**:B 級風格 full 渲染;玻璃/漸層效果可肉眼驗。

---

## Phase 6: Polish & 回歸

- [ ] T032 對照 plan「新增物件的消費者」移除未被消費的 artifact(如殘留的 `select-design-style-kit.ts`)。
- [ ] T033 全 monorepo 回歸:`pnpm -r test` + 各包 `tsc --noEmit` 全綠。
- [ ] T034 code-review + security pass(B 級新 token sanitize、無 keyframe/CSS 注入、`DATABASE_URL` 不外洩)。
- [ ] T035 跑 `quickstart.md` 全流程並回填證據(0001 migration、轉換輸出、seed 列數分佈、`selectedTheme` 記錄、B 級快照、`listSelectable` EXPLAIN)。
- [ ] T036 [P] 同步 `quickstart.md` 實作狀態勾選;README 補 theme seed 段(若需要)。

---

## Dependencies & Execution Order

- **Phase 1 Setup** → **Phase 2 Foundational**(阻擋全部)→ user stories。
- **US1(P1)** 為 MVP,須先於 US2/US3(US2 的 seed 提供 US1 更多候選,但 US1 測試用 inline fixture 即可獨立綠)。
- **US2(P2)** 提供全量目錄;**US3(P3)** 的 B 級 seed 升 full 相依 US2 的 `theme-styles.json` 與 US3 的引擎 token。
- 單人順序:Foundational → US1 → US2 → US3 → Polish。

### 各 story 內
- 測試先行且須失敗 → domain 型別/port(Foundational)→ 純函式 → adapter → service 串接 → 整合 → 重構。

### 並行機會
- T001/T002、T005/T006/T007/T008(純型別,不同檔)可並行。
- US1 的 T010/T011/T012 測試可並行;T018(themes module)與 T014/T015(domain 純函式)可並行。
- US2 的 T022/T023 可並行;US3 的 T028/T029 可並行。

---

## Implementation Strategy

### MVP(US1)
1. Setup → 2. Foundational(schema kind + 型別)→ 3. US1(selectTheme + composeKit + adapter + 串接)→ **停下驗證**(幾筆 theme,兩路徑套具名 theme、fallback 有風格)→ 可 demo。

### 增量交付
US1(selection 必經、修 fallback 缺口)→ US2(全量目錄、可重現 seed)→ US3(B 級 full)。每步獨立加值、不破壞前者。

---

## Notes
- [P] = 不同檔案、無相依。
- 先確認測試失敗再實作;測試聚焦可觀測行為(選哪三軸、CSS 是否帶 token、非法值被擋、seed idempotent),不重測 ORM/既有 sanitize regex。
- domain 維持純淨:DB 只在 adapter;`selectTheme`/`composeKit` 收候選清單而非查 DB(DR-006)。
- DB 為 theme 資料單一事實來源;`defaultDesignStyleKit` 為唯一最終 fallback(DR-005)。
- B 級結構特效(紋理/漸層動畫)用 enum 由引擎映射,避免自由 CSS 注入(DR-008)。
- 每完成一個 task 或邏輯群組即 commit。

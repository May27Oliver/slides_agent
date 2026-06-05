# Research: 007 design-theme-system

> Phase 0 決策記錄。前五筆對應 spec 的 clarify session(架構五題);其餘為 plan 階段細項收斂。
> 每筆:決定 / 理由 / 否決的替代。

## DR-001 資料模型:模型 C —— 三 CSV 全進 `themes` 表 + `kind` 欄

- **決定**:typography(56)/colors(96)/styles(67)全部進 `themes` 表,新增 `kind` 欄(`font` | `palette` | `style`)區分三軸。`style_kit` 為**分 kind 的 partial token**。
- **理由**:符合 inventory「全部入 DB」;三軸正交、組合多;`selectTheme` 即把既有 `selectDesignStyleKit`(font×palette×default-structure)一般化。
- **否決**:A(themes 只放 67 風格、字體配色留 code 池)——字體配色不在 DB,部分違「全入庫」;B(每列存完整 kit)——資料重複、author 成本高、組合固定。

## DR-002 LLM 分工:模型 A —— selectTheme 只管 styleKit

- **決定**:`selectTheme` 只負責 `styleKit`(三軸組合,確定性,LLM 成功與 fallback 兩路徑都跑);`designSystem`/`slidePatternAssignments`/`chartTreatmentPlans` 仍由 LLM design planner(成功)或 fallback 產。LLM **不參與** theme 選擇。
- **理由**:保留 LLM 對內容的版型/圖表判斷,同時保證兩路徑都有 curated styleKit(修掉 fallback 無風格缺口);theme 選擇為確定性 domain 邏輯,合 CR-004。
- **否決**:B(selectTheme 成設計唯一來源)——丟掉 LLM 內容感知;C(LLM 建議 theme)——增非確定性、複雜化邊界。

## DR-003 seed 來源:committed JSON,轉換腳本為 dev-time

- **決定**:dev-time `convert-csv-to-theme-seeds.ts` 讀 `.claude/skills/ui-ux-pro-max/data/*.csv` 產出 `apps/api/src/infra/db/seeds/*.json`(font/palette 自動轉、`style` token 人工補),JSON commit 進版控。`db:seed` runtime 只讀 repo 內 JSON。
- **理由**:runtime/CI 不依賴 skill 目錄;JSON diff 可審查、可重現;style token 本就需人工 authoring。
- **否決**:CSV 複製進 repo + seed 時轉(最終 token 藏腳本,難 review 個別 theme);runtime 直讀 skill CSV(production/CI 無該目錄 → 爆)。

## DR-004 確定性收斂:沿用 pickBest + 穩定排序

- **決定**:沿用既有 `pickBest`——各 kind 無命中或平手取候選清單第一筆(index 0 勝)。`ThemeStore.listSelectable` 回傳穩定排序(`ORDER BY id`),使「第一筆」可重現。**為保證「第一筆」即各軸的安全預設**,seed id 採可排序前綴約定:安全預設用 `00` 序位(`style-00-minimalism`/`palette-00-safe-default`/`font-00-sans-default`)、其餘用 `10`+,使 `ORDER BY id` 下安全預設恆排首位。
- **理由**:最小改動、重用既有評分;穩定排序保證確定性(同輸入同輸出);id 前綴約定把「no-match 取首筆」與「安全預設」綁定,免另建映射層即可保證收斂目標(否則 `ORDER BY id` 下首筆是字母序碰巧最小者,非刻意的安全預設)。
- **否決**:獨立 `sort_order` 欄——多一欄 + migration,id 前綴已達同效;具名安全預設常數 + 執行期 tie-break——把選擇邏輯搬進 code,違「宣告式狀態放 DB」。

## DR-005 舊碼處置:移資料、留引擎

- **決定**:移除 `CURATED_FONT_PAIRINGS`/`CURATED_PALETTES`(各約 9 筆寫死資料,併入 56/96 seed);compose 引擎函式(`buildPaletteHues`/`buildCuratedEffects`/`buildBackground`/`pickBest`)保留,移入 `compose-kit.ts` 供 `composeKit` 重用。`selectDesignStyleKit` 重構為 `selectTheme` + `composeKit`。`defaultDesignStyleKit` 為唯一最終 fallback(不留 code 常數中間層)。
- **理由**:DB 為單一事實來源、清死碼;引擎(確定性渲染邏輯)本就該留 codebase。
- **否決**:保留常數當中間 fallback(兩套資料要同步維護);原封不動另寫並行路徑(留重複死碼)。

## DR-006 selectTheme 串接位置:API 載候選、domain 純選

- **決定**:`slides.service`(API)在 design 階段 `await themeStore.listSelectable()` 取候選,呼叫 domain 純函式 `selectTheme(deckBrief, candidates)` 得 `SelectedTheme`,設 `designPlanningResult.styleKit = selected.styleKit` 並把三軸 id 記入 `generationSummary.selectedTheme`。design planner 不再自帶 styleKit。
- **理由**:domain(planner / selectTheme / composeKit)全程無 SQL、可純測;符合既有「DB 存取在 adapter」分層。兩路徑(LLM/fallback)由 slides.service 統一補 styleKit → 行為一致。
- **否決**:design planner 注入 `ThemeStore` port——讓 domain planner 依賴 DB 抽象、測試要備 fake、與既有純 planner 不一致;在 planner 內查 DB——domain 不純。

## DR-007 選擇索引:複合索引納入 kind

- **決定**:selection 查詢為 `WHERE kind=? AND applies_to IN ('presentation','universal') AND active AND (kind<>'style' OR support<>'raw')`。新增/調整複合索引涵蓋 `(kind, applies_to, support)`;既有 `themes_select_idx (applies_to, support)` 以 `kind` 為前導重建。`scope`/`account_id` 索引保留供 008。
- **理由**:候選過濾以 kind 為最強選擇條件;前導 kind 讓三次 `listSelectable`(每 kind 一次,或一次撈全部再分組)都走索引。
- **否決**:不動索引——全表掃(列數雖小但查詢頻繁於每次生成);為三軸各建獨立索引——冗餘。

## DR-008 B 級 token 形態:自由值 sanitize + 結構特效用 enum

- **決定**:擴充 `DesignStyleKit`(皆 optional,缺則引擎忽略):
  - `effects.cardBackdropBlurPx?: number` → `safeNumber` → `backdrop-filter: blur(Npx)`(Glassmorphism)。
  - `effects.glow?: string` → `safeCssValue`/`safeHex` 組出 → 疊加 `box-shadow`/`drop-shadow`(Y2K)。
  - `background.textureOverlay?: "grain" | "noise" | "paper"` → **enum**,引擎映射成內建 data-URI/疊層於 `.deck::before`(E-Ink/Vintage)。
  - `background.gradientAnimation?: { preset: "aurora" | "mesh"; durationMs: number }` → **enum + 數值**,引擎產對應 `@keyframes`,受 `prefers-reduced-motion` 守衛(Aurora/Gradient Mesh)。
- **理由**:自由值(blur px、glow 色)逐值 sanitize 即安全;紋理/keyframe 若吃自由 CSS 無法可靠 sanitize(可注入 keyframe 名/結構),故以 enum 由引擎擁有實際 CSS——契合「宣告式 token 進 DB、確定性引擎留 codebase」。
- **否決**:全部吃自由 CSS——keyframe/結構注入風險;全部寫死不進 DB——B 級無法資料化、違 feature 目標。

## DR-009 style kind 分級與 A 級 token authoring

- **決定**:`style` kind 依 inventory 分級打 `support`:A 級(~14)`full`(完整 structure token);B 級 `full`(007 擴 token 後);C 級 `raw`(`style_kit` 只存 `{ rawDesignSystemVariables: "<CSV 原文>" }`,selection 排除)。A 級逐筆把 CSV `Design System Variables` 對應成 `effects`/`motion`/`patternLayouts`/`typeScale`/background 結構,於 seed authoring 時逐筆對照引擎覆蓋確認。
- **理由**:全量入庫但 gate 在 selection;C 級先 raw、日後加版型不必重 seed。
- **否決**:C 級不入庫——日後要重 seed;A 級自動轉 structure——CSV 變數與引擎 token 非一對一,需人工判讀。

## DR-010 generationSummary 擴充:selectedTheme 三軸 id

- **決定**:`GenerationSummary` 加 `selectedTheme: { style: string | null; palette: string | null; font: string | null; fallback: boolean }`。`slides.service` 從 `SelectedTheme` 填入;`fallback=true` 表該軸(或全部)退回 default。隨 `deck_revisions.generation_summary` jsonb 持久化。
- **理由**:可追溯「選了哪三軸 / 是否退回 default」而不需重跑 demo(FR-013);jsonb 欄已是 opaque,擴充無 migration。
- **否決**:只記 composite kitName 字串——較難程式化查詢;不記——失可追溯性。

## DR-011 seed 驗證失敗語意:全量先驗證、整批 rollback

- **決定**:`seedThemes` 在單一 transaction 內**先對全部 seed 跑 kind-aware 驗證**,任一筆不合法即**整批不寫入(rollback)**並回報所有不合法列;不採「跳過壞列、寫入其餘」的 partial success(FR-007)。
- **理由**:seed 是要餵 selection 的完整 catalog,半套(缺幾筆 / 缺某 kind 安全預設)會讓 `selectTheme` 候選不齊、no-match 收斂行為失準;all-or-nothing 讓「seed 成功」= catalog 完整,失敗時 DB 維持原狀、可修完重跑。idempotent upsert 與 rollback 不衝突(重跑覆蓋)。
- **否決**:跳過壞列繼續——可能默默留下不完整 catalog,且「全部已覆蓋」的假象難在完工時察覺;逐列獨立 transaction——壞列前後狀態不一致、更難回推。

# Implementation Plan: 編輯頁圖表編輯（換視覺、編輯數據點、移除、新增）

**Branch**: `014-chart-editing` | **Date**: 2026-06-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-chart-editing/spec.md`

## Summary

在 010 編輯頁開放圖表的結構化編輯：edit request 新增 `chartOperations`（`set_visual`／`remove_chart`／`add_chart`／`edit_data`），由 `applyDeckEdit` 在白名單合併後、確定性重渲染前以新純函式 `applyChartOperations` 套用——衍生 `chartIntents`／`designPlan`（含新 `visualOverride` 欄位）隨 `origin="edit"` revision 寫入既有 jsonb 欄位。使用者數據以 `{ label, valueText, unit }` 提交，domain 確定性導出 `numericValue`／`displayValue` 並建構 `user_provided` fact（確定性 id、`value` 鏡像）；series validators 守門與降級鏈一行不改；揭露雙軌——`GenerationSummary.userDataDisclosures`（結構化，UI 用）＋ `slideDeck.reviewReport` 同步（`humanReviewNotes` 揭露行、user_data intent 的 `chartingDecisions` 條目）。**零 LLM、零 DB migration、零新端點**；live preview 走同一 pure function，byte-for-byte parity 含衍生 id。

**Artifact Language**: 本 plan 與相關 Spec Kit 文件以繁體中文撰寫。

## Technical Context

**Language/Version**: TypeScript 5（Node.js 20.19.5、pnpm 10.30.3 monorepo）

**Primary Dependencies**: 既有——NestJS（api）、React 19 + Vite + Tailwind v4（web）、Drizzle（DB）、BullMQ/Redis（與本 feature 無交集）。**零新依賴。**

**Storage**: PostgreSQL 既有 `deck_revisions`（`chart_intents`／`design_plan`／`generation_summary` jsonb）。**零 schema migration**（僅 jsonb 內容的 additive 擴充）。

**Testing**: Vitest（domain/contracts/api/web）＋ Playwright（e2e）。

**Target Platform**: Web（既有部署：docker compose → EC2）。

**Project Type**: pnpm monorepo（packages/domain、packages/contracts、apps/api、apps/web）。

**Performance Goals**: live preview 操作→更新 ≤ 1 秒（本地確定性渲染、零網路，SC-001）；其餘沿用 010 基線。

**Constraints**: 全程零 LLM（FR-012）；`@slides-agent/domain` 維持 browser-bundle-safe（live preview 前提）；無隨機/時鐘（確定性 id，FR-008）。

**Scale/Scope**: domain 新模組 2 檔＋既有 4 檔擴充；contracts 全公開面同步（deck.ts／index.ts／openapi.ts／slide-generation.schema.json＋schema 測試，data-model §7）；api 透傳；web 新元件 3 個＋draft/save 擴充。上限常數：每頁 1 圖、每圖 12 點、單請求 50 operations。

## Constitution Check

- **Specification First**: [spec.md](./spec.md) 已接受——兩輪審查（7 findings＋4 殘留）全數修正，Clarifications 記錄完整決策軌跡。無未解問題：點數上限已定案 12（FR-011）。
- **Behavior-Driven User Value**: US1–US4 各自獨立可測可示範（spec 各 US 的 Independent Test/Demo），G/W/T 場景共 17 條；US1 單獨即為可交付 MVP。
- **Source Fidelity**: 未編輯的點原 fact 原樣（id/lineage/displayValue 不動，data-model §4b）；使用者數據 = `user_provided` 新 fact、不沿用原 id（FR-008）、`value` 鏡像 `metric.displayValue`（R6）；displayValue 自 `valueText + unit` 導出、保留輸入精度不換算（FR-006）。
- **Reviewable Generation**: `GenerationSummary.userDataDisclosures`（n/m 點，data-model §6）＋ `reviewReport` 同步（§6a：humanReviewNotes 揭露行、chartingDecisions 條目——FR-010 的 review 輸出承諾）＋既有 `renderedCharts` notes（降級原因）＋`replacesFactId` 稽核線索；revision 鏈不可變可回溯。
- **Web-First Deliverable**: 輸出仍為 self-contained HTML＋inline SVG；零外部資源、零第三方 chart lib。
- **Backend-Configured LLM Boundary**: 本 feature 全程零 LLM 呼叫（FR-012），無 provider/model 面；使用者數據不離開自有 DB。
- **Coherent Deck Design System**: 圖表用色/字型/間距仍由 theme styleKit（accentHues）統御；`visualOverride` 只選視覺形狀、不開樣式；011 換主題後使用者編輯的圖表隨主題一致重渲染。
- **Semantic Titles and Data Visualization**: 圖表標題可由使用者改寫且不宣稱來源出處（CR-006）；「什麼數據能畫什麼圖」守門權 100% 留在既有 validators——override 是請求不是命令，不合格照降級鏈＋note（FR-003/FR-009、R1）。
- **Code Quality and Simplicity**: 最小做法 = 在既有 `applyDeckEdit` 管線插一個純函式（R2），渲染器只動 `selectVisual`／`toChartPoint` 兩個內部點、`template-html-renderer` 零修改（data-model §8）。新抽象僅 `ChartOperation`（被拒的更簡替代：開放 raw contentBlocks——撞 010 防竄改牆；獨立端點——破壞 revision 原子性，見 R2/R10 Alternatives）。每個新型別都有立即消費者：`ChartVisualOverride`→`selectVisual`、`SourceFact.metric`→`toChartPoint`、`UserDataDisclosure`→編輯器/summary 面板、`CHART_EDIT_LIMITS`→操作驗證。**無 dead code/shim/雙軌**：`EditRevisionPayload.chartIntents`/`designPlan` 直接改語意為「衍生值」（無 operations 時 === base，舊行為是新行為的特例，非並存路徑）；型別檔分離遵循慣例（`chart-operation.types.ts` 純型別、`apply-chart-operations.ts` 行為）。
- **TDD and DDD**: 首批 failing tests = `apply-chart-operations.test.ts` 的 §4 規則矩陣＋不變式 §10（先紅後綠）。bounded context：deck-edit（操作套用）＋ rendering（視覺選擇）＋ content-core（fact 形狀）。domain 語言在 `chart-operation.types.ts`／`design.types.ts`／`deck.types.ts`，行為在 `apply-chart-operations.ts`／`chart-renderer.ts`；無新 port（零 I/O）。
- **Lean Test Scope**: 不重測 validators 內部（008 已覆蓋）——只測「override/user 數據有接上守門」（每 override 值一組合格/不合格樣本）；契約測試錨定 §10 不變式與 SC-007 對抗性矩陣，不驗 html 字串細節（除 parity byte 比對——那是明文契約 FR-014）。
- **Consistent UX and Language**: 「視覺類型」（auto/圓餅/折線/長條/指標卡/表格）、「來源資料／使用者提供」（徽章）、「已用於第 N 頁」（共享標註）、「降級」（notes）——UI/揭露/文件統一（CR-013），與 008/009 控制台既有圖表用語對齊。
- **Performance and Operational Evidence**: preview ≤ 1s（本地渲染，與 010 同基線，無新風險）；證據 = `userDataDisclosures`、`renderedCharts` notes、`replacesFactId`、不可變 revision 鏈、parity 測試輸出。
- **Manual Verification Path**: 圖表視覺可讀性（label 重疊、降級對比）無法自動化——quickstart「手動驗證」段：編輯頁 preview 抽查 → 儲存重開 → 下載 HTML 目視。
- **Release Verification**: `pnpm test`（四包）＋ `pnpm test:e2e`；驗收含衍生 slideDeck/chartIntents 結構有效（contracts）、HTML 渲染（`has-chart-split` DOM 錨點）、鍵盤導覽與 16:9 不退化（quickstart）。

## Project Structure

### Documentation (this feature)

```text
specs/014-chart-editing/
├── plan.md              # 本檔
├── research.md          # Phase 0（R1–R10，皆經 code 驗證）
├── data-model.md        # Phase 1（§1–§10）
├── quickstart.md        # Phase 1（驗證路徑）
├── contracts/
│   └── chart-operations.contract.md
└── tasks.md             # Phase 2（/speckit-tasks 產出，非本命令）
```

### Source Code (repository root)

```text
packages/domain/src/
├── deck-edit/
│   ├── chart-operation.types.ts        # 新：ChartOperation/EditDataPoint/CHART_EDIT_LIMITS（§3）
│   ├── apply-chart-operations.ts       # 新：套用＋語意驗證＋確定性 id（§4）
│   ├── apply-deck-edit.ts              # 改：options.chartOperations、管線插入（§5）
│   └── apply-deck-edit.types.ts        # 改：payload 註解語意（衍生值）
├── design/design.types.ts              # 改：ChartVisualOverride、ChartTreatmentPlan.visualOverride（§1）
├── deck/deck.types.ts                  # 改：SourceFact.metric/user_provided/replacesFactId、UserDataDisclosure（§2/§6）
└── rendering/
    ├── chart-series-extractor.ts       # 改：toChartPoint metric short-circuit（§8）
    └── chart-renderer.ts               # 改：selectVisual 接 visualOverride、isChartFallback（§8）

packages/domain/test/
├── deck-edit/apply-chart-operations.test.ts    # 新
└── rendering/chart-visual-override.test.ts     # 新（＋extractor 既有測試擴充）

packages/contracts/src/deck.ts          # 改：chartOperations 形狀驗證（§7）
packages/contracts/src/index.ts         # 改：GenerationSummaryContract.userDataDisclosures、visualOverride
packages/contracts/src/openapi.ts       # 改：同步上述欄位
packages/contracts/schemas/slide-generation.schema.json  # 改：visualOverride/userDataDisclosures/SourceFact 擴充

apps/api/src/modules/decks/
├── decks.controller.ts                 # 改：透傳 chartOperations
└── deck-request.parser.ts              # 改：body 解析

apps/web/src/features/deck-editor/
├── editable-slide-draft.ts             # 改：chartOperations＋mutators（§9）
├── DeckEditorView.tsx                  # 改：save body、preview options
├── live-preview-render.ts              # 改：透傳 chartOperations
├── SlideEditPanel.tsx                  # 改：圖表區塊改卡片
├── ChartEditorCard.tsx                 # 新：卡片＋視覺選擇器＋notes＋共享提示
├── ChartDataTable.tsx                  # 新：點編輯表格＋徽章＋還原＋排序
└── AddChartPanel.tsx                   # 新：來源清單 tab＋手動輸入 tab

apps/web/src/features/decks/…           # 改：summary 面板呈現 userDataDisclosures
```

**Structure Decision**: 沿用既有 monorepo 分層——domain 純函式（無 I/O）、contracts 形狀驗證、api 薄透傳、web 元件化。無新 package、無新路由、無新端點。

## 實作階段（phase 切分，供 /tasks 展開）

### Phase A — Domain 地基（US1 的核心，全部 TDD 先行）

1. `deck.types.ts`／`design.types.ts` 型別擴充（§1/§2/§6）＋ `chart-operation.types.ts`（§3）。
2. `toChartPoint` metric short-circuit（§8）——先寫「無 metric 零變化」回歸測試。
3. `selectVisual` 接 `visualOverride` ＋ `isChartFallback` 擴充——override 矩陣測試（每值 × 合格/不合格 series）。
4. `applyChartOperations`（§4）——規則矩陣＋不變式 §10（確定性 id、零部分套用、`[]` 回歸）。
5. `applyDeckEdit` 整合（§5）＋ `userDataDisclosures` 計算（§6）＋ `reviewReport` 同步（§6a）——繼承封閉性測試（衍生結果再編輯）、回歸不變式（唯一例外 = 空 disclosures 欄位）。

### Phase B — Contracts ＋ API（US1 儲存通路）

6. contracts 全公開面（§7）：`EditRevisionRequestContract.chartOperations` 形狀驗證＋`GenerationSummaryContract`/openapi/JSON schema 的 `userDataDisclosures`／`visualOverride`／`SourceFact` 擴充＋對抗性形狀與 schema 測試。
7. controller/parser 透傳＋整合測試（201 含 disclosures、400/409、SC-007 矩陣）。

### Phase C — US1 前端（P1，可交付）

8. draft `chartOperations`＋mutators（§9，含合併規則測試）；save body／live preview 透傳。
9. `ChartEditorCard`（視覺選擇器＋notes 呈現）；`SlideEditPanel` 接入。parity 驗證（preview html === save html）。

### Phase D — US2 前端（P2，可交付）

10. 移除鈕＋`AddChartPanel` 來源清單 tab（全列＋「已用於第 N 頁」標註）；封面/已有圖頁的入口規則。

### Phase E — US3/US4（P3，同批）

11. `ChartDataTable`（徽章/還原/增刪列/排序/標題編輯）＋共享提示。
12. `AddChartPanel` 手動輸入 tab。
13. summary 面板呈現 `userDataDisclosures`；揭露文案統一（CR-013）。

### Phase F — 驗證收尾

14. e2e（US1 happy path＋降級 note）；quickstart 手動路徑走查；`pnpm test`／lint 全綠。

## Complexity Tracking

> 無憲法違規需豁免。唯一新抽象 `ChartOperation` 的必要性論證見 Constitution Check「Code Quality and Simplicity」與 research R2/R10 的被拒替代方案。

## Evidence Plan

- **Automated Evidence**: domain 規則矩陣＋不變式測試、contracts 對抗性矩陣（SC-007）、parity byte 比對（含衍生 id）、controller 整合測試、e2e 截圖/trace。
- **Manual Verification**: quickstart「手動驗證」——split 版面可讀性、降級視覺對比、鍵盤導覽/16:9 不退化。
- **Operational Evidence**: preview 零網路（DevTools 驗證步驟在 quickstart）；零 migration（`pnpm db:generate` 無 diff 即證）。
- **Decision Evidence**: spec Clarifications（三個 session 完整決策軌跡）＋ research R1–R10（每項含被拒替代方案）＋ `userDataDisclosures`/`replacesFactId`/notes 留痕。

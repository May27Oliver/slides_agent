# Implementation Plan: Deck 編輯頁 + 跨 deck 歷史切換器（第一批 US1–US3）

**Branch**: `010-deck-editor` | **Date**: 2026-06-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-deck-editor/spec.md`

## Summary

把現況 `/decks` 的「唯讀預覽」升級成**逐張結構化編輯頁**（`/decks/:id/edit`），並在生成頁與編輯頁提供**跨 deck 歷史切換器**。第一批交付 **US1–US3**（US4 富文本為 Post-MVP，不在此批）：

- **US1（P1，主軸）**：逐張編輯 grounded 四欄位（`title`/`message`/`outline[].text`/`speakerNotesDraft`）+ 結構編輯（增刪重排條列與 slide）。儲存走新端點 `POST /api/decks/:id/revisions`：**domain use-case `applyDeckEdit`**（依 slide `id` 對應 base 白名單合併 + outline 保真 + 驗證 + **確定性重渲染** + 組 summary → payload）→ **persistence port `appendEditRevision`**（交易內樂觀並發 + append + 更新 `currentRevisionId`）。右欄即時預覽用 **client 端引入的同一份 domain renderer**（debounced，零網路）。
- **US2（P2）**：混合式切換器（搜尋 + 最近 8 + 瀏覽全部），復用 `GET /api/decks`，零新後端端點。
- **US3（P3）**：localStorage 草稿（3 分鐘暫存、具體還原/衝突判定、beforeunload）。

技術取向：**沿用既有 deterministic renderer 與 `saveNewDeck` 的「domain 產 payload、store 持久化」分層**；唯讀/並發/保真保證**全在後端強制**；前端視覺由 `ui-ux-pro-max` skill 引導。

**Artifact Language**: 本 plan 與相關 Spec Kit 產物以繁體中文撰寫。

## Technical Context

**Language/Version**: TypeScript（既有 monorepo：`packages/domain`、`packages/contracts`、`apps/api`、`apps/web`）。

**Primary Dependencies**: 後端 **NestJS + Drizzle ORM（platform-express runtime，PostgreSQL）**；前端 React 19 + React Router 7 + Vite 5 + Tailwind v4；既有 domain deterministic renderer（`html-deck-renderer` / `template-html-renderer`，已查證 **browser-bundle-safe**）。

**Storage**: PostgreSQL，沿用 006 `decks` / `deck_revisions`（`origin` 欄位、`currentRevisionId`、`(accountId, updatedAt)` index）。**本批新增一個 additive nullable 欄位 `deck_revisions.chart_intents jsonb`（C1/FR-006a，持久化圖表渲染輸入）**，不改既有欄位語意。

**Testing**: vitest（domain / contracts / api）、@testing-library/react（web 元件）、Playwright（關鍵 e2e）。TDD。

**Target Platform**: Web（瀏覽器控制台 + Node API）。

**Project Type**: Web application（monorepo：backend `apps/api` + frontend `apps/web` + shared `packages/*`）。

**Performance Goals**: 右欄預覽 client 端 **debounced 本地重渲染、零網路往返**；儲存重渲染為**確定性、無 LLM 往返**；localStorage 暫存輕量不阻塞輸入。

**Constraints**: 編輯/重渲染**零 LLM 呼叫**；唯讀塊/結構/並發保證**後端強制**（不依賴前端）；request/response 合約僅新增一個寫入端點與其 contract；client 端 bundle 引入 domain renderer 須維持 renderer browser-safe。

**Scale/Scope**: 單一新端點、單一新 domain use-case + 1 個 port 方法、~2 個新前端 feature 目錄（deck-editor、deck-switcher）+ `/decks` 升級。deck 上限沿用 200（切換器最近 8 + 搜尋 + 瀏覽全部）。

## Constitution Check

*GATE：Phase 0 前必過；Phase 1 設計後復檢。*

- **Specification First**: 已接受 `spec.md`（四輪審查落地）。無阻擋性未決問題；US4 明列 Post-MVP，不在本批。
- **Behavior-Driven User Value**: US1/US2/US3 皆具 Given/When/Then 且可獨立展示/測試（spec §User Scenarios）。US1 為可獨立交付 MVP（編輯→存版本），US2/US3 為其導覽/韌性增強。
- **Source Fidelity**: 編輯內容為使用者自撰文字，忠實持久化、**不 LLM 改寫**；保留 slide 的唯讀塊/非編輯欄位**取自 base**；outline 條列**文字未變沿用 `sourceTrace`/`emphasis`、改寫/新增清空**（FR-003a，不捏造）。
- **Reviewable Generation**: edit revision 沿用 base `reviewReport` 並標示 pre-edit；重渲染重跑 deterministic HTML 生成驗證；驗證/衝突/篡改皆據實回應（400/409）。
- **Web-First Deliverable**: 交付物為 `apps/web` 編輯頁/切換器；輸出仍為 self-contained HTML deck（重渲染快取於 `deck_revisions.html`）。
- **Backend-Configured LLM Boundary**: 本批**完全不呼叫 LLM**；無 provider/model 選擇。新端點僅 deterministic 驗證 + 渲染 + 持久化。
- **Coherent Deck Design System**: 重渲染**沿用 base `designPlan`/styleKit**，編輯前後主題一致；不改設計決策邏輯。
- **Semantic Titles and Data Visualization**: 標題改為使用者手動編輯（不自動生成）；圖表本批唯讀、重渲染沿用 base 圖表結果（資料不變則圖不變），不改「何時成圖」決策。
- **Code Quality and Simplicity**: 最小可讀路徑——復用既有 renderer 與 `saveNewDeck` 分層；唯一新端點；切換器復用既有 list/get（拒絕新增列表端點）。**責任分層**：`apply-deck-edit.ts`（use-case）/`slide-merge.ts`（合併純函式）/`deck-store.port.ts`（adapter 邊界）/`*.types.ts`（型別）分離。**無 dead code / shim**：新端點與型別為純新增；不保留雙形狀。每個新型別/欄位都有近期消費者（contract↔controller↔use-case↔store↔web）。複雜度（client 端 bundle renderer、id-based 合併）見 Complexity Tracking。
- **TDD and DDD**: 首批失敗測試 = `slide-merge` 合併/保真純函式測試 + `applyDeckEdit` use-case 測試 + endpoint 400/404/409 測試。主要 domain 概念：`applyDeckEdit`（use-case）、`SlideMerge`（合併規則）、`DeckStore.appendEditRevision`（port）。domain 行為落於 `packages/domain/src/deck-edit/`；adapter 邊界 `deck-store.port.ts`；型別 `*.types.ts`。
- **Lean Test Scope**: 測試聚焦可觀察行為（合併輸出、保真、端點狀態碼/副作用、切換器互動、草稿生命週期、client↔server parity），避免重測既有 renderer/selectTheme 內部。
- **Consistent UX and Language**: 統一術語「編輯頁 / 版本(revision) / 草稿(draft) / 切換器 / 唯讀塊 / 確定性重渲染 / 樂觀並發」，跨 UI/文件/測試與 006–009 對齊；三語 i18n 無缺鍵。
- **Performance and Operational Evidence**: 預覽 debounced 本地渲染、儲存無 LLM 往返；證據 = 自動測試 + parity 測試 + 截圖。
- **Manual Verification Path**: 見 spec §Review and Safety Notes / quickstart.md（編輯→存版本→重開一致、唯讀保留、草稿還原/衝突、切換器、parity、三語/RWD/reduced-motion）。
- **Release Verification**: edit revision schema/副作用、重渲染 HTML 生成驗證、編輯器鍵盤導覽、基本 RWD 於完成前驗收（CR-016）。

## Project Structure

### Documentation (this feature)

```text
specs/010-deck-editor/
├── plan.md              # 本檔
├── research.md          # 技術抉擇（client renderer 可行性、合併/分層）
├── data-model.md        # EditRevisionRequest / payload / 合併演算法 / DeckDraft
├── quickstart.md        # 手動驗證路徑
├── contracts/
│   └── edit-revision.contract.md
└── tasks.md             # 第一批 US1–US3 任務
```

### Source Code (repository root)

```text
packages/contracts/src/deck.ts                      # + EditRevisionRequestContract, 錯誤碼（409/400）
packages/contracts/test/edit-revision.test.ts       # 契約形狀測試

packages/domain/src/deck-edit/                       # 【新】編輯 use-case
├── apply-deck-edit.ts                               #   merge→validate→render→summary→payload
├── apply-deck-edit.types.ts                         #   EditRevisionPayload / EditConflict / EditRejection
└── slide-merge.ts                                   #   依 id 白名單合併 + outline 保真（純函式）
packages/domain/src/deck-persistence/
├── deck-store.port.ts                               # + appendEditRevision()
└── deck.types.ts                                    # + EditRevisionInput / AppendEditResult（Conflict）
packages/domain/test/deck-edit/
├── slide-merge.test.ts
└── apply-deck-edit.test.ts
packages/domain/src/index.ts                         # 匯出新型別/函式

apps/api/src/modules/decks/
├── drizzle-deck-store.ts                            # 實作 appendEditRevision（交易內並發+append+update）
└── decks.controller.ts                              # + POST /api/decks/:id/revisions
apps/api/test/
├── deck-store.append-edit-revision.test.ts          # 交易/並發/副作用
└── decks-controller.edit-revision.test.ts           # 200/400/404/409

apps/web/vite.config.ts                              # + resolve.alias '@slides-agent/domain'
apps/web/src/App.tsx                                 # + /decks/:id/edit 路由
apps/web/src/features/deck-editor/                   # 【新】US1
├── DeckEditorView.tsx                               #   三欄容器
├── SlideNavigator.tsx                               #   左：純文字列表（編號+標題）
├── SlideEditPanel.tsx                               #   中：grounded 欄位 + 結構操作 + 唯讀塊提示
├── LivePreview.tsx                                  #   右：client domain renderer（debounced iframe）
├── editable-slide-draft.ts                          #   工作模型 + 結構操作（增刪重排）
├── deck-draft-storage.ts                            #   US3 localStorage 草稿服務
├── deck-editor-client.ts                            #   createEditRevision()
└── *.test.tsx
apps/web/src/features/deck-switcher/                 # 【新】US2
├── DeckSwitcher.tsx                                 #   混合下拉（搜尋+最近8+瀏覽全部）
├── recent-decks.ts                                  #   RECENT_DECKS_LIMIT=8 + 前端過濾
└── *.test.tsx
apps/web/src/features/decks/MyDecksView.tsx          # 升級「全部歷史」+ 搜尋 + 進編輯動作
apps/web/src/features/i18n/                           # zh-TW/en/ja 新增鍵
apps/web/tests/e2e/deck-editor.spec.ts               # 關鍵 e2e
```

**Structure Decision**: Web monorepo。新 domain use-case 置於 `packages/domain/src/deck-edit/`（與既有 `deck-persistence` 並列）；前端兩個新 feature 目錄 `deck-editor`、`deck-switcher`，沿用既有 `features/` 組織。

## 實作階段（phase 切分，供 /tasks 展開）

### Phase A0 — 圖表渲染輸入持久化（C1 / FR-006a，先於 edit 重渲染）

含圖 deck 編輯重渲染要不掉圖，需要 base 的 `chartIntents`，但現況未持久化（衍生含 LLM 故不可零-LLM 重導出）。
- migration：`deck_revisions` 加 nullable `chart_intents jsonb`。
- 型別：`DeckRevision` + `chartIntents`；`DeckDetail.currentRevision` 帶出。
- 生成路徑（既有 008）：`PreviewResult` + `createDeckFromPreviewResult` + `preview-job-execution` 帶上 `generatePreviewDeck(...).chartIntents`。
- drizzle store：讀/寫 `chart_intents`。
- legacy（null）：edit 退 fallback + review note（不謊報）。

### Phase A — Foundational：後端編輯端點（US1 儲存基礎）

US1 的「儲存」依賴此層；前端編輯器（Phase B）與此並行開發、但 US1 的 Independent Test 需兩者合一。
- 契約：`EditRevisionRequest = { baseRevision, slideDeck }` + 409/400/404 **top-level error shape**（I1）。
- domain：`slide-merge`（依 id 白名單合併 + outline 保真）、`applyDeckEdit`（merge→**render→validate→summary**(I3)→payload，取回 base `chartIntents`）。
- port + adapter：`DeckStore.appendEditRevision`（交易內樂觀並發 + append + 更新 currentRevisionId；payload 含 chartIntents）。
- api：`POST /api/decks/:id/revisions`（ownership 404、並發 409、篡改 400）。
- **OpenAPI（C2，手動補）**：`packages/contracts/src/openapi.ts` schema + `apps/api/src/openapi/openapi-document.ts` path。

### Phase B — US1 編輯器前端（P1）

- Vite alias 接 domain renderer（client 預覽基礎）。
- `/decks/:id/edit` 三欄編輯器、grounded 欄位、結構編輯、唯讀塊提示。
- `LivePreview` client 端 debounced 重渲染（同一份 renderer + base designPlan）。
- 儲存串 `deck-editor-client.createEditRevision`，存後以 server `html` 刷新 iframe（parity 校正）。

### Phase C — US2 跨 deck 切換器（P2）

- `DeckSwitcher` 混合下拉（搜尋 + 最近 8 + 瀏覽全部），生成頁/編輯頁共用，復用 `GET /api/decks`。
- `MyDecksView` 升級「全部歷史」+ 搜尋 + 進編輯動作。

### Phase D — US3 localStorage 草稿（P3）

- `deck-draft-storage`：3 分鐘暫存、還原判定（`baseRevision === current.revision && savedAt > current.createdAt`）、衝突判定（`baseRevision !== current.revision` → 顯示最新版）、beforeunload。

### Phase E — 驗證收尾

- a11y（鍵盤/focus）、三語 i18n、RWD（三欄堆疊）、reduced-motion；client↔server parity 測試；e2e；`gitnexus_detect_changes()` 確認影響範圍。

## Complexity Tracking

| Violation / Added Complexity | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| client 端 bundle 引入 domain renderer（+Vite alias） | 真 WYSIWYG、預覽與存檔逐字 parity、零網路往返 | debounced preview-render 端點：每次編輯一趟網路延遲 + 新增端點；結構化草稿預覽：非真 WYSIWYG |
| id-based 白名單合併 + outline 保真（`slide-merge`） | 結構編輯（增刪重排）下仍要防唯讀塊/結構篡改並保來源忠實 | 整份信任 client：可被篡改唯讀塊/結構；整份清 sourceTrace：未改條列也失溯源 |
| 持久化 `chartIntents`（+1 additive column、改生成持久化路徑） | edit 重渲染畫真圖需 chartIntents；衍生含 LLM 不可零-LLM 重導出 | 編輯時 re-derive：踩 LLM segmentation / id 漂移；不存：含圖 deck 編輯掉圖（違反 Source Fidelity/Data Visualization） |
| 修改 `renderTemplateDeck` 之上層串接（store/api 寫入路徑） | 新增 edit revision 寫入 | 無——沿用既有 renderer 與 saveNewDeck 分層已是最小路徑 |

## Evidence Plan

- **Automated Evidence**: `slide-merge` 合併/保真測試（含對抗性 payload）、`applyDeckEdit` use-case 測試、`appendEditRevision` 交易/並發測試、endpoint 200/400/404/409 測試、切換器渲染/搜尋/路由測試、草稿生命週期測試、**client↔server parity 測試**、e2e。
- **Manual Verification**: quickstart.md（編輯→存版本→重開一致、唯讀保留、草稿還原/衝突顯示最新版、切換器、parity 目視、三語/RWD/reduced-motion）。
- **Operational Evidence**: 截圖（三欄編輯器、切換器下拉、衝突提示）；確認重渲染零 LLM（無外呼/可注入渲染器）。
- **Decision Evidence**: 篡改鎖 400（誠實/可測）、client renderer 路徑 A（browser-safe 查證）、責任分層（use-case vs port）——均記於 spec Clarifications 與本 plan。

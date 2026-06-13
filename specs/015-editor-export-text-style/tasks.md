---
description: "Task list — 015 編輯頁匯出與文字樣式覆寫（US1–US4）"
---

# Tasks: 編輯頁匯出與文字樣式覆寫（下載 HTML/PPTX、文字大小顏色、16:9 預覽）

<!-- This project writes Spec Kit artifacts in Traditional Chinese by default. -->

**Input**: `/specs/015-editor-export-text-style/`（plan.md / spec.md / research.md / data-model.md / contracts/ / quickstart.md）

**交付順序（依 spec 優先級）**：US1（P1 下載 HTML）→ US4（P2 16:9 預覽）→ US3（P3 文字樣式覆寫）→ US2（P4 下載 PPTX）。四個 US **彼此獨立可交付**。

**Tests**: TDD——先寫聚焦失敗測試再實作最小行為。domain/contracts/api 用 vitest；web 元件用 vitest + RTL；關鍵流程 Playwright。

**三個鎖定點**（plan）貫穿：① outline id 雙軌相容（C 系）② PPTX 三段式工作 contract（D 系）③ textStyleOverrides 單一真實來源（C 系）。

## 路徑慣例（本 repo）

- domain 測試：`packages/domain/test/{deck,deck-edit,rendering,pptx-export-job}/*.test.ts`
- contracts 測試：`packages/contracts/test/*.test.ts`
- api 測試：`apps/api/test/*.test.ts`
- web 元件測試：與元件同層 `apps/web/src/features/deck-editor/*.test.tsx`
- web e2e：`apps/web/tests/e2e/*.spec.ts`

**格式**：`[ID] [P?] [Story] 描述`。`[P]` = 不同檔案、無相依，可並行。

---

## Phase 1：Setup（共享）

- [ ] T001 確認 spec-kit 上下文指向本 feature（`.specify/feature.json` = `specs/015-editor-export-text-style`；015/016 為堆疊式開發，實際 git branch 可能為下游的 `016-…`，以 `feature.json` 為準而非 branch 名）、`pnpm test` 基線全綠；確認 `pnpm db:generate` 無 diff（本 feature **零 migration**——id/樣式存於既有 `slideDeck` JSON 欄、PPTX job 存 Redis/檔案）。任務中若出現非預期 schema diff 即停下重審。
- [ ] T001a **編輯前 impact 分析（CLAUDE.md 要求）**：對將修改的既有 symbol 跑 `gitnexus_impact({target, direction:"upstream"})` 並回報 blast radius：`mergeEditedDeck`／`mergeOutline`、`applyDeckEdit`、`template-html-renderer`（renderSlide / 標題/bullet 渲染）、`buildHtmlDownload`、`EditableSlideDraft`、`SlideEditPanel`、`LivePreview`、`DeckEditorView`、`validateEditRevisionRequest`、`DecksController`（revisions handler）、`SlideOutlineItem`/`Slide` 型別消費端。**任一 HIGH/CRITICAL 先向使用者警示再動工**；後續 phase 臨時新增受影響 symbol 比照補跑。
- [ ] T002 [P] 新增依賴：`nanoid`（domain，outline id；或既有等價短碼工具）、`pptxgenjs`（api/worker）、`playwright`（api/worker，chromium）。記錄到對應 package.json；worker 容器化的 chromium 安裝留待 D5（research R2）。

---

## Phase 2：Foundational（極小共享；不阻擋各 US 獨立進行）

**說明**：本 feature 四 US 高度獨立，無重型共享地基。此階段只鎖定「跨 US 會用到的詞彙與 i18n key」，避免重工。

- [ ] T003 [P] i18n 詞彙鍵（CR-013 一致性）：`apps/web/src/i18n` 增 `editor.download.html`、`editor.download.pptx`、`editor.download.needSave`、`editor.textStyle.size`（px 字級）、`editor.textStyle.color`、`editor.textStyle.fontFamily`、`editor.textStyle.reset`、`editor.pptx.{queued,processing,done,failed,retry}`。繁中文案，集中一處供各 US 引用。

**Checkpoint**：詞彙就緒，US1/US4/US3/US2 可並行開工。

---

## Phase 3：User Story 1 — 下載 HTML（Priority: P1）🎯 MVP

**Goal**：編輯頁在 dirty=false 時，一鍵下載目前 adopted revision 的 server html。

**Independent Test**：已存 deck 編輯頁點下載 HTML → 得 `<標題>-rev<N>-<時間戳>.html`，離線開啟與線上一致；dirty 時入口停用。

### Tests（先寫，須失敗）⚠️

- [ ] T004 [P] [US1] `apps/web/src/features/slide-generation/download-html.test.ts`（擴充或新增）：`buildHtmlDownload(html, { deckTitle, revision })` 產出檔名 `<sanitized-title>-rev<N>-<YYYYMMDD-HHmmss>.html`（標題去非法字元、空白轉連字號）；data URL 內容等於傳入 html。
- [ ] T005 [P] [US1] `apps/web/src/features/deck-editor/DeckEditorView.test.tsx`：dirty=true 時「下載 HTML」按鈕 disabled 且顯示需先 Save；`notReady`/無 revision 時入口不出現；dirty=false 時可點。

### Implementation

- [ ] T006 [US1] 擴充 `apps/web/src/features/slide-generation/download-html.ts`：`buildHtmlDownload` 增 `{ deckTitle, revision }` 參數與檔名格式；**同步更新生成頁既有呼叫點**（無舊簽名 shim，Constitution「no shim」）。
- [ ] T007 [US1] `apps/web/src/features/deck-editor/DeckEditorView.tsx`：header 加「下載 HTML」入口，來源 = `base.html`（adopted revision），`dirty || !base?.html` 時 disabled + 提示先 Save。

**Checkpoint**：US1 可獨立交付 ✅

---

## Phase 4：User Story 4 — 左側預覽固定 16:9（Priority: P2）

**Goal**：左側即時預覽以 16:9 letterbox 呈現，不被容器拉伸；縮放與全螢幕維持比例。

**Independent Test**：改變視窗寬度與全螢幕，slide 始終 16:9、留邊、不變形。

### Tests（先寫，須失敗）⚠️

- [ ] T008 [P] [US4] `apps/web/src/features/deck-editor/LivePreview.test.tsx`：iframe 外層容器套用固定 16:9 aspect 盒（aspect-ratio / aspect-[16/9]）並置中；斷言該包裹節點存在且 iframe 不再 `h-full w-full` 直接填滿非比例容器。

### Implementation

- [ ] T009 [US4] `apps/web/src/features/deck-editor/LivePreview.tsx`：iframe 外包一層 `aspect-[16/9] w-full max-h-full` 置中容器（letterbox/pillarbox），全螢幕 ref 仍套用於該比例容器；確認 `F` 全螢幕路徑維持比例。沿用既有 sandbox/postMessage 不動。

**Checkpoint**：US4 可獨立交付 ✅

---

## Phase 5：User Story 3 — 文字大小與顏色覆寫（Priority: P3）

**Goal**：對選定 slide 的標題/message/每條 outline 設 px 字級（8–240）、自由顏色（#RRGGBB）與字型家族；即時預覽、Save 持久化、條列以穩定 id 綁定。

**Independent Test**：點欄位設樣式→預覽即時→重排不錯位→刪條列清樣式→Save 重載保留→下載 HTML 一致。

### C1 — domain 型別 + 套用邏輯（鎖定點 3：單一真實來源）

- [ ] T010 [P] [US3] `packages/domain/src/deck/deck.types.ts`：新增 `SlideOutlineItem.id?: string`、`TextStyleOverride`（`sizePx?`/`color?`/`fontFamily?`）、`SlideTextStyleOverrides`、`Slide.textStyleOverrides?`、常數 `TEXT_SIZE_PX_MIN=8`/`TEXT_SIZE_PX_MAX=240`/`TEXT_FONT_FAMILY_MAX=64`（data-model §1/§2）；自 `packages/domain/src/index.ts` 匯出型別。
- [ ] T011 [US3] `packages/domain/test/rendering/text-style-override.test.ts`（先寫失敗）：純函式 `textStyleInlineStyle(override, field)` →（a）`sizePx` 映射 `font-size:<px>px`，缺省回空；（b）`color` 映射 `color:<#RRGGBB>`，缺省回空；（c）`fontFamily` 映射 `font-family:'<family>'`，缺省回空；（d）皆缺 → 空字串。
- [ ] T012 [US3] 實作 `packages/domain/src/rendering/text-style-override.ts` 使 T011 轉綠（sizePx/color/fontFamily→inline style，見 research R3）。
- [ ] T013 [US3] `packages/domain/test/rendering/template-html-renderer.*`（擴充）先寫失敗：title（L158）、message（L145）、bullet（L137 各條依 `outline[i].id` 查 `outlineById`）注入 helper 產生的 inline style，併入既有 `style` 屬性而不破壞 `--d:` 動畫變數；用到的字型家族注入 Google Fonts `<link>`；無覆寫時 html 與現行深等值（回歸 parity）。
- [ ] T014 [US3] 實作 `packages/domain/src/rendering/template-html-renderer.ts` 三點注入使 T013 轉綠。

### C2 — 合併（鎖定點 1：outline id 雙軌 + 正規化）

- [ ] T015 [US3] `packages/domain/test/deck-edit/slide-merge.*`（擴充）先寫失敗矩陣：
  - **id 雙軌**：base 無 id + edited 有 id → 合併後 outline 帶 edited id；`sourceTrace/emphasis` 仍由 text-FIFO 還原（未改字 → 保 trace；改字 → 空 trace + 中性 emphasis）。
  - 同文字重複條列各自獨立 id 不碰撞。
  - `textStyleOverrides` 納入可編輯白名單（retained slide 保留 base 其他唯讀欄）。
  - **孤兒清理**：`outlineById` 有 key 不對應任何現存 outline id → 正規化後移除；空 entry（無任何 property）或越界 property（sizePx 超 8–240 / color 非 hex / fontFamily 不合或過長）→ 移除/拒絕。
  - 唯讀牆不變：`contentBlocks/type/slideKind/layout/layoutIntent` 篡改仍 `INVALID_EDIT`；`textStyleOverrides`/`outline.id` 不被當篡改。
  - new slide 分支：outline 帶 edited id、`textStyleOverrides` 經正規化沿用。
- [ ] T016 [US3] 新檔 `packages/domain/src/deck-edit/text-style-normalize.ts`：`normalizeTextStyleOverrides(overrides, mergedOutline)` 去預設值、清孤兒（data-model §2/§3）。
- [ ] T017 [US3] 改寫 `packages/domain/src/deck-edit/slide-merge.ts`：`mergeOutline` 改為「id 走 edited、trace 走 text-FIFO」雙軌；retained/new 分支白名單納入 `textStyleOverrides` 並呼叫 `normalizeTextStyleOverrides`。使 T015 轉綠。**直接取代舊 mergeOutline，不保留舊形狀 shim。**

### C3 — contracts + schema

- [ ] T018 [P] [US3] `packages/contracts/test/*`（edit-revision / slide-generation-schema）先寫失敗：`validateEditRevisionRequest`/`validateOverrideShape` 對 `slideDeck.slides[].outline[].id`（若存在為非空字串）、`textStyleOverrides`（`sizePx∈[8,240]`、`color` 符合 `/^#[0-9a-fA-F]{6}$/`、`fontFamily` ≤64 字且符合 charset、`outlineById` 物件且 ≤100 entries）形狀驗證，越界 → issues；缺 id/缺樣式的舊 revision 放行。
- [ ] T019 [US3] `packages/contracts/src/deck.ts` 的 `validateEditRevisionRequest`/`validateOverrideShape` + `packages/contracts/schemas/slide-generation.schema.json`：`SlideOutlineItem` 增 optional `id`、`Slide` 增 optional `textStyleOverrides`（`sizePx` 數值範圍、`color` hex pattern、`fontFamily` 長度受限字串），維持 `additionalProperties:false`。使 T018 轉綠。

### C4 — web 編輯 UI

- [ ] T020 [US3] `apps/web/src/features/deck-editor/editable-slide-draft.test.ts`（擴充）先寫失敗：`fromRevision` 對缺 id 的 outline 惰性補發穩定 id（session 內穩定、不改文字）；`setTitleStyle/setMessageStyle/setOutlineStyle(id,...)`、單屬性 reset、整欄 reset 的 immutable 更新；`removeBullet` 同步刪 `outlineById[id]`（清孤兒）；`addBullet` 產生新 id。
- [ ] T021 [US3] `apps/web/src/features/deck-editor/editable-slide-draft.ts`：實作 T020 行為（惰性補 id、寫 override、刪條列清孤兒、新條列發 id）。
- [ ] T022 [P] [US3] 新檔 `apps/web/src/features/deck-editor/text-style-toolbar.tsx` + 測試：欄位樣式面板（px 字級滑桿 8–240 + 自由色彩選擇器 #RRGGBB + 字型家族下拉 + 單屬性/整欄 reset），值與 callback 受控；自由顏色經 hex regex 驗證、字型取自內建字型目錄（FR-007/FR-008）。
- [ ] T023 [US3] `apps/web/src/features/deck-editor/SlideEditPanel.tsx`：標題、message、每條 outline 接 `text-style-toolbar`（右側滑出面板），接到 draft 的 setXxxStyle；outline 以 `item.id` 為 React key/綁定（取代 index）。
- [ ] T024 [US3] `apps/web/src/features/deck-editor/DeckEditorView.tsx`：將樣式編輯接入既有 `edit(...)` 通路（與 title/outline 同走 draft → LivePreview → toRequest），確認 `live-preview-render`（`applyDeckEdit`）即時反映（parity 自動）。

### C5 — 整合/e2e

- [ ] T025 [US3] `apps/web/tests/e2e/text-style.spec.ts`：設標題大字級 px + 顏色 + 字型 → 預覽即時 → outline 設樣式後重排不錯位 → 刪條列樣式消失 → Save → 重載保留 → 下載 HTML 比對（quickstart US3）。

**Checkpoint**：US3 可獨立交付 ✅

---

## Phase 6：User Story 2 — 下載 PPTX（Priority: P4，鏡射 preview-jobs）

**Goal**：對目前 current revision 建立非同步 PPTX 匯出工作（chromium 逐頁截圖 + pptxgenjs），前端輪詢、完成下載；owner scope、current-only revision 驗證、檔案+TTL、單人併發=1（store 原子 `SET NX`）。

**Independent Test**：dirty=false 點下載 PPTX → queued→processing→done → 下載 .pptx，頁數=投影片數、每頁 16:9 截圖、含主題/圖表/文字樣式；>60 頁拒絕；跨帳號 404。

### D1 — contracts + domain（TDD）

- [ ] T026 [P] [US2] 新檔 `packages/contracts/src/pptx-export-job.ts` + `pptx-export-request.ts` + 測試：`PptxExportJobStatus`（queued/processing/done/failed）、建立 request（`{revision}`）、建立回應、狀態回應、驗證函式（鏡射 `preview-job.ts`/`preview-request.ts`）。
- [ ] T027 [P] [US2] 新檔 `packages/domain/src/pptx-export-job/*` + `packages/domain/test/pptx-export-job/*`（先寫失敗）：`pptx-export-job.types.ts`、`pptx-export-job.service.ts`（狀態機 queued→processing→done/failed、逾時歸 failed）、`pptx-export-job-serialization.ts`、`pptx-export-job-timeout.ts`（`PPTX_EXPORT_JOB_TIMEOUT_MS`、`PPTX_MAX_PAGES=60`）、`*-store.port.ts`、`*-runner.port.ts`（鏡射 preview-job domain）。自 index 匯出。

### D2 — API 側（鏡射 preview-jobs；建立/查狀態/下載三端點）

- [ ] T028 [US2] 新增 `apps/api/src/modules/pptx-export-jobs/` 全套：`queue.config.ts`、`*.tokens.ts`、`*.providers.ts`、`redis-pptx-export-job-store.ts`（Redis key 前綴 `pptx-export-job:`、per-account 原子 `createIfNoActive`/`SET NX` 鎖（單人併發=1，無 TOCTOU）、TTL）、`bullmq-pptx-export-job-runner.ts`、`pptx-export-job-queue.service.ts`、`pptx-export-request.parser.ts`、`pptx-export-job-timeout-sweeper.ts`、`pptx-export-jobs-api.runtime.ts`、`FsPptxArtifactStore`（`${jobId}.pptx` 寫檔 + `purgeOlderThan` TTL 清理）、`pptx-export-jobs.module.ts`（鏡射 preview-jobs；Explore 對照清單）。
- [ ] T029 [US2] `apps/api/src/modules/pptx-export-jobs/pptx-export-jobs.controller.ts` + `apps/api/test/pptx-export-jobs.controller.test.ts`（先寫失敗）：
  - `POST /api/decks/:id/pptx-exports`：deck 屬 `req.user.id`（否則 404）、`revision` 仍為 deck 的 current 版本（否則 **400** `PPTX_REVISION_MISMATCH`，current-only，要求 reload）、頁數≤60（否則 400）、store 原子 `createIfNoActive` 擋既有 in-flight（否則 **409** `PPTX_EXPORT_IN_PROGRESS`，單人併發=1，無 TOCTOU）、rate limit。
  - `GET /api/decks/:id/pptx-exports/:jobId`：owner+deck scope（否則 404）、回四態 + downloadUrl/failure。
  - `GET /api/decks/:id/pptx-exports/:jobId/file`：scope + done + 未過 TTL → 串流，`Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation` + `Content-Disposition`（否則 404）。
- [ ] T030 [US2] `apps/api/src/app/app.module.ts`：掛 `PptxExportJobsModule`（API 側 provider/sweeper/runtime）。

### D3 — worker 側（chromium 截圖 + pptx 組裝）

- [ ] T031 [US2] 新檔 `apps/api/src/modules/pptx-export-jobs/pptx-export-job-execution.ts` + 測試（以假/注入 page 抽象測狀態流與失敗清理，不在單元測試起真 chromium）：載入該 revision html → 逐張 `section[data-slide-id]` 切頁（postMessage `deck:goToSlide` 或 DOM 顯示，畫面穩定後）→ 截圖 1920×1080 → pptxgenjs 逐頁 full-bleed 嵌圖 → 經 `FsPptxArtifactStore` 以 `${jobId}.pptx` 寫檔（含 `byteSize/pageCount`）；失敗/逾時 per-job 冪等刪暫存與部分檔（FR-018）。
- [ ] T032 [US2] 新檔 `apps/api/src/modules/pptx-export-jobs/pptx-export-worker.runtime.ts`：BullMQ consumer（鏡射 `preview-worker.runtime.ts`，注入 Playwright/瀏覽器 launcher）。
- [ ] T033 [US2] `apps/api/src/app/worker.module.ts`：掛 `PptxExportWorkerRuntime` 與 store/queue provider（worker 側）。

### D4 — web

- [ ] T034 [P] [US2] 新檔 `apps/web/src/features/deck-editor/pptx-export-client.ts` + `pptx-export-polling.ts` + 測試（鏡射 `slide-generation/preview-job-polling.ts`）：建立工作、輪詢狀態、取 downloadUrl 觸發下載、失敗可重試。
- [ ] T035 [US2] `apps/web/src/features/deck-editor/DeckEditorView.tsx`：「下載 PPTX」入口 + 進度狀態（queued/processing/done/failed）+ 完成下載 + 失敗重試；dirty 守門（與 HTML 一致，帶目前 revision number）。

### D5 — 部署/驗證（高風險）

- [ ] T036 [US2] worker 容器化：image 內含 chromium 與系統相依（`playwright install --with-deps chromium` 或含瀏覽器 base image，research R2）；更新 012 compose 的 worker service。
- [ ] T037 [US2] 正式機（EC2/compose）跑一次實際 PPTX 匯出至 done 並下載開啟比對（quickstart 部署驗證）；確認 artifact TTL 清理、暫存無殘留、跨帳號 404。

**Checkpoint**：US2 可獨立交付 ✅

---

## Phase 7：Polish & Cross-Cutting

- [ ] T038 [P] OpenAPI 文件：`apps/api/src/openapi/*` 補 PPTX 三端點；確認 edit revision contract 文件無 drift（outline.id/textStyleOverrides 為 slideDeck 內 optional，無新 request 欄位）。
- [ ] T039 [P] README：新增 `apps/api/src/modules/pptx-export-jobs/README.md`（鏡射 preview-jobs/README）。
- [ ] T040 移除冗餘/重疊測試；補未覆蓋的 domain 規則單元測試（normalize 孤兒、sizePx/hex/字型邊界）。
- [ ] T041 **提交前 `gitnexus_detect_changes()`**（CLAUDE.md）核對影響面只落在預期 symbol/flow；任一非預期擴散即停下重審。
- [ ] T042 跑 `pnpm test` 全綠 + `apps/web` e2e；執行 quickstart.md 全程人工驗證（含 16:9 縮放、PPTX 開啟、跨帳號隔離、EC2 實匯出）。
- [ ] T043 Release 檢查（CR-016）：slide JSON schema 對新 optional 欄位有效；HTML 渲染套用覆寫；既有鍵盤導覽不受影響；預覽 responsive 維持 16:9。

---

## Dependencies & Execution Order

- **Phase 1 Setup** → 無相依，先做。
- **Phase 2 Foundational（T003 i18n）** → 各 US 引用，建議先。
- **US1（P3）/US4（P4）/US3（P5）/US2（P6）** → 皆只依賴 Setup+詞彙，可並行；交付建議序 US1→US4→US3→US2。
- **US3 內部**：C1（domain 型別/renderer）→ C2（merge）→ C3（contracts/schema）→ C4（web）→ C5（e2e）。型別 T010 先於其餘 C 系。
- **US2 內部**：D1（contracts/domain）→ D2（API）→ D3（worker）→ D4（web）→ D5（部署）。
- **Phase 7 Polish** → 所有要交付的 US 完成後。

### 並行機會

- T004/T005（US1 測試）、T008（US4）、T026/T027（US2 contracts/domain）、T010（US3 型別）標 [P] 可並行。
- 不同 US 由不同人並行；同一檔案任務（如多次改 `DeckEditorView.tsx`：T007/T024/T035）需序列避免衝突。

---

## Notes

- 每個 US 獨立可完成、可展示、可測；先確認測試失敗再實作。
- 守 Constitution：no shim / no dead code——`buildHtmlDownload` 擴參同步改呼叫點、`mergeOutline` 直接取代、樣式套用只在 domain 一處。
- 零 LLM、零 migration；樣式輸入以「數值範圍（sizePx 8–240）＋ hex regex（color）＋ 字型白名單/長度（fontFamily ≤64）＋ outlineById ≤100 entries」為 bounded DoS 邊界；PPTX 有 owner scope/TTL/併發=1（store 原子 `SET NX`）/頁數上限/current-only。
- PPTX 部署（D5）為最高風險，務必正式機實匯出驗證。
- 每完成一任務或邏輯群組即 commit。

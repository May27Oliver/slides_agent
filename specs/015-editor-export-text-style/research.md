# Research: 015 編輯頁匯出與文字樣式覆寫

**Branch**: `015-editor-export-text-style` | **Date**: 2026-06-13

對 spec 三輪 clarify 後仍需技術定案的點，逐項給結論 + 理由 + 被否決的替代方案。三個 plan 鎖定點（outline id 相容、PPTX 三段式工作、textStyleOverrides 單一真實來源）的決策依據都在此。

---

## R1. outline 穩定 id 的相容路徑（鎖定點 1）

**現況**：`SlideOutlineItem`（`packages/domain/src/deck/deck.types.ts:98`）只有 `text / sourceTrace / emphasis`，無 id。`slide-merge.ts:119-147` 的 `mergeOutline` **刻意以 text-FIFO pool 比對** base/edited 來還原 `sourceTrace/emphasis`（fidelity），註解明寫「bullets have no stable id」。schema `SlideOutlineItem` 是 `additionalProperties:false`（`packages/contracts/schemas/slide-generation.schema.json:498`）。

**決策**：
- `SlideOutlineItem` 新增 **optional `id`**（不透明短碼，slide 內唯一，非由 text 衍生）。
- **id 與 textStyle 由 edited 端權威帶入**（與 `text` 同級的「使用者編輯欄位」）；**`sourceTrace/emphasis` 仍由 text-FIFO 還原**（fidelity 邏輯完全不動）。
- `mergeOutline` 改為：回傳 `{ id: edited.id, text, sourceTrace: matched?.sourceTrace ?? [], emphasis: matched?.emphasis ?? DEFAULT }`。即「id 走 edited、trace 走 text 比對」兩條獨立軌道。
- **client 惰性補發**：`EditableSlideDraft.fromRevision` 建構時，對缺 id 的 outline item 補發 id（session 內穩定）；**僅 Save 時持久化**到新 revision，不主動改寫舊 revision。
- schema 對 `SlideOutlineItem` 多開一個 optional `id`（維持 `additionalProperties:false`）。

**理由**：text 改寫時 sourceTrace 本就該歸零（rewrite=無來源），這與 id 是否相同無關 → 維持 text 比對最忠實。id 只負責「樣式綁定鍵」，由 client 權威帶入最簡單，server reload 的 base 無 id 也不影響比對。

**否決的替代**：
- *server merge 改為「以 id 比對還原 trace」* → 被否決：base（DB 舊資料）沒有 id，server reload 後無 id 可比，且 text 改寫卻 id 不變時會錯誤保留舊 trace（破壞 fidelity）。
- *id 由 text 雜湊衍生* → 被否決：同文字重複條列會碰撞（reviewer finding 2 明確點到）。
- *一次性 migration 批次回寫所有舊 revision 補 id* → 被否決：改寫歷史 revision、違反 immutability，且非必要（惰性補發即可）。

---

## R2. PPTX 產生：無頭瀏覽器選型與打包（鎖定點 2 的部署面）

**決策**：worker 端用 **Playwright（chromium）** 載入「該 revision 的 server 渲染 html」，逐張 slide 截圖 1920×1080，再用 **pptxgenjs** 逐頁滿版嵌圖組成 .pptx。

**理由**：
- 截圖方案（已定案）要求 100% 視覺還原 → 直接用瀏覽器渲染既有 html 最忠實，且 **文字樣式覆寫（R3）自動入圖、圖表 SVG 自動正確**，零額外對映工作。
- Playwright 的 chromium 安裝/容器化文件成熟（`mcr.microsoft.com/playwright` base image 或 `npx playwright install --with-deps chromium`），repo 前端已用 `@playwright/test`（團隊熟悉）。
- pptxgenjs 是純 JS、無原生相依，加一張 full-bleed image/頁即可，組裝邏輯極薄。

**導覽方式**：deck runtime 已支援 `postMessage({type:"deck:goToSlide", index})`（`LivePreview.tsx:99`、`deck-runtime-script.ts`）。worker 以 `page.evaluate` 對 `window.postMessage` 觸發切頁、等動畫穩定後截圖；或直接以 DOM 操作顯示第 i 個 `section[data-slide-id]`。實作時擇一，以「畫面穩定後截圖」為準。

**部署（EC2 / docker-compose）**：worker image 需含 chromium 與其系統相依。沿用 012 的 compose；worker service 改用含瀏覽器相依的 base image 或在 build 階段 `playwright install --with-deps chromium`。**列為本 feature 最高部署風險**，plan Phase 的驗證步驟需在正式機跑一次實際匯出。

**否決的替代**：
- *puppeteer（自帶 chromium）* → 可行的次選；選 Playwright 是因團隊既有熟悉度與容器文件。差異不大，research 不阻擋實作期換 puppeteer（介面相近）。
- *原生 pptx 形狀對映（pptxgenjs 文字框/圖表）* → 已於 spec clarify 否決（無法還原 HTML 主題、工程量最大）。
- *client 端產 pptx* → 已否決（HTML/SVG→pptx 還原度最差）。

---

## R3. textStyleOverrides 的單一真實來源與渲染 parity（鎖定點 3）

**現況**：`renderLivePreview`（`apps/web/.../live-preview-render.ts`）直接呼叫 domain 的 `applyDeckEdit`，與 server 存檔走**同一個 domain use-case**；slide 標題/message/bullet 的渲染都在 `packages/domain/src/rendering/template-html-renderer.ts`（title L158、message L145、bullet L137，皆已有 `style` 屬性可注入）。type 字級 CSS 變數定義於 `deck-style-css.ts:370-375`（`--type-title/-message/-bullet`），顏色角色為 `--text/--accent/--muted`、heading 色。

**決策**：
- `TextStyleOverride` 型別與套用邏輯**只存在 domain**（新檔 `packages/domain/src/rendering/text-style-override.ts`，純函式：給定 override 與欄位種類 → 產生 inline style 片段）。
- `template-html-renderer.ts` 在三個渲染點呼叫該 helper，把 `font-size: <sizePx>px`、`color: <#RRGGBB>`、`font-family: '<family>'` 併入既有 `style` 屬性；px 量於 1920×1080 簡報空間，與預覽/PPTX 同一空間故 WYSIWYG。renderer 並為所有用到的字型家族注入 Google Fonts `<link>`，使預覽與 PPTX 皆能載入該字型。
- web UI **只負責把 override 寫進 draft**（`EditableSlideDraft`），**不自己算樣式**；型別從 `@slides-agent/domain` 匯入（web 已是此模式）。contracts 只做形狀驗證，不持有套用邏輯。
- 因 client preview 與 server 存檔共用 `applyDeckEdit`→ 同一 renderer → 同一 helper，**樣式 parity 結構上不可能漂移**（與 011 主題、014 圖表同一保證）。

**輸入模型/邊界**（deep-review 後改採；自由 px/hex/字型，取代早先 token/級距）：

| 屬性 | 值 / 範圍 | 對應 inline style |
|------|----------|------------------|
| `sizePx` | 任意 px，8–240（`TEXT_SIZE_PX_MIN=8`/`TEXT_SIZE_PX_MAX=240`） | `font-size: <px>px` |
| `color` | 自由 hex，regex `/^#[0-9a-fA-F]{6}$/` | `color: <#RRGGBB>` |
| `fontFamily` | 內建字型目錄名稱（~90 種），≤64 字（`TEXT_FONT_FAMILY_MAX=64`），charset `/^[A-Za-z0-9][A-Za-z0-9 -]*$/` | `font-family: '<family>'` + Google Fonts `<link>` |

任一缺 = 沿用該欄位主題預設（不輸出對應 style）。UI 為自由色彩選擇器 + 任意 px 滑桿 + 字型家族下拉（較豐富的文字編輯器 UX）。DoS 邊界 = 數值範圍 + hex regex + 字型白名單/長度（`validateOverrideShape`，`outlineById` ≤100 entries），domain `normalizeTextStyleOverrides` 再以相同規則重驗。

**否決的替代**：
- *web 端另寫一套 inline style 計算* → 被否決：兩條渲染通路 → parity 漂移（reviewer finding 明確要避免）。
- *固定級距/4 色 token 列舉* → 早先 clarify 採此，deep-review 後刻意反轉為自由 px/hex/字型，提供更豐富的文字編輯器 UX；以「數值範圍 + hex regex + 字型白名單/長度」維持 bounded DoS 邊界。

---

## R4. HTML 下載通路（open question 1 定案的技術面）

**決策**：純前端，複用並擴充 `apps/web/src/features/slide-generation/download-html.ts` 的 `buildHtmlDownload`，增加 `deckTitle` 與 `revision` 參數，檔名 `<sanitized-title>-rev<N>-<時間戳>.html`；下載來源為 adopted revision 的 `html`（client 已持有）。不新增 server endpoint。

**理由**：adopted revision 本身帶 `html`（`DeckRevisionContract.html`），是該 revision 的權威 server 渲染；data URL 下載零後端成本。dirty 時停用入口（FR-002）確保下載=畫面=已存版本。

**否決的替代**：*server 下載 endpoint* → 多一條路徑與 auth 面，HTML 不需要（PPTX 才需要，因為要 server 端瀏覽器）。

---

## R5. PPTX 工作參數（quantification，已定案值的落點）

| 參數 | 值 | 落點 |
|------|----|------|
| 截圖尺寸 | 1920×1080（16:9） | worker viewport |
| 單工作逾時 | ≤30 頁 90s 目標；硬上限沿用 sweeper 機制（可調高於 preview 的 5min） | `PPTX_EXPORT_JOB_TIMEOUT_MS` |
| 最大頁數 | 60（超出 400 拒絕） | request parser |
| 單人併發 | 1 | store 內 **原子 create-if-no-active**（per-account Redis `SET NX` 鎖，無 TOCTOU；非「先查 active 再 create」） |
| 全域併發 | 沿用 queue config worker concurrency | `queue.config` |
| artifact TTL | 與 job retention 一致（建議 10–30min），到期清理 | redis store ttl + 暫存檔刪除 |
| 狀態 | `queued / processing / done / failed`（逾時歸 failed） | domain job status enum |
| content-type | `application/vnd.openxmlformats-officedocument.presentationml.presentation` | 下載回應 |

**artifact 儲存位置（已定案）**：**檔案（local disk / 容器 volume）+ TTL 清理**。worker 產生後以 `${jobId}.pptx` 寫入專屬目錄，API 在 owner-scoped 下載端點串流該檔；`FsPptxArtifactStore.purgeOlderThan` 依 TTL 清理，per-job 在失敗/逾時時冪等刪除。下載 endpoint scope 綁 owner（FR-017）。（早先評估過的 Redis base64 候選已否決——pptx 可能數 MB，不宜塞 Redis。）

---

## 既有可複用資產（避免重造）

| 需求 | 既有資產 | 位置 |
|------|---------|------|
| async job 全套（建立/入列/worker/狀態/逾時/scope） | preview-jobs 子系統 | `apps/api/src/modules/preview-jobs/*`（25 檔對照見 plan） |
| edit revision 儲存通路（樂觀並發、白名單合併） | 010/011/014 | `decks.controller.ts`、`apply-deck-edit.ts`、`slide-merge.ts` |
| client↔server 渲染 parity | `applyDeckEdit` 單一 use-case | `live-preview-render.ts` ↔ `template-html-renderer.ts` |
| HTML 下載 helper | `buildHtmlDownload` | `download-html.ts` |
| deck 切頁 postMessage | deck runtime | `deck-runtime-script.ts`、`LivePreview.tsx:99` |

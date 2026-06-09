# Data Model: Deck 編輯頁（010，第一批 US1–US3）

> 本批 schema 變更僅一個 **additive nullable 欄位** `deck_revisions.chart_intents jsonb`（§8 / C1），不改既有欄位語意；其餘沿用 006 `decks` / `deck_revisions`。以下為新增的 **contract / domain 型別**與**合併演算法**。形狀以既有型別為準（`packages/domain/src/deck/deck.types.ts` 的 `SlideDeck`/`Slide`/`SlideOutlineItem`；`packages/domain/src/deck-persistence/deck.types.ts` 的 `DeckRevision`）。

## §1 EditRevisionRequest（contract，新增於 `packages/contracts/src/deck.ts`）

```ts
export interface EditRevisionRequestContract {
  /** client 編輯所基於的版本號（樂觀並發，FR-020） */
  baseRevision: number;
  /** 編輯後 slideDeck（含結構變更：條列/slide 增刪重排） */
  slideDeck: SlideDeck;
}
```

回應沿用既有 `DeckRevisionContract`（成功 201/200）。新增失敗碼：

| HTTP | code | 觸發 |
|---|---|---|
| 404 | `DECK_NOT_FOUND` | 非本人 / 不存在（不洩漏存在性） |
| 409 | `REVISION_CONFLICT` | `baseRevision !== currentRevision.revision`（回應攜帶 `currentRevision` 號） |
| 400 | `INVALID_EDIT` | 缺 `baseRevision`/型別錯、篡改保留 slide 唯讀塊/非編輯欄位、新增 slide 夾帶結構塊、HTML 生成驗證失敗（空 deck/必要欄位缺） |

錯誤回應採**既有 top-level error shape**（I1，對齊 `NotFoundException({code,message})` 與 `openapi.ts` 的 `errorSchema`）：`{ code: string; message: string; fields?: string[] }`（409 另帶 `currentRevision: number`）。**不**用巢狀 `{ error: { ... } }`。

## §2 可編 vs 伺服器權威欄位（白名單）

| 欄位 | 可編？ | 規則 |
|---|---|---|
| `Slide.title` | ✅ | 直接套用 |
| `Slide.message` | ✅ | 直接套用 |
| `Slide.outline[].text` | ✅ | 套用（保真見 §4） |
| `Slide.speakerNotesDraft` | ✅ | 直接套用 |
| slide 集合（增/刪/重排，依 `id`） | ✅ | 依 client 提交的 slide 順序與 id 集合 |
| `Slide.outline` 條列（增/刪/重排） | ✅ | 依 client 提交的條列順序 |
| `Slide.contentBlocks`（含 `chart_placeholder`） | ❌ | 保留 slide 取自 base；新增 slide 不得有（否則 400） |
| `Slide.type` / `slideKind` / `layout` / `layoutIntent` | ❌ | 保留 slide 取自 base；新增 slide 由 server 指派預設 |
| `Slide.outline[].sourceTrace` / `emphasis` | ❌（衍生） | 由 §4 保真規則決定，非 client 直接設定 |
| `Slide.sourceTrace` | ❌ | 保留 slide 取自 base；新增 slide 為 `[]` |
| `SlideDeck.reviewReport` | ❌ | 沿用 base（pre-edit，CR-002） |

## §3 合併演算法（`slide-merge.ts`，純函式）

輸入：`base: SlideDeck`（來自 base revision）、`edited: SlideDeck`（client）。輸出：`mergedSlideDeck: SlideDeck` 或 `EditRejection`（→ 400）。

```
建 baseById = Map(base.slides by id)
for each slide s in edited.slides（依序，決定新順序）:
  if s.id ∈ baseById:                      # 保留 slide
    b = baseById[s.id]
    if s.contentBlocks 與 b.contentBlocks 不逐欄相等
       OR s.type/slideKind/layout/layoutIntent 與 b 不相等:
        → REJECT(INVALID_EDIT)             # 篡改唯讀/非編輯欄位（FR-021）
    merged = { ...b,                        # 唯讀塊/非編輯欄位一律取自 base
               title: s.title, message: s.message,
               speakerNotesDraft: s.speakerNotesDraft,
               outline: mergeOutline(b.outline, s.outline) }   # §4
  else:                                     # 新增 slide
    if s.contentBlocks 非空 → REJECT(INVALID_EDIT)            # 防注入圖表
    merged = { id: s.id, title, message, speakerNotesDraft,
               outline: s.outline.map(t => ({ text: t.text, sourceTrace: [], emphasis: DEFAULT_EMPHASIS })),
               contentBlocks: [],
               type: DEFAULT_TYPE, slideKind: deriveKind(index),
               layout: DEFAULT_LAYOUT, layoutIntent: DEFAULT_LAYOUT_INTENT,
               sourceTrace: [] }
  push merged
mergedSlideDeck = { ...base, title: base.title, subtitle: base.subtitle, slides: mergedSlides }
```

註：**deck-level `title`/`subtitle` 本批不可編、一律沿用 base**（I2 鎖定；deck 標題編輯列 future）。`DEFAULT_*` 常數定義於 `slide-merge.ts`，`DEFAULT_EMPHASIS = "context"`（中性）。

## §4 outline 保真（`mergeOutline(baseOutline, editedOutline)`，FR-003a）

條列無 stable id，採**文字比對**保真：

```
建 baseTextPool = base 條列依 text 建可重複對應（FIFO per text）
for each item in editedOutline:
  if item.text 命中 baseTextPool（仍有未用配額）:
     沿用該 base 條列的 { sourceTrace, emphasis }，consume 配額
  else:                              # 新增或改寫
     { text: item.text, sourceTrace: [], emphasis: DEFAULT_EMPHASIS }
```

效果：未改動條列保來源；改寫/新增清空 `sourceTrace`、`emphasis` 中性。重複文字退化為 FIFO 對應（可接受，不捏造）。

## §5 EditRevisionPayload（domain，`apply-deck-edit.types.ts`）

`applyDeckEdit` 產出、交給 store append 的**已渲染** payload（對齊既有 `DeckRevision` 欄位、`origin="edit"`）：

```ts
export interface EditRevisionPayload {
  slideDeck: SlideDeck;               // 合併後
  designPlan: DesignPlanningResult;   // 沿用 base（不重算）
  chartIntents: ChartIntent[] | null; // 沿用 base（FR-006a；legacy=null）
  html: string;                       // 確定性重渲染
  generationSummary: GenerationSummary;
  origin: "edit";
  sourceJobId: null;
}

export type ApplyDeckEditResult =
  | { ok: true; payload: EditRevisionPayload }
  | { ok: false; rejection: "INVALID_EDIT" | "VALIDATION_FAILED"; detail: string };
```

`applyDeckEdit(base: DeckRevision, edited: SlideDeck)`：① `slide-merge` 合併（拒絕→ `INVALID_EDIT`）→ ② **`renderTemplateDeckArtifact`**（base `designPlan` + base `chartIntents`；renderer 內部順序為 **render → `validateGeneratedHtml` → `buildGenerationSummary(deck, renderedCharts, selectedTheme)`**，I3）→ 若驗證未過 → `VALIDATION_FAILED` → ③ 組 `EditRevisionPayload`（`chartIntents` 沿用 base）。**不碰 DB、不跑 LLM**。legacy base（`chartIntents` null）→ 不傳 chartIntents，圖表退 fallback + review note（FR-006a）。

## §6 DeckStore.appendEditRevision（port，`deck-store.port.ts`）

```ts
appendEditRevision(
  accountId: string,
  deckId: string,
  expectedBaseRevision: number,
  payload: EditRevisionInput,            // = EditRevisionPayload 的 opaque 持久化形狀
): Promise<AppendEditResult>;

type AppendEditResult =
  | { ok: true; revision: DeckRevision & { createdAt: string } }
  | { ok: false; conflict: true; currentRevision: number };
```

實作（drizzle，**單一交易**）：載入 deck（ownership）→ 若無 → 回 caller 處理 404 → 若 `current.revision !== expectedBaseRevision` → `{ ok:false, conflict, currentRevision }` → 否則 insert revision(`current+1`) + 更新 `currentRevisionId`/`updatedAt`，回 `{ ok:true, revision }`。**MUST NOT** 含 validate/render/summary。

## §7 前端模型

- **EditableSlideDraft**（`editable-slide-draft.ts`）：載入 deck 後的不可變工作模型；提供 immutable 操作 `setTitle/setMessage/setNotes/setOutlineText/addBullet/removeBullet/moveBullet/addSlide/removeSlide/moveSlide`；攜帶唯讀 `contentBlocks` 與非編輯欄位（送回後端供 id 對應）。送出時轉為 `EditRevisionRequestContract`。
- **DeckDraft**（`deck-draft-storage.ts`，localStorage）：`{ deckId, baseRevision: number, slideDeck: SlideDeck, savedAt: string(ISO) }`，key = `deck-draft:{deckId}`。判定：可還原 `baseRevision === current.revision && savedAt > current.createdAt`；衝突 `baseRevision !== current.revision`。
- **切換器常數**：`RECENT_DECKS_LIMIT = 8`（`recent-decks.ts`）；最近清單 = `listDecks()` 依 `updatedAt` desc 取前 8；搜尋為前端 `title` 過濾全量（≤200）。

## §8 圖表渲染輸入持久化（C1 / FR-006a）

renderer 畫真圖需 `chartIntents: ChartIntent[]`（不在 `slideDeck` 內、衍生含 LLM 故不可零-LLM 重導出），MUST 持久化：

- **DB**：`deck_revisions` 新增 **nullable** 欄位 `chart_intents jsonb`（additive migration；既有列為 null）。
- **型別**：`DeckRevision`（`deck-persistence/deck.types.ts`）+ `revision: number; slideDeck; designPlan; html; generationSummary; origin; sourceJobId` **新增 `chartIntents: unknown | null`**（opaque）；`DeckDetail.currentRevision` 同步帶出。
- **生成路徑（既有 008）**：`PreviewResult` 新增 `chartIntents`；`createDeckFromPreviewResult` 把 `result.chartIntents` 寫入 revision；建構 `PreviewResult` 之處（`apps/api/src/modules/preview-jobs/preview-job-execution.ts`）帶上 `generatePreviewDeck(...).chartIntents`。
- **編輯路徑**：`applyDeckEdit` 從 base revision 取 `chartIntents` 傳 `renderTemplateDeckArtifact`；新 edit revision 沿用同一份 `chartIntents`（payload §5）。
- **Legacy（`chart_intents` null）**：不傳 → 圖表退 renderer 確定性 fallback（表格/文字）+ review note「無持久化圖表輸入」；**不**靜默掉圖、**不**謊報。一次性 backfill 為 future（非本批）。


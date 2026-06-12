# Data Model: 015 編輯頁匯出與文字樣式覆寫

**Branch**: `015-editor-export-text-style` | **Date**: 2026-06-13

新增/異動的領域型別。原則：**型別只在 domain 定義一次**，contracts 做形狀驗證、web 匯入 domain 型別（與 011/014 同模式）。

---

## §1. SlideOutlineItem.id（新增 optional 欄位）

`packages/domain/src/deck/deck.types.ts`

```ts
export interface SlideOutlineItem {
  id?: string;            // 新增：slide 內唯一、不透明短碼，樣式覆寫的綁定鍵
  text: string;
  sourceTrace: string[];
  emphasis: SlideOutlineEmphasis;
}
```

**規則**：
- `id` optional：舊 revision 無此欄位；client `EditableSlideDraft` 建構時惰性補發，Save 時才持久化（R1）。
- 不透明（如 8 碼 nanoid），**非由 text 衍生** → 同文字重複條列不碰撞。
- 新增條列產生新 id；現有條列保留既有 id。
- 持久化權威 = edited 端（client 提交什麼 id 就是什麼），server 不重算。

**Schema**（`packages/contracts/schemas/slide-generation.schema.json` 的 `SlideOutlineItem`）：`properties` 增 `"id": { "type": "string", "minLength": 1 }`，**不列入 `required`**，維持 `additionalProperties:false`。

---

## §2. TextStyleOverride（新增）＋ Slide.textStyleOverrides（新增 optional）

`packages/domain/src/deck/deck.types.ts`（或新檔 `text-style.types.ts`，由 plan 決定落點）

```ts
export type TextSizeLevel = "S" | "M" | "L" | "XL";          // 倍率 0.85 / 1 / 1.25 / 1.6
export type TextColorToken = "text" | "accent" | "muted" | "heading";

export interface TextStyleOverride {
  sizeLevel?: TextSizeLevel;     // 省略 = M（主題預設）
  colorToken?: TextColorToken;   // 省略 = text（主題預設）
}

export interface SlideTextStyleOverrides {
  title?: TextStyleOverride;
  message?: TextStyleOverride;
  outlineById?: Record<string, TextStyleOverride>;   // key = SlideOutlineItem.id
}

export interface Slide {
  // ...既有欄位
  textStyleOverrides?: SlideTextStyleOverrides;       // 新增 optional
}
```

**規則**：
- **預設不儲存**：`sizeLevel=M` 且 `colorToken=text`（或未設）→ 該 `TextStyleOverride` 視為空，不寫入；某欄位空 entry 省略；`outlineById` 空物件省略；整個 `textStyleOverrides` 空則省略。（正規化函式 `normalizeTextStyleOverrides` 在 domain）
- **reset 粒度**：單一屬性 reset（清 `sizeLevel` 或 `colorToken`）、整欄 reset（移除該欄位 entry）。
- **outlineById 清理**：domain 正規化時，丟棄 key 不對應任何現存 outline `id` 的 entry（防孤兒；client 刪條列時也先清，雙保險）。
- **倍率/token 對照**：見 research R3 表。套用邏輯只在 domain renderer（R3）。

**Schema**：`Slide` 的 `properties` 增 `textStyleOverrides`（巢狀物件，`sizeLevel`/`colorToken` 為 enum），non-required，`additionalProperties:false`。

---

## §3. 合併行為異動（slide-merge.ts）

`packages/domain/src/deck-edit/slide-merge.ts`

**`mergeOutline` 改寫**（R1）——id 與 trace 兩條獨立軌道：

```ts
return editedOutline.map((item) => {
  const matched = pool.get(item.text)?.shift();        // 仍用 text-FIFO 還原 fidelity
  return {
    id: item.id,                                        // 新增：edited 權威帶入
    text: item.text,
    sourceTrace: matched?.sourceTrace ?? [],
    emphasis: matched?.emphasis ?? DEFAULT_EMPHASIS
  };
});
```

**retained slide 合併白名單**（`slide-merge.ts:54-62`）增列 `textStyleOverrides`（與 title/message/outline 同級的可編輯欄位），並經 `normalizeTextStyleOverrides(merged.outline)` 清孤兒：

```ts
mergedSlides.push({
  ...baseSlide,
  title: editedSlide.title,
  message: editedSlide.message,
  speakerNotesDraft: editedSlide.speakerNotesDraft,
  outline: mergedOutline,
  textStyleOverrides: normalizeTextStyleOverrides(editedSlide.textStyleOverrides, mergedOutline)
});
```

**`detectReadonlyTamper`（L100-117）不變**：`textStyleOverrides`/`outline.id` 不是唯讀欄位，不納入篡改偵測（它們是使用者可編輯的）。`contentBlocks/type/slideKind/layout/layoutIntent` 唯讀牆維持原樣。

**new slide 分支**（L63-85）：新 slide 的 outline 也帶 edited id；`textStyleOverrides` 沿用 edited（經正規化）。

---

## §4. EditRevisionRequest（無新欄位，沿用既有通路）

`textStyleOverrides` 與 `outline.id` **隨 `slideDeck` 一起送**（`slideDeck` 在 contract 為 `unknown`，merge 做權威驗證）——**不需新增 request 欄位**。沿用 010/014 的 `POST /api/decks/:id/revisions`、樂觀並發、`accountId` 隔離。詳見 `contracts/text-style-and-revision.contract.md`。

---

## §5. PptxExportJob（新增，鏡射 preview-job 模型）

`packages/domain/src/pptx-export-job/pptx-export-job.types.ts`

```ts
export type PptxExportJobStatus = "queued" | "processing" | "done" | "failed";
//  逾時歸於 failed（帶 failure.reason = "timeout"）

export interface PptxExportJob {
  jobId: string;
  accountId: string;          // owner，scope 驗證用（FR-017）
  deckId: string;
  revision: number;           // 目標版本（FR-003a 後端以此驗證並只匯出該版）
  status: PptxExportJobStatus;
  slideCount: number | null;  // 進度/驗收用
  result?: PptxExportResult;  // done 時
  failure?: { reason: string; message: string };
  createdAt: string;
  updatedAt: string;
  expiresAt: string;          // artifact TTL（FR-018）
}

export interface PptxExportResult {
  // artifact 存取方式由 plan Phase 決定（檔案路徑 + 下載 endpoint，建議）
  artifactRef: string;        // e.g. 檔名/key，下載時 scope 綁 accountId
  byteSize: number;
  pageCount: number;
}
```

**常數**：`PPTX_EXPORT_JOB_TIMEOUT_MS`、`PPTX_MAX_PAGES = 60`（`packages/domain/src/pptx-export-job/pptx-export-job-timeout.ts` 等，鏡射 preview-job）。

**狀態機**：`queued` →（worker 取件）`processing` →（逐頁截圖+組裝成功）`done` /（失敗/逾時）`failed`。失敗時清暫存與部分檔（FR-018）。

**對外 contract 型別**：`packages/contracts/src/pptx-export-job.ts`（建立回應、查詢回應、狀態 enum），鏡射 `preview-job.ts`。詳見 `contracts/pptx-export-job.contract.md`。

---

## §6. 型別流向總覽（單一真實來源）

```
domain (權威定義)
  ├─ SlideOutlineItem.id / TextStyleOverride / SlideTextStyleOverrides
  │     ├─ slide-merge.ts            （合併白名單 + 正規化 + 孤兒清理）
  │     ├─ rendering/text-style-override.ts  （唯一套用邏輯 → inline style）
  │     └─ rendering/template-html-renderer.ts（title/message/bullet 注入）
  ├─ PptxExportJob / status / 常數
  │
  ├─ contracts（形狀驗證 + JSON schema；不持有套用/合併邏輯）
  │     ├─ slide-generation.schema.json （outline.id / textStyleOverrides optional）
  │     └─ pptx-export-job.ts           （job 對外型別）
  │
  └─ web（匯入 domain 型別；只寫 draft，不算樣式）
        ├─ EditableSlideDraft           （惰性補 id + 寫 override + 刪條列清孤兒）
        ├─ SlideEditPanel               （欄位樣式工具列：S/M/L/XL + 4 色 swatch + reset）
        └─ live-preview-render.ts → applyDeckEdit（同 renderer，parity 自動）
```

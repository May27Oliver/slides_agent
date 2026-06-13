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
export const TEXT_SIZE_PX_MIN = 8;
export const TEXT_SIZE_PX_MAX = 240;
export const TEXT_FONT_FAMILY_MAX = 64;

export interface TextStyleOverride {
  sizePx?: number;      // 絕對 px，範圍 8–240（量於 1920×1080 簡報空間，WYSIWYG）；省略 = 沿用主題預設字級
  color?: string;       // 自由 hex "#RRGGBB"（regex /^#[0-9a-fA-F]{6}$/）；省略 = 沿用主題預設色
  fontFamily?: string;  // 內建字型目錄名稱，≤64 字、charset /^[A-Za-z0-9][A-Za-z0-9 -]*$/；省略 = 沿用主題預設字型
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
- **未設定不儲存**：`sizePx`/`color`/`fontFamily` 任一缺 = 沿用該欄位主題預設 → 不寫入該 property；三屬性皆缺時該 `TextStyleOverride` 視為空，省略 entry；`outlineById` 空物件省略；整個 `textStyleOverrides` 空則省略。（正規化函式 `normalizeTextStyleOverrides` 在 domain）
- **reset 粒度**：單一屬性 reset（清 `sizePx` / `color` / `fontFamily` 其一）、整欄 reset（移除該欄位 entry）。
- **outlineById 清理**：domain 正規化時，丟棄 key 不對應任何現存 outline `id` 的 entry（防孤兒；client 刪條列時也先清，雙保險）。
- **邊界/重驗**：`validateOverrideShape`（contracts）以 sizePx 8–240、color hex regex、fontFamily 白名單/長度（≤64）、`outlineById` ≤100 entries 驗證；domain `normalizeTextStyleOverrides` 以相同規則重驗（不信任跨層輸入）。套用邏輯只在 domain renderer（R3）。

**Schema**：`Slide` 的 `properties` 增 `textStyleOverrides`（巢狀物件，`sizePx` 為數值（8–240）、`color` 為 hex pattern、`fontFamily` 為長度受限字串），non-required，`additionalProperties:false`。

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
  revision: number;           // adopted 版本（FR-003a 後端驗證它仍是 deck 的 current revision；非 current 則失敗要求 reload，current-only）
  status: PptxExportJobStatus;
  slideCount: number | null;  // 進度/驗收用
  result?: PptxExportResult;  // done 時
  failure?: { reason: "timeout" | "export"; message: string };
  createdAt: string;
  updatedAt: string;
  expiresAt: string;          // artifact TTL（FR-018）
}

export interface PptxExportResult {
  // artifact 存取方式（已定案）：檔案（local disk / 容器 volume）+ TTL 清理；
  // 以 `${jobId}.pptx` 寫入專屬目錄，API owner-scoped 串流下載（FsPptxArtifactStore.purgeOlderThan 清理）
  artifactRef: string;        // e.g. 檔名/key（${jobId}.pptx），下載時 scope 綁 accountId
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
        ├─ SlideEditPanel               （欄位樣式面板：px 滑桿 + 自由色彩選擇器 + 字型下拉 + reset）
        └─ live-preview-render.ts → applyDeckEdit（同 renderer，parity 自動）
```

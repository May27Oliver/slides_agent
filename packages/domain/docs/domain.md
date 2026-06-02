# Domain I/O 對照手冊（`packages/domain`）

> 對象：未來維護 `packages/domain` 的人。
> 目的：不必逐行讀 code，就能 follow domain 各 node（子領域）**每個對外函式的輸入、輸出，以及每個 property 的意義**。
> 範圍：以 `src/index.ts` 對外 export 的介面為主，依資料流 `content-core → deck → design → review → rendering` 逐段補齊。
> 進度：✅ `content-core`、✅ `deck` 已整理；🚧 `design`、`rendering` 待各 node 的 input/output 定稿後補上（見第 6 節佔位）。
> 維護提醒：本檔是**人工撰寫的對照表**，型別的單一事實來源仍是 `*.types.ts`。改型別時請同步更新這份文件。

---

## 0. 先看資料流

```text
sourceContent (raw string) + DeckBrief
        │
        ▼  content-core
  ┌─────────────────────────────────────────────┐
  │ parseSourceSections      → SourceSection[]    │  把純文字切成段落
  │ segmentSourceContent     → SegmentedSource… │  (可選) LLM 語意切段 + 驗證 / fallback
  │ extractSourceFacts       → SourceFact[]       │  抽出事實 / 數字 / 決策 / 風險
  │ ChartIntentPlanner.plan  → ChartIntent[]      │  決定哪些數字值得視覺化
  │ planSemanticSlideTitles  → SemanticTitle…    │  (輔助) 產生語意化標題
  └─────────────────────────────────────────────┘
        │  SourceSection[] + SourceFact[] + ChartIntent[] + DeckBrief
        ▼  deck
  ┌─────────────────────────────────────────────┐
  │ createDeckPlanProposal   → DeckPlanProposal   │  決定有幾頁、每頁放什麼 (純 deterministic)
  │ compileDeckPlanProposal  → SlideDeck | issues │  驗證引用完整性 → 編譯成 SlideDeck
  │ planSlideDeck            → SlideDeck          │  把上面整條串起來的 orchestrator
  │ generatePreviewDeck      → { SlideDeck, summary } │ 對外預覽入口
  └─────────────────────────────────────────────┘
```

> ⚠️ **目前接線現況**：`planSlideDeck` / `generatePreviewDeck` 呼叫的是同步版 `segmentSourceContent({ sourceContent })`，**沒有傳 `llmOutput`**，因此切段一律走 deterministic fallback（`parseSourceSections`）。真正的 LLM 切段路徑 `segmentSourceContentWithRepair` 目前只被測試使用，尚未接進 deck 流程。

---

## 1. 共用 domain 型別（content-core 與 deck 都會用到）

這些定義在 `src/deck/deck.types.ts`，是兩個子領域之間的共同語言。

### `SourceSection` — 來源段落
| property | 型別 | 必填 | 意義 |
|---|---|---|---|
| `id` | `string` | ✅ | 段落穩定識別碼。fallback parser 用 heading slug；LLM 切段用 segment id |
| `heading` | `string` | ✅ | 段落標題（無標題時為 `"Untitled"`） |
| `text` | `string` | ✅ | 段落內文，多行以 `\n` 串接 |
| `segmentationSource` | `"llm" \| "deterministic_fallback"` | ⬜ | 這段是 LLM 切的還是 fallback 切的，供 review 追溯 |

### `SourceFact` — 可追溯的來源事實
| property | 型別 | 必填 | 意義 |
|---|---|---|---|
| `id` | `string` | ✅ | 事實識別碼，格式 `fact_<n>` |
| `kind` | `SourceFactKind` | ✅ | 事實種類，見下表 |
| `value` | `string` | ✅ | 事實的精煉值（例：`"18%"`、`"2026-08-15"`、`"dashboard MVP"`） |
| `sourceText` | `string` | ✅ | 抽出此事實的**原始整行文字**，用於追溯 |
| `sourceSectionId` | `string` | ⬜ | 此事實所屬段落的 `SourceSection.id` |

`SourceFactKind` = `"metric" | "date" | "decision" | "risk" | "constraint" | "claim"`
- `metric` 數字指標（百分比、小時數…）／`date` 日期／`decision` 決策／`risk` 風險／`constraint` 限制（如人力 FTE）／`claim` 其他一般陳述（預設）。

### `DeckBrief` — 使用者對簡報的需求描述
| property | 型別 | 必填 | 意義 |
|---|---|---|---|
| `purpose` | `string` | ✅ | 簡報目的，也會作為預設 deck 標題與 opening slide 的 message |
| `audience` | `string` | ✅ | 目標觀眾 |
| `styleDirection` | `string` | ⬜ | 風格方向，供後續 DesignPlanner 解讀 |
| `chartEmphasis` | `string` | ⬜ | 使用者特別想強調的圖表重點；會被納入 chart intent 的 reviewable rationale |
| `segmentationGuidance` | `string` | ⬜ | 語意切段偏好（僅偏好，不可凌駕來源事實），傳給 LLM segmenter |
| `language` | `string` | ⬜ | 輸出語言（目前型別保留，流程尚未使用） |

### `SourceContent` — 聚合後的來源（型別保留）
`{ rawText: string; sections: SourceSection[]; facts: SourceFact[] }`。目前主要由 `ContentCorePlanner`（尚未實作）使用，現行 flow 多半直接傳 `sourceContent: string`。

---

## 2. content-core 對外介面

### 2.1 `parseSourceSections(sourceContent)` — deterministic 段落切割
| | |
|---|---|
| **Input** | `sourceContent: string` |
| **Output** | `SourceSection[]`（每個 `segmentationSource` 固定為 `"deterministic_fallback"`） |

行為重點：
- 以 `行尾為「：」的行` 視為 heading（如 `決策：`）開啟新段落。
- 以 `#` 開頭的 Markdown 標題行會被**略過**（不計入段落內文）。
- `-` / `*` 開頭的 bullet marker 會被剝除。
- 第一段在遇到 heading 前的內容，heading 記為 `"Untitled"`。
- 空白段落（`text` trim 後為空）會被濾掉。
- `id` 由 heading 正規化成 slug（非字母數字轉 `-`）；空字串時 fallback 成 `section-<n>`。

### 2.2 `extractSourceFacts(sourceContent, sections?)` — 事實抽取
| | |
|---|---|
| **Input** | `sourceContent: string`；`sections?: SourceSection[]`（省略時內部自動 `parseSourceSections`） |
| **Output** | `SourceFact[]` |

行為重點（目前為 **heuristic / 種子實作**，pattern 寫死）：
- 逐行掃描，用 regex 抓：百分比 `\d+%` → `metric`；`\d+ 小時` → `metric`；`\d+ FTE` → `constraint`；`YYYY-MM-DD` → `date`。
- 段落 heading 含「決策／風險／限制」時，該段的事實 kind 會對應成 `decision` / `risk` / `constraint`，否則為 `claim`。
- 對特定字串（`dashboard MVP`、`full CRM integration`）在「決策」段落額外標記 `decision` 事實。
- 同段內 `kind:value` 相同者去重。
> 維護注意：這層目前依賴中文 heading 關鍵字與具體字面值，擴充來源格式時需同步調整 regex 與關鍵字。

### 2.3 `segmentSourceContent({ sourceContent, llmOutput? })` — 語意切段 + 驗證（同步）
| | |
|---|---|
| **Input** | `{ sourceContent: string; llmOutput?: unknown }` |
| **Output** | `SegmentedSourceContent` |

行為重點：
- 沒給 `llmOutput`（或形狀不符 schema）→ 直接回 fallback（`parseSourceSections` 結果，`validation.fallbackUsed = true`）。
- 給了 `llmOutput` → 解析成 `SemanticSegmentationOutput`，跑驗證（schema / quote grounding / order）。
- 驗證**全部通過**才採用 LLM 切段（`segmentationSource = "llm"`）；任一不過即 fallback。

`SegmentedSourceContent`：
| property | 型別 | 意義 |
|---|---|---|
| `sections` | `Array<SourceSection & { segmentationSource }>` | 切段結果 |
| `validation` | `SegmentationValidation` | 驗證結果，見下表 |

`SegmentationValidation`：
| property | 型別 | 意義 |
|---|---|---|
| `schemaValid` | `boolean` | segment 形狀是否合法（含至少一段、quote role 合法等） |
| `quoteGroundingValid` | `boolean` | 每段 `sourceQuotes` 是否能在來源 exact-match 到 |
| `sourceOrderValid` | `boolean` | quotes 出現順序是否與來源一致（以 `indexOf` 首次位置判斷） |
| `importantContentCoverageValid` | `boolean` | 目前實作 = `quoteGroundingValid && sourceOrderValid`（**尚未真正驗證重要內容涵蓋率**，命名先於實作） |
| `fallbackUsed` | `boolean` | 是否改用了 deterministic fallback |
| `issues` | `string[]` | 驗證問題訊息清單 |
| `repairAttempted?` | `boolean` | 是否嘗試過 LLM 格式修復（由 repair 流程填入） |
| `repairSucceeded?` | `boolean` | 修復後是否通過驗證 |
| `repairNotes?` | `string[]` | 修復過程的說明 |

### 2.4 `validateSemanticSegments({ sourceContent, segments })` — 純驗證
| | |
|---|---|
| **Input** | `{ sourceContent: string; segments: Array<{ id; heading; sourceQuotes: {text; role}[]; order }> }` |
| **Output** | `SegmentationValidation`（同上表，不含 repair 欄位） |

用途：只想驗證一組 segments、不需要切段結果時使用。`segmentSourceContent` 內部也是呼叫同一套驗證邏輯。

### 2.5 `segmentSourceContentWithRepair({ sourceContent, segmenter, repairer, … })` — LLM 切段 + 自動修復（async）
| | |
|---|---|
| **Input** | 見下表 |
| **Output** | `Promise<SegmentedSourceContent>` |

Input properties：
| property | 型別 | 必填 | 意義 |
|---|---|---|---|
| `sourceContent` | `string` | ✅ | 來源內容 |
| `segmenter` | `SemanticSegmenter`（port） | ✅ | 外部 LLM 切段能力，`segment(input) → Promise<unknown>` |
| `repairer` | `SemanticSegmentationRepairer`（port） | ✅ | 外部格式修復能力，`repair(input) → Promise<unknown>` |
| `purpose` | `string` | ⬜ | 傳給 segmenter（預設 `""`） |
| `audience` | `string` | ⬜ | 傳給 segmenter（預設 `""`） |
| `segmentationGuidance` | `string` | ⬜ | 傳給 segmenter 的切段偏好 |

流程（三段式 fallback）：
1. 呼叫 `segmenter.segment(...)` → 驗證。通過就回（`repairAttempted = false`）。
2. 第一次沒過（`fallbackUsed`）→ 呼叫 `repairer.repair(...)` → 再驗證。修復後通過 → 回（`repairSucceeded = true`，附 `repairNotes`）。
3. 修復仍不過、或 repair 過程 throw → 回 deterministic fallback，並把錯誤訊息收進 `issues`。

> 這是「LLM 輔助但 validation-backed」原則的核心實作：任何 LLM 失誤最終都收斂到可用的 fallback。

### 2.6 `planSemanticSlideTitles(sections)` — 語意化標題（輔助）
| | |
|---|---|
| **Input** | `SemanticTitleInputSection[]`（`{ id; heading; text }`） |
| **Output** | `SemanticTitleResult[]`（`{ sourceSectionId; title }`） |

行為：對特定主題（conversion + 回覆時間 + MVP、決策收斂、資源風險）回傳預寫好的語意標題，否則退回「內文第一行」或 heading。目前同樣是 heuristic 種子實作。

### 2.7 `ChartIntentPlanner.plan(input)` — 圖表意圖規劃
| | |
|---|---|
| **Input** | `ChartIntentInput` = `{ sourceFacts: SourceFact[]; chartEmphasis?: string }` |
| **Output** | `ChartIntentPlannerResult` = `{ intents: ChartIntent[]; fallbackNotes: string[] }` |

`ChartIntent`：
| property | 型別 | 意義 |
|---|---|---|
| `id` | `string` | 意圖識別碼（如 `conversion-before-after`） |
| `title` | `string` | 圖表標題 |
| `sourceFacts` | `SourceFact[]` | 支撐此圖表的來源事實（由 `value` 比對挑出） |
| `recommendedVisuals` | `VisualizationType[]` | 建議視覺形式 |
| `rationale` | `string` | 為何這樣視覺化的理由 |

`VisualizationType` = `"metric_card" | "comparison" | "timeline" | "milestone" | "callout" | "table" | "none"`。

行為：目前用 4 組預設候選（轉換率前後、回覆時間前後、MVP 期限、資源風險），只保留「有對應到 `sourceFacts` 值」的意圖。沒有對應事實的候選會被濾掉。

### 2.8 `ContentCorePlanner.plan(input)` — ⚠️ 尚未實作
`{ sourceContent; purpose; audience; chartIntents } → PlannedContentCore`，目前 `throw "not implemented yet"`，且未被任何 flow 使用。實作或移除前，不要把它當作 content-core 的入口。

---

## 3. deck 對外介面

### 3.1 `createDeckPlanProposal(input)` — 產生簡報計畫（deterministic）
| | |
|---|---|
| **Input** | `CreateDeckPlanProposalInput` |
| **Output** | `DeckPlanProposal` |

Input：
| property | 型別 | 意義 |
|---|---|---|
| `sourceSections` | `SourceSection[]` | 已切好的段落 |
| `sourceFacts` | `SourceFact[]` | 已抽出的事實 |
| `chartIntents` | `ChartIntent[]` | 已規劃的圖表意圖 |
| `deckBrief` | `DeckBrief` | 使用者需求 |

`DeckPlanProposal`：
| property | 型別 | 意義 |
|---|---|---|
| `title` | `string` | deck 標題（`deckBrief.purpose` → 首段 heading → 預設） |
| `subtitle?` | `string` | 副標題 |
| `slides` | `DeckSlideProposal[]` | 各頁計畫，見下表 |
| `planningNotes` | `string[]` | 規劃假設說明（會進 review 的 assumptions） |

行為重點：
- 一律含 1 張 opening slide；最多 `maxSlideCount = 8` 頁。
- 連續同 heading、或相鄰皆為短段（≤80 字）會被 merge 成同一頁。
- 偵測到「下一步／action／owner／deadline／期限／完成」等線索才加 closing slide。
- 內容頁數超過上限時，把尾段併入前一頁（`capContentGroups`）。

`DeckSlideProposal`（每頁計畫）：
| property | 型別 | 意義 |
|---|---|---|
| `id` | `string` | 頁 id（`slide_001`…） |
| `slideKind` | `"opening" \| "content" \| "closing"` | 頁的角色 |
| `title` | `string` | 頁標題 |
| `message` | `string` | 此頁核心訊息 |
| `sourceSectionIds` | `string[]` | 引用的來源段落 id |
| `sourceFactIds` | `string[]` | 引用的事實 id |
| `chartIntentIds` | `string[]` | 引用的圖表意圖 id |
| `outline` | `SlideOutlineItem[]` | 條列大綱（每頁最多 4 條） |
| `layoutIntent` | `LayoutIntent` | 版面意圖，見下表 |
| `speakerNotesDraft` | `string` | 講者備註草稿 |
| `reviewNotes` | `string[]` | 此頁的人工審查提醒 |

`SlideOutlineItem`：
| property | 型別 | 意義 |
|---|---|---|
| `text` | `string` | 條列文字（超過 90 字會截斷加 `...`） |
| `sourceTrace` | `string[]` | 此條來源追溯 id（優先指向 fact id，否則 section id） |
| `emphasis` | `SlideOutlineEmphasis` | 強調類型：`main_point` / `evidence` / `risk` / `decision` / `action` / `context` |

`LayoutIntent`：
| property | 型別 | 意義 |
|---|---|---|
| `priority` | `"message_first" \| "metrics_first" \| "comparison" \| "timeline" \| "risk_matrix" \| "table_dense"` | 版面主軸（有圖表→`metrics_first`；風險段→`risk_matrix`…） |
| `density` | `"low" \| "medium" \| "high"` | 資訊密度 |
| `emphasis` | `"narrative" \| "numbers" \| "risks" \| "decisions" \| "actions"` | 視覺強調方向 |

### 3.2 `compileDeckPlanProposal(input)` — 驗證並編譯成 SlideDeck
| | |
|---|---|
| **Input** | `CompileDeckPlanProposalInput` |
| **Output** | `CompileDeckPlanProposalResult`（成功或失敗的 discriminated union） |

Input：
| property | 型別 | 必填 | 意義 |
|---|---|---|---|
| `proposal` | `DeckPlanProposal` | ✅ | 要編譯的計畫 |
| `sourceSections` | `Array<Pick<SourceSection,"id">>` | ✅ | 合法 section id 集合（驗證引用用，只需 id） |
| `sourceFacts` | `Array<Pick<SourceFact,"id">>` | ✅ | 合法 fact id 集合 |
| `chartIntents` | `Array<Pick<ChartIntent,"id">>` | ✅ | 合法 chart intent id 集合 |
| `deckBrief` | `DeckBrief` | ✅ | 提供 purpose / audience / styleDirection |
| `reviewReport?` | `ReviewReport` | ⬜ | 省略時內部自動 build 一份 |

Output：
- 成功：`{ ok: true; slideDeck: SlideDeck }`
- 失敗：`{ ok: false; fallbackRequired: true; issues: string[] }`

驗證項目（任一不過即失敗，回 issues）：
- content slide 至少要有一個 source section。
- outline 不可為空；每條 outline 必須有 source trace。
- 所有 `sourceSectionIds` / `sourceFactIds` / `chartIntentIds` / outline `sourceTrace` 都必須指向存在的 id（否則「Unknown … reference」）。

編譯時的轉換：
- `slideKind` → `type`：opening→`title`、closing→`action`、其餘有圖表→`metrics` / 無圖表→`content`。
- `slideKind` → `layout`：`title-summary` / `action-summary` / `content-summary`。
- 產生 `contentBlocks`（目前固定一個 `bullets` block，內容取 outline 文字）。
- `sourceTrace` 會依「section → fact → chart」順序穩定排序去重。
- `SlideDeck.id` 目前固定 `"deck_local_001"`。

`Slide`（編譯後的最終頁）：
| property | 型別 | 意義 |
|---|---|---|
| `id` / `slideKind` / `title` / `message` / `outline` / `layoutIntent` / `speakerNotesDraft` | 同 proposal | 自 proposal 帶入 |
| `type` | `SlideType` | 由 `slideKind` + 是否有圖表推導 |
| `layout` | `string` | 版面字串 |
| `contentBlocks` | `ContentBlock[]` | 可渲染的內容區塊 |
| `sourceTrace` | `string[]` | 整頁彙整後的來源追溯 id |

`ContentBlock` = `{ kind: ContentBlockKind; content: Record<string, unknown>; chartIntentId? }`，`ContentBlockKind` 見 `deck.types.ts`（`paragraph` / `bullets` / `metric` / `table` / `timeline` / `callout` / `quote` / `chart_placeholder` / `fallback_text`）。

`SlideDeck`：
| property | 型別 | 意義 |
|---|---|---|
| `id` | `string` | deck id |
| `title` / `subtitle?` | `string` | 標題 / 副標 |
| `purpose` / `audience` | `string` | 來自 `deckBrief` |
| `slides` | `Slide[]` | 所有頁 |
| `reviewReport` | `ReviewReport` | 可審查報告 |

### 3.3 `planSlideDeck(input)` — 串起 content-core → deck 的 orchestrator
| | |
|---|---|
| **Input** | `SlideDeckPlannerInput` = `{ sourceContent: string; deckBrief: DeckBrief }` |
| **Output** | `SlideDeck` |

行為：依序 `segmentSourceContent` → `extractSourceFacts` → `ChartIntentPlanner.plan` → `createDeckPlanProposal` → `buildReviewReport` → `compileDeckPlanProposal`。
- deck 標題會再嘗試用來源第一個 Markdown `#` 標題覆蓋 proposal 標題。
- 若 compile 失敗，目前是 **throw `Error`**（附 issues），而非回傳 fallback。

### 3.4 `generatePreviewDeck(input)` — 對外預覽入口
| | |
|---|---|
| **Input** | `GeneratePreviewDeckInput` = `{ sourceContent: string; deckBrief: DeckBrief }` |
| **Output** | `GeneratePreviewDeckResult` = `{ slideDeck: SlideDeck; generationSummary: GenerationSummary }` |

`GenerationSummary`：
| property | 型別 | 意義 |
|---|---|---|
| `slideCount` | `number` | 產生的頁數 |
| `sourceFactCount` | `number` | 抽出的事實數 |
| `chartIntentCount` | `number` | 圖表意圖數 |
| `uncertainClaimCount` | `number` | review 中不確定 claim 數 |

> 維護注意：`generatePreviewDeck` 目前為了算 summary，自己又跑了一次 segmentation / facts / chartIntents，接著 `planSlideDeck` 內部會**再算一次**同樣三步。重構時可讓 `planSlideDeck` 一併回傳這些計數，消除重複計算。

---

## 4. 一眼看懂的對外介面總表

| 子領域 | 函式 / 類別 | Input | Output | 狀態 |
|---|---|---|---|---|
| content-core | `parseSourceSections` | `string` | `SourceSection[]` | ✅ |
| content-core | `extractSourceFacts` | `string, sections?` | `SourceFact[]` | ✅（heuristic） |
| content-core | `segmentSourceContent` | `{ sourceContent, llmOutput? }` | `SegmentedSourceContent` | ✅ |
| content-core | `validateSemanticSegments` | `{ sourceContent, segments }` | `SegmentationValidation` | ✅ |
| content-core | `segmentSourceContentWithRepair` | `{ sourceContent, segmenter, repairer, … }` | `Promise<SegmentedSourceContent>` | ✅（未接進 deck flow） |
| content-core | `planSemanticSlideTitles` | `SemanticTitleInputSection[]` | `SemanticTitleResult[]` | ✅（heuristic） |
| content-core | `ChartIntentPlanner.plan` | `ChartIntentInput` | `ChartIntentPlannerResult` | ✅（種子規則） |
| content-core | `ContentCorePlanner.plan` | `ContentCorePlannerInput` | `PlannedContentCore` | ⚠️ 未實作 |
| deck | `createDeckPlanProposal` | `CreateDeckPlanProposalInput` | `DeckPlanProposal` | ✅ |
| deck | `compileDeckPlanProposal` | `CompileDeckPlanProposalInput` | `CompileDeckPlanProposalResult` | ✅ |
| deck | `planSlideDeck` | `SlideDeckPlannerInput` | `SlideDeck` | ✅ |
| deck | `generatePreviewDeck` | `GeneratePreviewDeckInput` | `GeneratePreviewDeckResult` | ✅ |

---

## 5. 已知落差（接手前先知道）

1. **LLM 切段未接線**：deck flow 走同步 `segmentSourceContent`（無 `llmOutput`）→ 永遠 fallback。`segmentSourceContentWithRepair` 尚未被 production 使用。
2. **重複計算**：`generatePreviewDeck` 與 `planSlideDeck` 各自重跑 segmentation / facts / chartIntents。
3. **死 stub**：`ContentCorePlanner` 只被 export、未被使用。
4. **命名先於實作**：`importantContentCoverageValid` 尚未真正檢查內容涵蓋率。
5. **heuristic 種子**：`extractSourceFacts` / `ChartIntentPlanner` / `planSemanticSlideTitles` 內含中文關鍵字與寫死字面值，擴充來源格式時需一併調整。
6. **硬編 id**：`SlideDeck.id` 目前為固定字串。
7. **失敗即 throw**：`planSlideDeck` 在 compile 失敗時直接 throw，未走 constitution 期望的可審查 fallback。

---

## 6. 待補章節（design / rendering）

以下 node 的 input/output 尚未定稿，待實作完成後依照前面 content-core / deck 的格式（Input/Output 表 + property 意義表 + 行為重點）補上，並同步更新第 0 節資料流與第 4 節總表。

### 6.1 `design`（🚧 待補）

對外介面（`src/index.ts`）：
| 函式 / 類別 | 現況 |
|---|---|
| `defaultDesignSystem(styleDirection?)` | ✅ design-layer seed helper，非 root export；待 DesignPlanner 實作時決定是否保留或內聯 |
| `UiUxProMaxDesignPlanner.plan(input)` | ⚠️ stub（`throw "not implemented yet"`）；input `DesignPlanningInput`、output `DesignPlanningResult`，待實作後整理 |

補充時請涵蓋：`DesignSystem`（palette / typography / spacing / visual density / layout patterns / chart style）、`DesignPlanningInput`、`DesignPlanningResult`，並說明「design 不得新增/刪除/改寫/重排來源事實」這條邊界（見 `AGENTS.md` design 子領域）。

### 6.2 `rendering`（🚧 待補）

對外介面（`src/index.ts`）：
| 函式 / 類別 | 現況 |
|---|---|
| `LlmAssistedHtmlDeckGenerator.generate(input)` | ⚠️ stub（`throw "not implemented yet"`）；input `HtmlDeckGenerationInput`（`{ deck: SlideDeck; designPlanningResult: DesignPlanningResult }`）、output `PreviewArtifact`（`{ html; htmlGenerationValidation; generationSummary }`），待實作後整理 |

補充時請涵蓋：`PreviewArtifact`（已定義於 `deck.types.ts`）、HTML generation validation / scoped CSS / keyboard navigation / responsive / downloadable HTML 的輸出約定，並說明「HTML generation 不重新理解內容、不抽 facts、不決定 chart intent」這條邊界。

> 補完一個 node 後，請把第 0 節進度標記與第 4 節總表一併更新，讓本檔保持「整份 domain 的單一 I/O 入口」。

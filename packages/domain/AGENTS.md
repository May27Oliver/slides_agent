# Domain Package Guide

此 package 承載 HTML Slides Agent 的核心 domain logic。進入 `packages/domain` 修改前，先閱讀目前 feature plan：

- `../../specs/002-generate-previewable-html-slides/plan.md`
- `../../specs/002-generate-previewable-html-slides/spec.md`
- `../../.specify/memory/constitution.md`

## 核心原則

- `packages/domain` 不依賴 React、NestJS、browser runtime 或 LLM provider SDK。
- 所有可自動化的 domain behavior 必須 TDD：先寫 failing test，確認 red，再做最小實作。
- 每個 user-facing 行為與 agent decision flow 必須能被 Given/When/Then 或 focused test 獨立展示。
- domain code 必須保留來源內容的重要事實、數字、決策、風險與限制，不得為了設計效果新增 unsupported facts。
- 使用 `@/*` 做 package-local import，例如 `@/deck/types`。跨 package 才使用 `@slides-agent/contracts`。

## 子領域責任

### `content-core`

負責理解來源內容，但不負責美化簡報。

可包含：

- source content parsing
- LLM-assisted semantic segmentation validation
- deterministic fallback segmentation
- source section detection
- source fact extraction
- semantic slide title planning
- numeric content detection
- chart intent planning
- source trace preparation

這層是 validation-backed content core。LLM 可以輔助 source semantic segmentation，但 segmentation output 必須通過 schema、exact source quote grounding、source order 與 coverage validation；失敗時使用 deterministic fallback。後續 source facts、chart intent、source trace 與 review report 行為仍應保持 deterministic 或可驗證。它回答：「來源內容應如何按語意切段？有哪些事實、數字、決策、風險、限制？哪些內容適合被圖表化？」測試應聚焦在輸入內容、validation result、fallback behavior 與 deterministic output。

### `deck`

負責把已理解的內容組成簡報結構。

可包含：

- `SlideDeck`
- `Slide`
- `ContentBlock`
- slide ordering
- slide type selection
- deck purpose and audience mapping
- generation summary

`deck` 不重新抽取 source facts，也不決定視覺風格。它回答：「這份簡報有哪些頁？每頁承載什麼訊息與 blocks？」

### `design`

負責整份簡報的設計系統與 presentation decisions。

可包含：

- `DesignSystem`
- palette
- typography
- spacing
- visual density
- layout patterns
- chart style
- ui-ux-pro-max critique notes

`design` 可以改善 summary presentation、layout selection 與 visual consistency，但不能新增、刪除或改寫來源事實。ui-ux-pro-max 的影響必須停在設計與 critique，不得覆蓋 `content-core` 的 fact decisions。

### `review`

負責讓生成結果可審查。

可包含：

- assumptions
- omitted or compressed content
- uncertain claims
- charting decisions
- human review notes
- internal evidence references when needed

`review` 是使用者信任機制。每次生成都要讓使用者能追溯 agent 做了哪些假設、壓縮了哪些內容、哪些 claim 不確定、哪些數字被圖表化。LLM provider、model 與 design-planning skill usage 是 backend-owned flow 設定，不屬於 `ReviewReport` 的 user-facing 欄位。

### `rendering`

負責把 `SlideDeck` 轉成 self-contained HTML。

可包含：

- HTML renderer
- scoped deck CSS
- keyboard navigation script
- responsive behavior support
- downloadable HTML artifact

`rendering` 不重新理解內容，不抽 facts，不決定 chart intent。它只把已完成的 `SlideDeck`、`DesignSystem` 和 reviewable content 渲染成可預覽、可下載的 HTML。

## 依賴方向

建議 flow：

```text
source content + deck brief
        ↓
content-core
        ↓
deck
        ↓
design
        ↓
review
        ↓
rendering
```

實作時避免反向依賴：

- `content-core` 不依賴 `design` 或 `rendering`。
- `design` 不修改 `SourceFact` 或 `ChartIntent`。
- `rendering` 不呼叫 source parser、fact extractor 或 planner。
- `review` 可以引用 chart/design decisions，但不能成為隱藏的內容生成器，也不能把 backend provider/model 設定暴露成 user-facing review 欄位。

若需要新增跨子領域協作，先在 spec/plan/tasks 說清楚責任，再寫測試。

## 命名語意

- `Deck` 指一整份簡報。
- `Slide` 指單張投影片。
- `DeckBrief` 指使用者對簡報目的、觀眾、風格、圖表重點的描述。
- `SourceFact` 指可追溯到原始內容的重要事實、數字、決策、風險或限制。
- `ChartIntent` 指根據來源數字與使用者 chart emphasis 形成的視覺化意圖。
- `DesignSystem` 指整份 deck 共用的設計語言，不是單頁任意風格。
- `ReviewReport` 指可審查輸出，不是內部 debug log。

## 測試準則

- 測試應精簡，聚焦 observable domain behavior。
- 優先測 source fidelity、chart intent、semantic title、review report required fields、renderer contract。
- 不寫脆弱的 implementation-detail tests。
- 不能自動化的視覺品質檢查，要在 feature evidence 或 quickstart 留 manual verification path。

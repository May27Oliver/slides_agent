# Contracts Package Guide

此 package 定義 HTML Slides Agent 的跨層 contract。它是 frontend、API、domain use case、renderer evidence 之間的共同語言。

修改前先閱讀：

- `../../specs/002-generate-previewable-html-slides/contracts/api-contract.md`
- `../../specs/002-generate-previewable-html-slides/contracts/slide-generation.schema.json`
- `../../specs/002-generate-previewable-html-slides/spec.md`
- `../../.specify/memory/constitution.md`

## 核心責任

`packages/contracts` 只負責 contract，不負責產品行為。

可包含：

- API request/response TypeScript types
- JSON Schema files
- schema ids and contract constants
- contract validation helpers
- error response shapes
- fixtures or examples required by contract tests

不得包含：

- source content parsing
- slide planning
- chart intent decisions
- design planning
- HTML rendering
- React UI code
- NestJS controller/service behavior
- provider integration logic

如果某段 code 會「決定輸出內容」，通常應該放在 `packages/domain`，不是 contracts。

## Contract Semantics

目前主要 contract 是 `POST /api/slides/preview`。

Request 的核心語意：

- `sourceContent` 是使用者貼上的來源內容。
- `deckBrief` 是使用者對簡報目的、觀眾、風格與圖表重點的描述。
- `chartEmphasis` 是使用者偏好，不是 source truth。
- `options` 不屬於 002 public request contract；不要新增空 options type 或 legacy options 欄位。
- LLM provider、model 與 design-planning skill usage 由 backend flow 配置，不屬於 public request contract。
- Design planning/critique 是固定 flow 能力，不得改寫來源事實。

Response 的核心語意：

- `slideDeck` 是可審查的簡報 JSON。
- `previewArtifact.html` 是 self-contained HTML。
- `generationSummary` 是使用者與測試可觀察的生成摘要。
- `reviewReport` 必須存在，並包含 assumptions、omitted/compressed content、uncertain claims、charting decisions、human review notes。

## Schema Rules

- JSON Schema 是 runtime contract 的來源之一；TypeScript interface 必須與 schema 語意保持一致。
- 修改 schema 時，必須同步檢查 `src/index.ts` 的 exported contract types。
- 新增 required field 前，必須確認 spec、tasks、contract tests 與 API consumer 都接受這個破壞性變更。
- 不要把 domain-only implementation detail 放進 public contract。
- 不要把 persistence、publishing、account、file upload、PPTX export、full editor 或 revision loop 的欄位加進 002 contract。

## Testing Expectations

- contract behavior 必須先有 focused failing test，再做 validator/helper 實作。
- contract tests 應驗證 observable behavior：required fields、unsupported request fields、error shape、response shape。
- 測試應精簡，不測 implementation detail。
- schema validation evidence 要能追溯到 feature evidence。

## Import Rules

- 使用 `@/*` 做 package-local import，例如 `@/preview-request`。
- 此 package 不應依賴 `@slides-agent/domain`。Contracts 應位於依賴方向的最底層，讓 domain/API/web 可以依賴 contracts。
- 如果 contract 需要共享 domain 名詞，先在 contract types 中明確定義 stable public shape，不要直接匯入 domain internal types。

## Versioning and Compatibility

- 002 目前不做 formal API versioning，但仍要把 contract 視為跨層 public boundary。
- 破壞性變更必須更新 Spec Kit artifacts、tests、evidence。
- 新欄位若非必要，優先 optional；required field 只在 constitution/spec 明確要求時加入。
- 錯誤 response 要保持可機器判讀：`error.code`、`error.message`、必要時 `error.fields`。

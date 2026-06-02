# Research: Generate Previewable HTML Slides

## Decision: 使用 React + TypeScript frontend 與 NestJS backend

**Rationale**: 這是使用者指定的新公司技術線。此 feature 需要 local web app、input form、local API/agent boundary、preview route、download action 與後續可延伸的 publishing boundary。React + NestJS 可以在第一版就建立清楚的 frontend/backend contract，同時不引入 persistence 或 publishing。

**Alternatives considered**:

- Next.js: 不採用。此 feature 不需要 SEO/SSR 作為核心能力，且使用者明確表示 Next.js 不是好選擇。
- Vite React + simple Node API: 更簡單，但不符合公司 NestJS 技術線。
- Plain Node server-rendered HTML: scaffold 少，但 frontend preview UX、component reuse、future React skill alignment 較弱。

## Decision: 使用 monorepo with shared domain/contracts packages

**Rationale**: Deterministic content core、slide JSON schema、review report、chart intent、renderer contract 必須能在 UI 與 backend 之外被獨立測試。`packages/domain` 保存 DDD domain behavior；`packages/contracts` 保存 shared schema/API types；`apps/web` 與 `apps/api` 只負責 interaction/adapters。

**Alternatives considered**:

- Domain logic inside NestJS service only: 實作較快，但會讓 frontend、renderer、tests 都耦合 API runtime。
- Domain logic inside frontend only: 無法形成穩定 provider/API boundary，也不利後續 publishing。
- One package only: 最簡單，但容易把 domain、renderer、API、UI 混在一起。

## Decision: LLM-assisted semantic segmentation + deterministic validation/content core + ui-ux-pro-max design layer

**Rationale**: 內部報告、提案與 PM planning 的 source content 不一定有穩定 heading 或格式。只靠 regex 切段會讓段落意義、slide grouping 與 source trace 變粗或錯位。第一版改採 backend-configured LLM-assisted semantic segmentation，由 LLM 判斷語意段落、命名 section，並輸出 exact source quotes；程式端必須用 schema validation、exact quote grounding、source order 與 coverage check 驗證後才能進入 downstream content core。內容事實、chart decisions、source trace 與 review report 仍由 deterministic 或 validation-backed core 保持可測、可追溯、可審查。ui-ux-pro-max 用於 design planning、layout selection、chart treatment、visual hierarchy 與 critique，讓第一版輸出不要只有可測但缺少設計感。

**Alternatives considered**:

- Regex-only deterministic parser: 最簡單、最可測，也保留為 fallback；但無法可靠處理 markdown heading、英文冒號、inline heading、混合 bullet、無 heading 與多主題長段落。
- LLM end-to-end content planning: 生成表現可能更好，但會讓 fact extraction、charting 與 review report 變成黑箱，source fidelity 風險太高。
- Full hybrid LLM + design skill without validation: 視覺與語意可能更好，但缺少 exact quote grounding 與 schema gate，無法符合可審查要求。

## Decision: LLM segmentation output must be schema-bound and quote-grounded

**Rationale**: LLM 可以判斷語意，但不能成為 source truth。Semantic segmentation output 必須只包含可驗證結構：section heading、exact source quotes、order、confidence、rationale 與 warnings。每個 source quote 必須能在原文中 exact match；程式端根據 quote 位置重建 section source trace，而不是相信 LLM 自行產生的 offsets 或改寫文字。

**Alternatives considered**:

- Ask LLM for rewritten section body: 可讀性較好，但會產生 source rewrite 風險。
- Ask LLM for character offsets only: 結構漂亮，但 LLM offset 容易錯；應由程式端從 exact quotes 計算位置。
- Allow free-form explanation: 人類易讀，但無法作為 quality gate；應改成 strict JSON schema。

## Decision: Use one bounded format repair attempt before deterministic fallback

**Rationale**: LLM segmentation 可能已正確理解 source content，但輸出 JSON 少欄位、多欄位或格式不符合 schema。若直接 fallback，使用者可能感覺產品沒有嘗試修復可修的格式問題；若無限 retry，成本、延遲與語意漂移風險會升高。第一版只允許一次 format repair：將 validation errors 與原始 LLM output 提供給 backend-configured LLM，要求只修 JSON/schema 結構，不得重新理解、摘要、擴寫、刪除或改變來源語意。repair 後仍未通過 schema、exact quote grounding、source order 或 coverage validation 時，必須 deterministic fallback，並在 review/evidence 記錄原因。

**Alternatives considered**:

- Direct deterministic fallback on first invalid schema: 最簡單、最穩定，但會犧牲可修復格式錯誤的使用者體驗，容易讓輸出看起來過度保守。
- Unlimited or multi-step LLM retry: 可能提高成功率，但成本與延遲不可控，也增加 LLM 在修格式過程中改寫或重解釋來源內容的風險。
- Show raw schema errors to users: 對工程 debug 有用，但對使用者不可操作，且會讓 review report 混入低階 implementation detail；raw errors 應保存在 internal evidence。

## Decision: Deck planning v1 is deterministic, source-order preserving, and split into planner/compiler

**Rationale**: Deck layer 要把 validated source sections、source facts、chart intents 與 deck brief 組成可 render、可 review、可交給 design layer 的簡報結構。v1 先不導入 LLM，避免在 slide grouping、title/message、outline 或 speaker notes draft 中加入 unsupported claims。`DeckPlanner` deterministic 產生 `DeckPlanProposal`；`DeckCompiler` 驗證所有 source/chart references 後產出 final `SlideDeck`。Deck 必須以 opening 開始，content slides 維持來源順序，closing 只在來源包含 next steps/action/owner/deadline 時產生。v1 不使用 `narrativeType`、複雜 slide role、appendix 或自動把 metrics/risk/decision 移到前面，因為這些會在沒有 LLM 的前提下造成過度設計與不必要推論。這個分層讓 v1 保持可測與可審查，也保留未來讓 LLM 輔助 proposal 的擴充點，但 final `SlideDeck` 仍由 compiler 產出。

**Alternatives considered**:

- Direct deterministic `SlideDeck` builder only: 最簡單，但會把 proposal、reference validation、compilation 與 evidence 混在一起，後續若要加入 LLM proposal 會難以維持邊界。
- LLM-generated `SlideDeck`: 可能產生更自然的故事線與講稿，但 v1 會降低 schema 穩定性與 source fidelity，且 speaker notes 最容易補入來源未支持的語氣或推論。
- LLM-generated speaker notes only: 使用者體驗可能較好，但在 outline/source trace 尚未穩定前容易把推論寫成講稿；v1 先以 conservative deterministic draft 為主。
- Narrative type / complex slide role classification: 看似能提供更漂亮的故事架構，但 v1 沒有 LLM deck reasoning，使用固定分類容易誤導內容排序並增加不必要的規則。
- Always include appendix: 可能保留更多內容，但 v1 self-contained HTML deck 的目標是會議可展示；壓縮或省略的重要內容應先進 review report。

## Decision: ui-ux-pro-max is a design handoff and critique layer, not DeckPlanner

**Rationale**: 使用者期待 deck 有設計感，但 deck planning 的核心仍是來源忠實與可審查。`ui-ux-pro-max` 是 design guidance/search/checklist 能力，不是 runtime source truth 或 deck planner。因此 v1 將它放在 `DeckCompiler` 產出 valid `SlideDeck` 之後，用於 `DesignSystem`、slide pattern mapping、chart treatment、visual hierarchy、density、accessibility notes；HTML rendering 後再用於 critique/verification。它不得改變 deck order、title/message wording、outline meaning、source facts、speakerNotesDraft factual content 或 review warnings。

**Alternatives considered**:

- Put ui-ux-pro-max inside DeckPlanner: 可能讓 slide grouping/story 更有設計感，但會模糊 design advice 與 content truth 的邊界，也讓測試難以判斷是 deck rule 還是 design rule 在改變內容。
- Skip ui-ux-pro-max until renderer: 較簡單，但會讓 v1 視覺規劃不足，可能產生可測但不夠好用的 deck。
- Let design layer polish title/message wording: 未來可另開 spec，但 v1 先避免 wording polish 改變來源語意或造成不易測的內容差異。

## Decision: Session-only preview

**Rationale**: 第一個 implementation slice 只需要讓使用者在 local web app 看到 preview、review report、slide JSON、generation summary，並下載 self-contained HTML。不做 persistence、deck history、automatic artifact storage 可以讓 scope 保持小而清楚。

**Alternatives considered**:

- Local artifact folder: evidence 較方便，但會提早引入 artifact lifecycle 與清理策略。
- Browser localStorage: 可保留生成結果，但可能讓使用者誤以為有正式 deck persistence。
- Minimal deck store: 對第一個 slice 太重，接近下一階段 publishing/storage。

## Decision: Layered chart intent decision

**Rationale**: Charting 不應只依賴使用者自由文字。Content core 先偵測 source content 是否有數字描述與可視覺化邏輯，再結合 free-text chart emphasis 產生 `ChartIntent`。資料不足時產生 no-chart rationale，避免捏造缺失資料。

**Alternatives considered**:

- Free-text only: 人類好輸入，但可能漏掉來源中明顯可視覺化的數字。
- Structured chart fields only: 可測性高，但第一版使用摩擦大。
- Auto-detect only: 使用者無法指定想強調的圖表重點。

## Decision: Self-contained HTML renderer without runtime backend dependency

**Rationale**: Web-first artifact 必須能下載後直接用 browser 開啟。Renderer 產出的 HTML 需要包含必要 CSS、navigation script 與 slide data，不依賴 local backend。

**Alternatives considered**:

- Preview route only: 實作較簡單，但不能驗證 self-contained deliverable。
- External slide framework dependency: 開發快，但 first slice 應控制 runtime dependencies，避免交付物依賴外部 CDN 或 framework bootstrapping。

## Decision: Focused TDD with browser/manual evidence

**Rationale**: Domain rules、schema contracts、renderer output 可自動化測試；visual consistency、layout overlap、design quality 需要 manual verification。Playwright 類 browser checks 用於 keyboard navigation、preview route、basic responsive smoke test，不做脆弱的 pixel-perfect assertions。

**Alternatives considered**:

- Unit tests only: 無法驗證 browser preview 與 keyboard navigation。
- Full screenshot regression: 第一版過重且容易 brittle。
- Manual only: 不符合 TDD 與 regression needs。

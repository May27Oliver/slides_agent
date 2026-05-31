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

## Decision: Deterministic content core + ui-ux-pro-max design layer

**Rationale**: 內容事實、chart decisions、source trace 與 review report 必須可測、可追溯、可審查。ui-ux-pro-max 用於 summary presentation、design planning、layout selection、visual hierarchy 與 critique，讓第一版輸出不要只有可測但缺少設計感。

**Alternatives considered**:

- Deterministic only: 最可測，但使用者第一次看到成果可能缺少吸引力。
- Real LLM first: 生成表現可能更好，但測試、隱私、provider failure 與 source fidelity 風險太早進入第一個 slice。
- Full hybrid LLM + design skill: 過早引入 provider complexity，違反 KISS。

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


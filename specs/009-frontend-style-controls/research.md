# Phase 0 Research：Frontend Style Controls

多數決策已於 spec 三輪 clarify 鎖定，本檔彙整「決策 → 理由 → 被拒替代」供 /tasks 與審查追溯。

## 決策彙整

| # | 決策 | 理由 | 被拒替代 |
|---|---|---|---|
| D1 | 主題互動 = 升級引導式提示，**不 override** | 保留 007 `selectTheme` 確定性；後端動最小 | 硬指定 `themeId`（需 override 路徑 + GET /themes，違反最小後端取向） |
| D2 | 圖表 = 只改進 preset + 預覽結果，不加控制維度 | 成圖與否本即由資料可圖性決定（008） | 新增圖表類型偏好欄位（增控制維度、易與 fallback 語意衝突） |
| D3 | US2 source of truth = **補強 readonly response metadata** | 屬「已發生結果」證據、不影響決策；避免脆弱 HTML/CSS parse | 前端 parse `previewArtifact.html` data attr / CSS 變數 |
| D4 | `selectedTheme` 由 flat **取代**為 nested（三軸入 `ids`），不留 alias | 單形狀、避免雙形狀分歧；readonly 證據無外部公開消費者 | 保留 flat + 平行加欄位（雙形狀，contracts/web 易分歧） |
| D5 | `renderedCharts.visualKind` **reuse 008 `ChartVisualKind` enum** | 單一詞彙來源；UI label 另行 i18n | contract 直接寫顯示文案（enum 與文案耦合） |
| D6 | chart review note 用結構化 `{code,message}` | 沿用 008 既有 note `code`，前端可做 i18n/圖示/fallback 認明 | flat `string[]`（難依類型處理） |
| D7 | `structureFeatures` 用結構化旗標/值（非 `string[]`） | 入 contract 且影響 reduced-motion 判斷，需穩定形狀 | 標籤清單 `string[]`（適合顯示、不適合契約） |
| D8 | 風格選擇 = radio card gallery | US1 重點是「看得懂在引導什麼」；僅 6 preset 空間可控 | radio 加 inline 小預覽 / 下拉+預覽（達成度較低） |
| D9 | reduced-motion 兩階段 gate | 生成前尚無 `selectedTheme` | 單一 gate（生成前無資料來源） |
| D10 | 風格預覽資料 = 前端 curated metadata | 零新端點、後端動最少 | 讀 007 DB 主題目錄全量（需端點，延後） |
| D11 | 新 UI 以 `ui-ux-pro-max` skill 設計 | 與 deck 同源素材、提升控制台質感 | 自由手刻（易生成 generic AI UI） |
| D12 | **單一來源 render**：`renderTemplateDeck` 回傳 `{html, renderedCharts}`；`collectChartReviewNotes` 降為純投影 | 現況圖表 render **兩次**（`collectChartReviewNotes` + `renderChartFragments` 各 call 一次 `renderChartIntent`，參數還不一致）＝既有 drift。單一 render 讓 html／renderedCharts／review notes 同源、零 drift；**有意識接受 CRITICAL blast radius**（見下方 impact） | **加法 collector**（新增第三次走訪）——blast radius 小但**擴大** drift surface，違反「no legacy/shim/drift」 |

### D12 的 impact 與接受理由（CLAUDE.md 風險揭露）

`gitnexus_impact`（upstream）結果：

- `renderTemplateDeck` → **CRITICAL**，d=1 直接呼叫者 3：`renderTemplateDeckArtifact`（預期更新）、dev script `preview-chart-matrix.ts`、dev script `preview-themes.ts`。
- `renderChartIntent` → CRITICAL，但**本案不改其簽章**（已回傳 `RenderedChart`，只多讀欄位）→ 風險不觸發。
- `buildGenerationSummary` → HIGH，d=1 僅 `renderTemplateDeckArtifact`（加必填 `renderedCharts` 參數）。
- `collectChartReviewNotes` → 簽章變更，caller 僅 `slides.service.generatePreview` + 其 test（`chart-renderer.review-notes.test.ts`、`slides-service.*`）。

**接受理由**：call site 有限且全在本 repo 內（無外部公開消費者）；每處皆**乾淨遷移**（更新 call site，無 wrapper/alias/legacy）；換得消滅既有雙重 render 與 drift。被拒替代（第三次 render 的加法 collector）雖 blast radius 小，但製造新 drift surface，與目標相悖。

## 已驗證的 codebase 事實（投影/收集可行性）

- `DesignStyleKit`（`packages/domain/src/design/design-style-kit.types.ts`）含 `effects{cardRadiusPx,cardShadow,cardBackdropBlurPx?,glow?}`、`background{textureOverlay?,gradientAnimation?}`、`accentHues:{name,base,gradient}[]`、`fonts{heading,body,googleFontsHref?}`、`kitName`、`motion`、`typeScale` → `structureFeatures`/色票/字體可**直接純函式投影**。
- `selectTheme()` 已產 `{ styleKit, ids, fallback }`（`select-theme.ts`）；`slides.service.ts:166` 目前只取 `{...ids, fallback}` 丟棄 token → 補強即「投影 styleKit」，無新決策。
- `visualDensity` 來自 design planner 的 `designSystem.visualDensity`（非 styleKit）→ 投影需同時接收 visualDensity。
- `ChartVisualKind`（`chart-rendering.types.ts`）= `pie_donut|line|bar|metric_card|metric_group|table|fallback_text`；`renderChartIntent()`（`chart-renderer.ts`）渲染時已決定 `visualKind` 並有結構化 review note（`{code,message,chartIntentId,sourceFactIds}`，code 如 `fallback_used`/`table_truncated`/`series_extracted`）→ 回傳結構化結果即可，無新決策。
- per-slide 收集點：`template-html-renderer.ts:101/240`（`slideChartIntents` + `renderChartFragments`）；slide section 已有 `data-slide-id`（但前端**不** parse，改由 renderer 直接附 `slideId`）。
- summary 組裝：`buildGenerationSummary(deck, selectedTheme)`（`generation-summary.ts`）為單一組裝點。
- contracts：`GenerationSummaryContract`（`index.ts:91`）+ `GENERATION_SUMMARY_SCHEMA`（`openapi.ts:86`）需同步。

## 未決 / 延後（明確 out of scope）

- 讀 DB 全量主題目錄、主題瀏覽器、硬指定主題（override）。
- 使用者可選圖表類型偏好。
- deck 渲染輸出本身的視覺調整（屬其他 feature）。

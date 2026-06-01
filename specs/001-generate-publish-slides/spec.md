# Feature Specification: Generate and Publish HTML Slides

**Feature Branch**: `001-generate-publish-slides`

**Created**: 2026-05-30

**Status**: Draft

**Input**: User description: "使用者輸入要做成 slides 的內容，描述想要的風格與哪些重點要特別做成圖表，由 agent 消化後做成 slides，接著部署到一個網域，讓使用者可以 presentation everywhere。slides 製作可以使用 ui-ux-pro-max skills。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate Reviewable Slide Deck (Priority: P1)

使用者貼上要製作成 slides 的內容，填寫簡報目的、受眾、風格描述與希望圖表化的重點後，系統產生一份 structured slide deck、review report，以及可預覽的 HTML slides。

**Why this priority**: 這是整個產品的核心價值。若不能從內容產生可審查且可展示的 HTML slides，後續發布、分享與 revision 都沒有意義。

**Independent Test**: 使用一份包含段落、數字、決策與風險的內部 planning 內容，提交簡報目的、受眾、風格與圖表化要求；驗證輸出包含 slide JSON、review report 與可開啟的 HTML deck。

**Acceptance Scenarios**:

1. **Given** 使用者提供 source content、deck purpose、audience、style direction 與 chart emphasis，**When** 使用者要求生成，**Then** 系統產生包含至少一張 title slide 與多張 content slides 的 slide JSON。
2. **Given** source content 包含重要數字、日期、決策與風險，**When** 系統產生 deck，**Then** slide JSON 與 review report 保留並標示這些來源重點。
3. **Given** 使用者要求特定段落或數字圖表化，**When** 該數字足以形成比較、趨勢、比例、排名、進度或分布，**Then** 系統將其轉成 chart、metric card、table 或其他合適 visual structure。
4. **Given** 使用者要求圖表化但來源資料不足，**When** 系統產生 deck，**Then** 系統不得捏造資料，並在 review report 中說明無法圖表化或改以文字/表格呈現。

---

### User Story 2 - Apply Coherent Design Direction (Priority: P2)

使用者描述想要的簡報風格後，系統將風格轉換成 deck-level design system，並使用 ui-ux-pro-max skill 輔助規劃與 critique，讓 slides 視覺一致且適合 presentation。

**Why this priority**: 產出若只是文字切頁，無法達成本產品要加速理解與提升會議同步的目標。設計系統讓生成結果更接近可直接使用的工作簡報。

**Independent Test**: 使用同一份 source content，輸入一個明確風格描述，例如「高密度 PM planning deck，清楚呈現風險、里程碑與 KPI」，驗證輸出 design system 與每張 slide 的 layout 選擇一致且符合該風格。

**Acceptance Scenarios**:

1. **Given** 使用者提供 style direction，**When** 系統產生 deck，**Then** 輸出包含 palette、typography、spacing、visual density、layout grid 與 reusable slide patterns。
2. **Given** 系統使用 ui-ux-pro-max 輔助設計，**When** skill 提供 layout 或 visual hierarchy 建議，**Then** 建議只能改變表達方式與視覺結構，不得新增 source content 未支持的事實或主張。
3. **Given** deck 有多張 slides，**When** 使用者 preview，**Then** slides 的視覺語言、元件樣式與資訊密度保持一致。

---

### User Story 3 - Publish Deck to Shareable URL (Priority: P3)

使用者確認 preview 後，可以將 HTML slides 發布到一個可分享 URL，讓其他人能在不同裝置上開啟並進行 presentation。

**Why this priority**: "presentation everywhere" 是 web-native slides 的重要價值，讓簡報不再依賴傳統 PPT 檔案傳遞。

**Independent Test**: 使用已生成的 HTML deck，執行 publish，驗證系統回傳一個 URL；在瀏覽器開啟該 URL 後可以展示 slides 並使用 keyboard navigation。

**Acceptance Scenarios**:

1. **Given** 使用者已生成並 preview deck，**When** 使用者發布 deck，**Then** 系統產生一個可分享 URL。
2. **Given** 使用者開啟已發布 URL，**When** deck 載入，**Then** deck 可以在 browser 中 presentation，並支援下一頁/上一頁 keyboard navigation。
3. **Given** published deck 在常見 laptop 或 projector 尺寸開啟，**When** 使用者展示，**Then** deck 保持 16:9 slide format 且內容不應互相重疊。

### Edge Cases

- Source content 很短，無法支撐使用者要求的 slide count 或 chart emphasis。
- Source content 很長，超過單次生成可合理處理的內容量。
- 使用者指定的 chart emphasis 找不到對應數字或上下文。
- 數字沒有單位、期間、分母或比較基準，無法安全圖表化。
- 使用者風格描述與內容目的衝突，例如要求高密度 board report 但內容只有簡短公告。
- Source content 包含中英混合內容。
- 使用者嘗試在 request 中指定 backend-owned provider/model 或 generation option。
- Publish 時 URL slug 衝突或 artifact 儲存失敗。
- Preview HTML 可生成，但 keyboard navigation 或 responsive behavior 失效。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept source content, deck purpose, audience, style direction, and chart emphasis as the primary generation input.
- **FR-002**: System MUST generate a structured slide JSON artifact before rendering HTML.
- **FR-003**: System MUST generate a review report for every deck generation.
- **FR-004**: System MUST generate self-contained HTML slides from the slide JSON and design system.
- **FR-005**: System MUST support previewing the generated HTML deck before publishing.
- **FR-006**: System MUST allow a previewed deck to be published to a shareable URL.
- **FR-007**: System MUST support keyboard navigation for published and previewed decks.
- **FR-008**: System MUST preserve a 16:9 presentation format for generated slides.
- **FR-009**: System MUST produce semantic slide titles that summarize slide or paragraph meaning rather than blindly copying source headings.
- **FR-010**: System MUST identify source facts that need fidelity protection, including numbers, dates, named entities, decisions, risks, constraints, owners, deadlines, and stated tradeoffs.
- **FR-011**: System MUST convert numeric content into charts, metric cards, tables, or other visual structures when the source data is sufficient and the conversion improves comprehension.
- **FR-012**: System MUST preserve original numbers, units, periods, denominators, and context when converting numeric content into visual structures.
- **FR-013**: System MUST NOT invent missing data for charts or strengthen unsupported claims.
- **FR-014**: System MUST use a deck-level design system for each generated deck.
- **FR-015**: System MUST use ui-ux-pro-max during design planning and critique.
- **FR-016**: ui-ux-pro-max usage MUST be limited to visual hierarchy, layout selection, visual density, chart treatment, and design consistency; it MUST NOT alter source meaning or invent facts.
- **FR-017**: System MUST keep LLM provider and model selection backend-configured and outside user-facing request/response contracts.
- **FR-018**: System MUST reject request-level generation options that try to override backend-owned provider/model or design-skill usage.
- **FR-019**: System MUST allow generation behavior to be verified through concise tests or executable verification tasks that correspond to this spec.
- **FR-020**: System MUST model core generation rules with clear domain concepts rather than embedding them only in UI, provider adapters, or rendering code.

### HTML Slides Agent Constitution Requirements *(mandatory for slide-generation features)*

- **CR-001 Source Fidelity**: This feature preserves source facts through slide JSON fields, source trace references, and review report notes for important facts.
- **CR-002 Review Report**: The generated review report includes assumptions, omitted or compressed content, uncertain claims, charting decisions, and human review notes.
- **CR-003 Web-First Output**: The primary deliverable is a self-contained HTML slide deck and a shareable URL for presentation.
- **CR-004 Backend-Configured LLM Boundary**: Source content may be processed by backend-configured LLM providers, and provider/model details must remain outside user request/response contracts unless a future spec changes the boundary.
- **CR-005 Design System**: Each deck has a design system covering palette, typography, spacing, visual density, layout grid, reusable slide patterns, and chart style.
- **CR-006 Semantic Titles**: Slide titles summarize the core meaning of the slide and must remain grounded in source content.
- **CR-007 Data Visualization**: Numeric content becomes chart, metric card, table, or text depending on source data completeness and comprehension value.
- **CR-008 TDD Coverage**: Tests or executable verification tasks cover generation input validation, slide JSON structure, source fidelity, charting decisions, review report output, HTML rendering, keyboard navigation, responsive behavior, and publishing.
- **CR-009 Domain Model**: Core concepts include `SourceContent`, `DeckBrief`, `SlideDeck`, `Slide`, `ContentBlock`, `ChartIntent`, `DesignSystem`, `ReviewReport`, and `PublishedDeck`.
- **CR-010 Lean Test Scope**: Tests focus on observable behavior, domain rules, and contracts; they should avoid redundant cases and implementation-detail assertions.
- **CR-011 Verification**: Acceptance scenarios include slide JSON schema validity, HTML rendering, keyboard navigation, basic responsive behavior, and URL publishing.

### Key Entities *(include if feature involves data)*

- **SourceContent**: The raw content provided by the user, including text, headings, bullets, dates, numbers, and contextual notes.
- **DeckBrief**: The user's purpose, audience, style direction, chart emphasis, must-include points, language, and tone preferences.
- **SlideDeck**: The structured representation of the generated deck, including metadata, design system, slides, and review report reference.
- **Slide**: One presentation unit with title, message, layout, content blocks, speaker notes candidate, and source trace.
- **ContentBlock**: A typed block within a slide, such as paragraph, bullets, metric, table, timeline, callout, quote, or chart placeholder.
- **ChartIntent**: A decision to visualize numeric content, including chart rationale, source numbers, units, period, denominator, and fallback if data is insufficient.
- **DesignSystem**: The deck-level visual system, including palette, typography, spacing, visual density, layout grid, component patterns, and chart styling.
- **ReviewReport**: The audit artifact listing assumptions, omitted or compressed content, uncertain claims, charting decisions, and human review notes.
- **PublishedDeck**: The published artifact metadata, including URL, slug, publication status, generated HTML artifact reference, and timestamps.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can generate a previewable HTML slide deck from pasted source content, purpose, audience, style direction, and chart emphasis in one end-to-end flow.
- **SC-002**: For test inputs containing at least five important source facts, the generated slide JSON or review report preserves all five without unsupported alteration.
- **SC-003**: For test inputs containing sufficient numeric data for a comparison, trend, ratio, ranking, progress, or distribution, the system produces a chart, metric card, table, or documented no-chart rationale.
- **SC-004**: Every generated deck includes a review report with assumptions, omitted or compressed content, uncertain claims, charting decisions, and review notes.
- **SC-005**: Generated and published decks can be navigated with keyboard next/previous controls in a browser.
- **SC-006**: Published deck URLs open successfully in a browser and display the generated deck without requiring a local backend.
- **SC-007**: Verification tasks cover slide JSON schema validity, HTML rendering, keyboard navigation, basic responsive behavior, publishing, and review report output.

## Assumptions

- The first milestone uses pasted text input only; file upload is out of scope.
- The first milestone publishes to a generated shareable URL; advanced access control is out of scope.
- Published decks may be unlisted in the first milestone unless a later spec requires authentication or password protection.
- Preview revision can be handled by regenerating the deck; full per-slide drag-and-drop editing is out of scope.
- The first milestone prioritizes practical internal slides over highly polished external brand decks.
- LLM provider/model are backend-owned runtime configuration; user-facing selection is out of scope.
- The output language follows the input language unless the user specifies otherwise.

## Review and Safety Notes *(mandatory for generated-content features)*

- **Assumptions to Surface**: The review report must disclose inferred audience needs, inferred deck purpose, design assumptions, charting assumptions, and any fallback behavior used.
- **Omitted or Compressed Content Policy**: The review report must list material content that was omitted or significantly compressed, especially decisions, risks, deadlines, metrics, and constraints.
- **Uncertain Claims Policy**: Unsupported or ambiguous claims must be marked as uncertain and must not be presented as verified facts.
- **Sensitive Content Handling**: Source content may be sent to backend-configured LLM providers. Provider/model selection is not user-facing, but internal evidence must make the sensitive-content boundary reviewable before implementation.

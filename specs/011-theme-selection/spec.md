# Feature Specification: 主題庫手動選擇（讓使用者瀏覽並挑選完整主題庫，生成頁與編輯頁皆可，確定性、零額外 LLM）

<!-- This project writes Spec Kit artifacts in Traditional Chinese by default. -->
<!-- STATUS: 大概草稿（draft outline）。細節（data-model / contracts / tasks）待正式展開。 -->

**Feature Branch**: `011-theme-selection`

**Created**: 2026-06-09

**Status**: Draft（outline）

**Input**: User description：「DB 裡的風格有 220 個（font 57 / palette 96 / style 67），但現在只有 6 張前端預設卡 + 關鍵字自動選，導致絕大多數主題永遠選不到（死庫存）。需要一個 panel 讓使用者完整看到並挑選這些主題；而且**生成頁也要放**，不然浪費『第一次就做對』的機會、也浪費重新生成的 token。」

---

## 背景與目標

007/009 已建立完整主題系統：`themes` 表三軸——**font（57）/ palette（96）/ style（67），共 220 列**——由 `selectTheme`（純函式、確定性）依 brief 關鍵字（`styleDirection` 強、`purpose`+`audience` 弱）對每軸各挑一個，`composeKit` 合成 styleKit。主題在 pipeline 的**最後 render 階段才套用**（`themedDesignPlanningResult.styleKit`），**在所有 LLM 步驟之後**。

**問題（本 feature 的動機）**：

1. **死庫存**：`selectTheme` 是「最高分；沒比中或平手就回穩定排序的第一個」。沒有任何 brief 關鍵字命中的主題**永遠選不到**，沒有輪替/多樣性機制。實務上 220 個只有一小撮會被選中，其餘是浪費的素材。
2. **沒有第一次做對的機會**：生成頁只有 6 張關鍵字捷徑卡 + 自訂關鍵字，使用者**無法直接指定**要哪個主題；第一次輸出常常不是想要的。
3. **浪費 token**：主題與 LLM 成本無關（render 後段才套），但使用者若不滿意自動主題、又不知道編輯頁可換，往往**重新生成**（重跑整條 LLM）→ 無謂的 token 浪費。

**目標**：讓使用者**瀏覽完整 220 主題庫並手動挑選**，在**生成頁**（第一次就做對、零額外 token）與**編輯頁**（WYSIWYG 改主意、確定性重渲染）皆可。手動選擇走**「依 id 套用」**路徑，繞過關鍵字猜測；**沒手動選時維持現有關鍵字 `selectTheme` 行為**（不破壞既有體驗）。

**設計原則（沿用憲章）**：主題挑選與套用**完全不呼叫 LLM**（CR-004）；沿用 `composeKit` 維持設計一致性（CR-005）；零額外 token。挑選器與套用為**純確定性**。

---

## 已鎖定的範圍決策（2026-06-09 討論）

1. **入口 = 生成頁 + 編輯頁兩處共用**同一個主題挑選器。生成頁可在生成前指定（第一次做對、零 token）；編輯頁可對既有 deck 換主題（確定性重渲染、即時預覽）。
2. **選擇粒度 = 每軸各選一個**（font + palette + style），這才真正解鎖 220 的組合力（理論 ≈ 36 萬組）。可提供「整組快速套用」作為捷徑，但底層是三軸獨立。
3. **預覽 = 輕量 swatch**（色票 + 字體樣本 + 風格縮影），**不對 220 個做 live 全 deck 渲染**（成本不可行）。完整 WYSIWYG 只發生在「選定後」（生成頁 = 生成結果；編輯頁 = 既有 LivePreview）。
4. **套用機制 = 依 id 套用**：抓使用者選的 3 個 styleKit → `composeKit` → 取代 `selectTheme` 輸出。**未手動選 → 退回現有關鍵字 `selectTheme`**（向後相容）。
5. **持久化 = 沿用既有 `selectedTheme` 三軸 id**（revision 的 generationSummary 已存），不需新資料結構即可記錄「這份用了哪個主題」。
6. **不做**：編輯主題庫本身（新增/改/刪 themes）、使用者自訂主題、AI 推薦主題。本 feature 只做「**選**既有的」。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 生成前指定主題（第一次就做對，零額外 token）(Priority: P1)

使用者在**生成頁**開啟主題挑選器，瀏覽/搜尋/篩選完整主題庫（依 font / palette / style 三軸），各軸選定後送出生成。系統在 render 階段**依所選 id 套用主題**（而非關鍵字猜測），第一次輸出即為使用者選的主題。若使用者未開挑選器/未選，維持現有關鍵字 `selectTheme` 行為。

**Why this priority**：直接解決「第一次做對 + 省 token + 讓 220 用得到」三個核心動機；且因主題在 LLM 之後套用，**零額外 token**。

**Independent Test**：生成頁選定特定 font+palette+style → 生成 → 結果的 `selectedTheme` 三軸 id 等於所選；未選時 → 維持關鍵字選擇結果；過程 LLM 呼叫數與未選時相同（主題不影響 token）。

**Acceptance Scenarios**：
1. **Given** 使用者在生成頁開啟主題挑選器，**When** 各軸選定並生成，**Then** 輸出主題 = 所選三軸，且摘要顯示該 kitName/ids。
2. **Given** 使用者未開挑選器，**When** 生成，**Then** 維持現有關鍵字 `selectTheme`（行為不變）。
3. **Given** 只選了部分軸（如只選 palette），**When** 生成，**Then** 已選軸用所選、未選軸退回關鍵字/預設（明確、不報錯）。

### User Story 2 - 編輯頁換主題（WYSIWYG、確定性重渲染）(Priority: P2)

使用者在**編輯頁**開啟同一挑選器，對既有 deck 換主題；右側即時預覽反映新主題，按儲存產生**新 edit revision**（沿用 010 的確定性重渲染，不跑 LLM，不改文字內容）。

**Why this priority**：補足「改主意」與「既有 deck 救援」；與 010 編輯頁的確定性模型天然契合。次於 US1，因為生成頁才是「第一次做對」的主場。

**Acceptance Scenarios**：
1. **Given** 編輯頁某 deck，**When** 換主題並即時預覽，**Then** 預覽以新 styleKit 重渲染、文字內容不變。
2. **Given** 按儲存，**When** 寫入，**Then** 新 revision 的 `designPlan`/`selectedTheme` 反映新主題、舊版保留、**零 LLM**。

### User Story 3 - 瀏覽完整主題庫（搜尋 / 篩選 / 輕量預覽）(Priority: P3)

挑選器提供：依軸分頁（font / palette / style）、關鍵字/名稱搜尋、輕量 swatch 預覽（色票、字體樣本、風格縮影）。220 個以分頁/虛擬列表呈現,不卡頓。

**Acceptance Scenarios**：
1. **Given** 開啟挑選器，**When** 切到 palette 軸，**Then** 看到全部可選 palette 的 swatch、可搜尋過濾。
2. **Given** 大量項目（96 palette），**When** 捲動/搜尋，**Then** 順暢（輕量 swatch、非 live 全渲染）。

---

## Requirements *(mandatory, outline)*

- **FR-001**：系統 MUST 提供一個**可重用的主題挑選器**元件，於**生成頁與編輯頁共用**；支援依 font / palette / style 三軸瀏覽、搜尋、篩選。
- **FR-002**：挑選器 MUST 以**輕量 swatch**（色票 + 字體樣本 + 風格縮影）呈現，**MUST NOT** 對主題庫做 220 份 live 全 deck 渲染。
- **FR-003**：使用者 MUST 能**每軸各選一個**（font / palette / style）；MAY 提供「整組快速套用」捷徑（底層仍為三軸 id）。
- **FR-004（生成頁，US1）**：生成請求 MUST 能攜帶使用者選的三軸主題 id；後端 render 階段 MUST **依 id 套用**（抓 styleKit → `composeKit`），**未提供 id 的軸退回現有關鍵字 `selectTheme`/預設**。指定主題 **MUST NOT** 增加 LLM 呼叫或 token。
- **FR-005（編輯頁，US2）**：編輯頁 MUST 能換主題並以**確定性重渲染**（沿用 010）即時預覽；儲存 MUST 產生新 `origin="edit"` revision，反映新 styleKit/`selectedTheme`，**不跑 LLM、不改文字**。
- **FR-006**：後端 MUST 新增**列主題的能力**（依軸列出可選主題，供挑選器；目前僅有 `listSelectable` 供選擇用）。讀取 MUST 維持既有 active/support 過濾。
- **FR-007**：選定結果 MUST 持久化於 revision（沿用既有 `selectedTheme` 三軸 id），使「這份用了哪個主題」可追溯、可在編輯頁回填挑選器目前選擇。
- **FR-008**：未手動選主題時，系統行為 **MUST** 與現況一致（關鍵字 `selectTheme`），不得退化既有生成體驗。
- **FR-009**：所有新 UI MUST 符合既有 a11y（鍵盤、focus、三語 i18n、RWD、reduced-motion）。
- **FR-010**：主題挑選與套用 **MUST NOT** 呼叫 LLM、**MUST NOT** 引入任何 LLM provider/model 欄位。

### 與現有「6 張預設卡」的關係（已鎖定 2026-06-09）

**保留 6 張快速卡 + 新增「瀏覽全部」入口開主題瀏覽器。** 6 張卡維持寫
`styleDirection` 關鍵字（走 baseline），瀏覽器走每軸 id 覆寫（`manualThemeSelection`）；
兩者並存、不衝突。挑選粒度鎖定為**每軸各選**（`manualThemeSelection = { fontId?, paletteId?, styleId? }`，
不引入「完整主題卡」資料模型）——見 data-model §1/§2。

---

## Constitution Requirements（重點，待正式對齊）

- **Backend-Configured LLM Boundary（CR-004）**：本 feature **完全不呼叫 LLM**；主題在 render 後段確定性套用。
- **Coherent Deck Design System（CR-005）**：沿用 `composeKit` 三軸合成,維持設計一致性。
- **Code Quality**：挑選器為共用元件（生成頁/編輯頁不重複）；後端「依 id 套用」與現有關鍵字 `selectTheme` 分離但收斂於同一 render 套用點。

---

## Edge Cases

- 使用者選的主題 id 已停用/不存在（active=false 或被刪）→ 該軸退回關鍵字/預設 + 明確提示，不報錯。
- 只選部分軸 → 未選軸退回關鍵字/預設（US1 #3）。
- 編輯頁換主題後與 010 的「圖表 chartIntents 重渲染」「parity」並存 → 換主題只改 styleKit，chartIntents/文字不變。
- 主題庫很大（palette 96）→ 挑選器需分頁/虛擬列表 + 搜尋，不可一次 live 全渲染。
- 既有（pre-011）deck 在編輯頁開挑選器 → 以其 `selectedTheme` 三軸 id 回填目前選擇（無則顯示「預設/未知」）。

---

## 明確不在本 feature（Out of scope）

- 編輯主題庫本身（新增/修改/刪除 themes、自訂主題）。
- AI 推薦/生成主題。
- 改變 `selectTheme` 的關鍵字演算法本身（多樣性/輪替）——本 feature 用「手動選」繞過，不重寫自動選。
- 同一 deck 的 revision 版本瀏覽（沿用 010 範圍決策）。

---

## 待正式展開時要產出

- `plan.md`（technical context：themes 表讀取、依 id 套用路徑、生成頁 request 帶 theme ids、編輯頁重渲染串接）
- `data-model.md`（list-themes 回應形狀、request 的 theme ids 欄位、swatch 所需欄位）
- `contracts/`（list themes endpoint、generate request + theme ids、edit revision + theme ids）
- `research.md`（量化「死庫存」：跑 selectTheme 統計 220 裡實際幾個選得到，當動機數據）
- `quickstart.md` / `tasks.md`

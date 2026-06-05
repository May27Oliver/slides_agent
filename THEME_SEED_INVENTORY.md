# Design Theme Seed Inventory (ui-ux-pro-max → DB)

> 盤點日期:2026-06-05
> 狀態:**規劃中**。此為 feature 007「design theme system」的交接文件。
> 006(DB + ORM + auth 串 DB + deck 持久化)只**預留** `themes` 表結構,
> 實際 theme seed 內容留待 007。

---

## 1. 背景:有兩個「ui-ux-pro-max」

| | 是什麼 | 與 app runtime 的關係 |
|---|---|---|
| `.claude/skills/ui-ux-pro-max/`(Python + CSV) | Claude Code 的 skill / 設計知識庫 | **不在 app 內**,生成簡報時不會被呼叫 |
| `packages/domain/src/design/` + `rendering/` | app 真正跑的 design 層 | 風格產出的本體 |

skill 是離線知識庫;`ui-ux-pro-max-knowledge.ts` 是把其中一小片 **手抄** 進 codebase。

---

## 2. 現況:設計風格產出流程

```
[Brief: purpose/audience/styleDirection]      [sourceContent]
                 └───────────────┬───────────────┘
                                 ▼
   ① 內容階段 generatePreviewDeck()  → SlideDeck(結構化 slides[])
                                 ▼
   ② 設計階段 UiUxProMaxDesignPlanner.plan()
        有 LLM port? ─ 是 → LLM 產 design plan → 驗證
        │                     └ 成功 → withCuratedStyleKit()
        │                                └ 若無 styleKit:
        │                                  selectDesignStyleKit(brief)  ◄── CURATED_FONT_PAIRINGS
        │                                     (關鍵字評分)                  CURATED_PALETTES  (寫死)
        └ 否/失敗 → buildFallbackDesignPlanningResult()(default,無 curated kit)
                                 ▼
        DesignPlanningResult { designSystem, slidePatternAssignments,
                               chartTreatmentPlans, visualHierarchyPlans, styleKit? }
                                 ▼
   ③ 渲染階段 renderTemplateDeckArtifact()
        resolveStyleKit() → buildDeckStyleCss(styleKit, designSystem)【引擎,逐值 sanitize】
        + buildDeckRuntimeScript() + renderSlide()×N
                                 ▼
        PreviewArtifact { html, htmlGenerationValidation, generationSummary }
```

**現況細節**:真正「選具體字體+配色」的 `selectDesignStyleKit` 目前**只掛在 LLM 成功路徑**
(透過 `withCuratedStyleKit`)。純 fallback 只拿 `defaultDesignStyleKit`,不套 curated 風格。
007 宜把「選 theme」改成一個獨立必經步驟。

---

## 3. 資料源 vs 已 port

| skill 資料源 | skill 有幾筆 | codebase 已 port | 落差 |
|---|---|---|---|
| `typography.csv`(字體配對) | 56 | 9 | 缺 ~47 |
| `colors.csv`(配色) | 96 | 9 | 缺 ~87 |
| `styles.csv`(**設計風格**) | 67 | **0** | **完全沒搬** |

**關鍵洞察**:目前 codebase 的「theme」只有**顏色 + 字體**兩軸;真正讓風格「長得不一樣」的
**結構維度(圓角/陰影/動態/底圖)全部寫死在 `defaultDesignStyleKit`**。那個維度的資料
就躺在沒搬的 `styles.csv`,它的 `Design System Variables` 欄位幾乎是 token 直接對應。

---

## 4. 引擎的 token 詞彙(`DesignStyleKit`)

CSV 風格要能被渲染,得映射成這些 token(`packages/domain/src/design/design-style-kit.types.ts`):

| token | 內容 |
|---|---|
| `fonts` | heading / body / googleFontsHref |
| `accentHues[]` | name / base(hex)/ gradient |
| `typeScale` | coverTitle/slideTitle/message/bullet/eyebrow/caption,各 `{ min, preferredVw, max, weight, lineHeight }` |
| `motion` | slideTransitionMs / slideEasing / entranceMs / staggerStepMs / microMs / respectReducedMotion |
| `effects` | cardRadiusPx / cardBorder / cardShadow(可多重/inset)/ cardSurface / accentGradient |
| `background` | css(任意 background 值,已 sanitize)|
| `patternLayouts[]` | pattern → layout family(版型對應)|
| `antiPatterns[]` | 「不要這樣做」(給 prompt/review,非 CSS)|

引擎 `buildDeckStyleCss` 對每個內插值都 sanitize(`HEX_PATTERN` / `UNSAFE_CSS_VALUE`),
因此未來吃 DB/使用者來的 token 是安全的。

---

## 5. 67 種風格盤點(對照現有 token)

分級定義:
- ✅ **A**:現有 token 直接可表達,引擎不用改。
- ⚠️ **B**:需擴 1–2 個明確 token(blur/glow/grain/gradient 動畫)後即變資料。
- ❌ **C**:需不同 HTML 版型、自訂 keyframe、或 3D/WebGL → 逃生口或暫不渲染。
- 🚫 **N/A**:非簡報視覺主題(Landing / Dashboard / 互動範式 / 無障礙橫切需求)。

### ✅ A 級(~14,優先 port)

| # | 風格 | token |
|---|---|---|
| 1 | Minimalism & Swiss | radius 0、shadow none、單一 accent |
| 2 | Neumorphism | cardShadow 雙陰影(inset/多重)+ surface 同底色 |
| 4 | Brutalism | radius 0、`slideTransitionMs:0`、weight 700–900、visible border |
| 6 | Vibrant & Block-based | 多彩 accentHues + 大字級 typeScale |
| 7 | Dark Mode (OLED) | 深色 background + neon accentHues(CuratedPalette 已支援 `dark`)|
| 9 | Claymorphism | radius 20、inner+outer cardShadow、pastel |
| 12 | Flat Design | shadow none、solid palette、radius 2 |
| 19 | Soft UI Evolution | 柔陰影、radius 10、timing |
| 38 | Neubrutalism | `box-shadow:4px 4px 0 #000`、border 3px、radius 0 |
| 42 | Organic Biophilic | radius 16–24、自然色、soft shadow |
| 46 | Dimensional Layering | 多級 elevation → cardShadow |
| 47 | Exaggerated Minimalism | typeScale 巨字 clamp + weight 900 |
| 56 | E-Ink / Paper | 紙底色、ink 文字、`transition:none`、serif |
| 61 | Nature Distilled | 大地色、soft shadow、natural easing |

### ⚠️ B 級(~6,擴 token 後可)

| # | 風格 | 缺的 token |
|---|---|---|
| 3 | Glassmorphism | `cardBackdropBlur`(backdrop-filter: blur)|
| 10 | Aurora UI | 漸層**動畫**(目前只支援靜態 background)|
| 40 | Y2K Aesthetic | 金屬/光澤漸層 + glow |
| 65 | Gradient Mesh | mesh 漸層 + 流動動畫 |
| 68 | Vintage Analog | `filter`(sepia/contrast)+ grain 疊層 |
| — | (共用)E-Ink / Nature 的紋理 | 一個 `textureOverlay`(grain/noise)token 可一次升級多個 |

### ❌ C 級(~22,結構/keyframe/3D)

- **版型結構類**(需不同 HTML grid):39 Bento Box、53 Bento Grids、50 Swiss Modernism 2.0、66 Editorial/Magazine、44 Memphis
- **keyframe 特效類**(glitch/scanline/parallax/kinetic):11 Retro-Futurism、41 Cyberpunk、45 Vaporwave、48 Kinetic Typography、49 Parallax、51 HUD/Sci-Fi、57 Gen Z Chaos、58 Biomimetic、59 Anti-Polish、67 RGB Split
- **3D/WebGL/物理類**:5 3D&Hyperrealism、13 Skeuomorphism、14 Liquid Glass、55 Spatial UI、60 Tactile Deformable、64 3D Product Preview、52 Pixel Art
- **scroll 互動**:15 Motion-Driven

### 🚫 N/A(~25,非簡報主題)

- **Landing Page**(20–27):Hero-Centric、Conversion、Social Proof、Feature-Rich、Minimal&Direct、Interactive Demo、Trust&Authority、Storytelling
- **BI/Dashboard**(28–37):Data-Dense、Heatmap、Executive、Real-Time、Drill-Down、Comparative、Predictive、User-Behavior、Financial、Sales Intelligence
- **互動範式 / 無障礙橫切**:8 Accessible&Ethical、16 Micro-interactions、17 Inclusive、18 Zero Interface、43 AI-Native、62 Interactive Cursor、63 Voice-First

> 註:分級為盤點時的判斷,確切 token 覆蓋於 007 實際 authoring 時逐筆確認。
> styles.csv 編號到 68 但缺 54,實際 67 筆。

---

## 6. Seed 策略(全部灌進 DB,但打標籤 gate)

「全部變成 seed」可行且建議——seed 是資料,灌全部不丟失;gate 放在「選擇/渲染」層。
每筆 theme 多兩個欄位:

```
applies_to   presentation | landing | dashboard | universal
support      full    (A 級,引擎完整渲染)
             partial (B 級,缺的 token 先忽略)
             raw     (C 級,只存 Design System Variables 原文,引擎暫不渲染)
```

- selection 預設只挑 `applies_to=presentation` 且 `support in (full, partial)`。
- C 級先以 `raw` 存,日後加版型/逃生口再升級 → **不必重 seed**。
- typography.csv(56)+ colors.csv(96)為純值資料,全部可直接 seed。

### seed 放置

- 檔案:`apps/api/src/infra/db/seeds/*.json`(由三個 CSV 轉出)。
- 指令:`pnpm db:seed`,在 migration 後 upsert。
- A/B 級需手動把 CSV `Design System Variables` 對應成 `DesignStyleKit` token;C 級存 raw;N/A 照標 `applies_to`。

---

## 7. `themes` 表(006 預留結構,007 灌內容)

```
themes
  id          text PK              -- "brutalist" 或 uuid(使用者主題)
  scope       text NOT NULL        -- builtin | account
  account_id  text NULL  FK→accounts(id) ON DELETE CASCADE
  name        text NOT NULL
  description text NULL
  keywords    jsonb                -- 自動選色評分用
  applies_to  text NOT NULL        -- presentation | landing | dashboard | universal
  support     text NOT NULL        -- full | partial | raw
  style_kit   jsonb NOT NULL       -- DesignStyleKit token(載入時驗證 + 既有 sanitize)
  active      boolean NOT NULL DEFAULT true
  created_at / updated_at  timestamptz
  INDEX (scope), (account_id), (applies_to, support)
```

設計原則(與整個 006 一致):**宣告式狀態放 DB,確定性引擎留 codebase**。
DB 放 token(燃料),`buildDeckStyleCss`/`renderTemplateDeck`(引擎)永不進 DB。
「design code」(渲染邏輯 / 任意 CSS·JS)留 codebase;只有 token 進 DB。

---

## 8. 工作量與範圍

- **A 級 14 筆**:每筆 token 映射 ~10–20 分鐘,最划算的第一批。
- **B 級**:每個新 token 是一次引擎小改 + 對應(blur / glow / grain / gradient 動畫各一)。
- **C 級**:結構/keyframe 為大工,按需逐步,不一次全做。
- **006 範圍**:DB + ORM(Drizzle)+ auth 串 DB(`DbUserAccountStore`)+ deck 持久化
  (`decks` / `deck_revisions`),並**預留 `themes` 表結構**。
- **007 範圍**:design theme system —— CSV → seed 轉換、A/B 級 token 映射、selection 改讀 DB、
  使用者自訂主題(scope=account)。

---

## 9. 007 回來時的下一步(任選)

1. 把 A 級 14 筆實際對應成 `DesignStyleKit` token 的 seed 草案(JSON),確認映射品質。
2. 寫轉換腳本把三個 CSV 自動轉成 seed 骨架(token 欄位留待人工補)。
3. 把「curated 選擇只在 LLM 路徑」修成獨立必經步驟(selectTheme)。
4. 依序加 B 級的 4–5 個引擎 token,逐步把 partial 升級成 full。

---

## 相關檔案

- 引擎 token 合約:`packages/domain/src/design/design-style-kit.types.ts`
- 寫死知識:`packages/domain/src/design/ui-ux-pro-max-knowledge.ts`
- 選擇邏輯:`packages/domain/src/design/select-design-style-kit.ts`
- design planner:`packages/domain/src/design/design-planner.ts`
- CSS 引擎:`packages/domain/src/rendering/deck-style-css.ts`
- 模板渲染:`packages/domain/src/rendering/template-html-renderer.ts`
- skill 資料:`.claude/skills/ui-ux-pro-max/data/{styles,colors,typography}.csv`

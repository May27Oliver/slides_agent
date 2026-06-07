# 設計系統架構與擴充指南（design.md）

> 這份文件說明簡報「視覺/設計」是怎麼產生的、UIUX Pro Max skill 目前接在哪裡，
> 以及**未來要再加入其他設計 skill 時該怎麼加**。
>
> 一句話原則：**所有設計 skill 最終都只需要產出一個 `DesignStyleKit`；
> 渲染器與驗證器永遠只認 `DesignStyleKit`，不認任何特定 skill。**

---

## 1. 核心概念：`DesignStyleKit` 是唯一的接縫（seam）

整個設計層的可擴充性建立在一個穩定契約上：

```
任何設計 skill ──產出──▶ DesignStyleKit ──消費──▶ 渲染器 / 驗證器
        (各家不同)            (穩定契約)            (skill-agnostic)
```

- **上游（會變）**：每個設計 skill 有自己的策展資料與選型邏輯。
- **接縫（穩定）**：`DesignStyleKit`（`packages/domain/src/design/design-style-kit.types.ts`）。
- **下游（不該為任何 skill 改動）**：渲染器（`fallback-html-renderer.ts` + `deck-style-css.ts` + `deck-runtime-script.ts`）與驗證器（`html-generation-validator.ts`）。

`DesignStyleKit` 內容（具體可表達精緻設計的 token）：

| 欄位 | 用途 |
|------|------|
| `fonts` | heading/body font stack + `googleFontsHref` |
| `typeScale` | 各角色的 `clamp()` 字級（封面/標題/訊息/bullet/eyebrow/caption） |
| `motion` | 轉場/進場/階梯延遲/微互動 + `respectReducedMotion` |
| `effects` | 卡片圓角/邊框/陰影/表面 + accent 漸層 |
| `background` | 整頁背景（層疊漸層）CSS |
| `accentHues` | 多色 accent（卡片輪流上色） |
| `patternLayouts` | 每個 slidePattern → 版型家族（cover / title-bullets / metric-cards / matrix / closing） |
| `antiPatterns` | skill 來源的「不要這樣做」清單（給 prompt 與 review 用） |

> **黃金規則**：要加新表現力（例如「玻璃擬態」效果），先問「能不能塞進 `DesignStyleKit`？」
> 能 → 擴充這個型別，所有 skill 與渲染器都受惠；不能硬塞進某個 skill。

---

## 2. 目前的資料流（pipeline）

```
使用者輸入：sourceContent + deckBrief(purpose / audience / styleDirection)
   │
   ▼ ① content_planning ............ [LLM] 語意切段 → sourceSections
   ▼ ② deck_planning ............... [LLM] 大綱精修 → slideDeck(title/message/bullets)
   ▼ ③ design_planning ............. [LLM 選型 + 策展]
   │     UiUxProMaxDesignPlanner.plan()         (design/design-planner.ts)
   │        ├─ LLM 逐頁挑 pattern + palette → DesignPlanningResult
   │        └─ 掛上 styleKit ◀── selectDesignStyleKit(brief)   ← 設計 skill 在此注入
   ▼ ④ html_generation ............. [確定性·模板為主]
   │     renderTemplateDeckArtifact()           (rendering/html-deck-renderer.ts)
   │        └─ renderFallbackHtmlDeck(deck, designPlanningResult)
   │              ├─ resolveStyleKit() 取 styleKit（無則 defaultDesignStyleKit）
   │              ├─ buildDeckStyleCss(styleKit)   → CSS（背景/字級/卡片/動畫）
   │              └─ buildDeckRuntimeScript()      → icon 導覽 + 進度條 + 鍵盤
   ▼ ⑤ html_validation ............. [確定性] validateGeneratedHtml()
   │
   ▼ PreviewArtifact(status: pass) → 前端預覽
```

備援路徑（目前 standby）：`html-generation-prompt.ts`（已灌入 skill 規則）→ `LlmAssistedHtmlDeckGenerator`
→ LLM 手刻 HTML。切成「模板為主」後 service 不再呼叫，保留供日後「LLM 變化模式」。

---

## 3. UIUX Pro Max 目前接在哪些檔案

來源（唯讀）：`.claude/skills/ui-ux-pro-max/`（`SKILL.md` + `data/colors.csv` + `data/typography.csv`）

| 角色 | 檔案 | 說明 |
|------|------|------|
| 策展資料 | `packages/domain/src/design/ui-ux-pro-max-knowledge.ts` | 從 skill CSV 移植的字型配對 + 調色盤（帶關鍵字） |
| 選型邏輯 | `packages/domain/src/design/select-design-style-kit.ts` | 依 brief 關鍵字評分挑 kit（等同 skill 的 `search.py`） |
| 結構/預設 | `packages/domain/src/design/default-design-style-kit.ts` | 字級/動態/效果/版型的結構與 deterministic 預設 |
| 型別契約 | `packages/domain/src/design/design-style-kit.types.ts` | `DesignStyleKit`（接縫） |
| 接線 | `packages/domain/src/design/design-planner.ts` | design planning 後掛上 `styleKit` |
| 規則注入 | `packages/domain/src/rendering/html-generation-prompt.ts` | skill Common Rules + Checklist（LLM 模式用） |

渲染/驗證（**skill-agnostic，不要為單一 skill 改**）：
`rendering/fallback-html-renderer.ts`、`rendering/deck-style-css.ts`、
`rendering/deck-runtime-script.ts`、`rendering/html-generation-validator.ts`。

---

## 4. 如何加入「另一個」設計 skill

目標：新增 skill 時，**只新增檔案、不動渲染器/驗證器/pipeline**。

### 心智模型：每個 skill = 一個「DesignKit Provider」
一個 provider 收到 brief，回傳「我建議的 kit + 信心分數」或 `null`（不適用）。
selector 從所有已註冊 provider 中挑分數最高的；都不適用就用 `defaultDesignStyleKit()`。

### 建議的契約（加第 2 個 skill 時引入）
```ts
// packages/domain/src/design/design-kit-provider.ts
import type { DesignStyleKit } from "@/design/design-style-kit.types";

export interface DesignBrief {
  purpose?: string;
  audience?: string;
  styleDirection?: string;
}

export interface DesignKitProposal {
  kit: DesignStyleKit;
  score: number;   // 關鍵字/規則匹配分數
  reason: string;  // 為何選它（給 log/review）
}

export interface DesignKitProvider {
  id: string;
  propose(brief: DesignBrief): DesignKitProposal | null;
}
```

### 步驟（以新增 `acme-design` skill 為例）

1. **移植資料** → `packages/domain/src/design/acme-design-knowledge.ts`
   - 把該 skill 的調色盤/字型/效果策展成 TS（仿 `ui-ux-pro-max-knowledge.ts`），每筆帶 `keywords`。

2. **寫 provider** → `packages/domain/src/design/acme-design-kit-provider.ts`
   ```ts
   import { defaultDesignStyleKit } from "@/design/default-design-style-kit";
   import type { DesignKitProvider } from "@/design/design-kit-provider";
   import { ACME_PALETTES, ACME_FONTS } from "@/design/acme-design-knowledge";

   export const acmeDesignKitProvider: DesignKitProvider = {
     id: "acme-design",
     propose(brief) {
       const haystack = [brief.purpose, brief.audience, brief.styleDirection]
         .filter(Boolean).join(" ").toLowerCase();
       const palette = pickBest(ACME_PALETTES, haystack);
       const font = pickBest(ACME_FONTS, haystack);
       if (palette.score === 0 && font.score === 0) return null; // 不適用
       const base = defaultDesignStyleKit({ accent: palette.entry.primary });
       return {
         kit: { ...base, /* 覆寫 fonts / accentHues / effects / background */ },
         score: palette.score + font.score,
         reason: `acme: ${palette.entry.id} + ${font.entry.id}`
       };
     }
   };
   ```
   - **務必回傳完整 `DesignStyleKit`**：用 `defaultDesignStyleKit()` 當骨架，只覆寫你要的 token，
     確保 `typeScale / motion / patternLayouts` 等結構欄位齊全（渲染器都會用到）。

3. **註冊** → 把 `select-design-style-kit.ts` 改成 registry（第一次加 skill 時做一次）
   ```ts
   // packages/domain/src/design/select-design-style-kit.ts
   import { defaultDesignStyleKit } from "@/design/default-design-style-kit";
   import type { DesignBrief, DesignKitProvider } from "@/design/design-kit-provider";
   import { uiUxProMaxKitProvider } from "@/design/ui-ux-pro-max-kit-provider";
   import { acmeDesignKitProvider } from "@/design/acme-design-kit-provider";

   const PROVIDERS: DesignKitProvider[] = [
     uiUxProMaxKitProvider,
     acmeDesignKitProvider   // ← 新 skill 只在這裡加一行
   ];

   export function selectDesignStyleKit(brief: DesignBrief): DesignStyleKit {
     const proposals = PROVIDERS
       .map((p) => p.propose(brief))
       .filter((x): x is NonNullable<typeof x> => Boolean(x))
       .sort((a, b) => b.score - a.score);
     return proposals[0]?.kit ?? defaultDesignStyleKit();
   }
   ```
   - 同時把現有 UIUX Pro Max 的選型搬成 `ui-ux-pro-max-kit-provider.ts`（把目前
     `select-design-style-kit.ts` 的內容包成一個 provider 回傳 `{kit, score, reason}`）。

4. **加測試** → `packages/domain/test/design/acme-design-kit-provider.test.ts`
   - 斷言：特定關鍵字 → 選到 acme kit；無關 brief → 回 `null`；回傳 kit 結構完整
     （`fonts.googleFontsHref`、`typeScale.slideTitle`、`patternLayouts.length >= 5`、
     `accentHues` 全為合法 hex）。

5. **匯出**（如需對外）→ 在 `packages/domain/src/index.ts` 加 export。

**就這樣。** 不需要碰 `fallback-html-renderer.ts`、`deck-style-css.ts`、
`html-generation-validator.ts`、`slides.service.ts`、pipeline。

### 加新 skill 檢查清單
- [ ] 新增 `*-knowledge.ts`（策展資料，帶 keywords）
- [ ] 新增 `*-kit-provider.ts`，`propose()` 回傳完整 `DesignStyleKit`（用 default 當骨架）
- [ ] 在 `PROVIDERS` 註冊一行
- [ ] 不適用時 `propose()` 回 `null`（讓別的 provider / default 接手）
- [ ] 加 provider 測試
- [ ] 沒有改到渲染器 / 驗證器 / service
- [ ] `tsc --noEmit` 與 vitest 全綠

---

## 5. 不變條件（invariants，擴充時務必遵守）

1. **來源忠實**：設計層不得竄改 slide 的 title/message/outline 文字、數字、單位、順序。
   設計只決定「長相」，不決定「內容」。
2. **Self-contained（例外：Google Fonts）**：產出 HTML 不得載入外部 CSS/JS/圖片/CDN，
   唯一允許 `fonts.googleapis.com` / `fonts.gstatic.com`。新 skill 若要用其他字型來源，
   需同步更新 `validateSelfContained` 的允許清單（並三思離線可攜性）。
3. **驗證契約**：每頁 `<section data-slide-id data-pattern>`、鍵盤導覽、隱藏 speaker notes。
   渲染器已保證；新 skill 只改 token、不改這些結構。
4. **可降級**：任何 provider 失敗/不適用都要能回到 `defaultDesignStyleKit()`，不可讓整條 pipeline 掛掉。
5. **無祕密外洩**：策展資料是公開設計知識；不要把任何 API key / 供應商設定寫進 knowledge/provider。

---

## 5.1 圖表視覺（008 chart rendering）

008 把規劃好的 `ChartIntent` 在 deck 裡畫成 **engine-owned inline SVG / HTML 真圖表**（pie/donut、line、bar、metric card、metric group、table、fallback），全部消費 007 的 `DesignStyleKit`：

- **配色**取自 `accentHues`（slices / bars / line / legend swatch / metric accent 都循環取色），與當前風格一致。
- **排版/密度**沿用 deck CSS 變數（`--text` / `--muted` / `--card-surface` / `--card-border` / `--card-radius` / `--type-caption`），不自帶字型或顏色常數。
- **單一決策來源**：`VisualizationType → ChartTreatment` 由 `chart-treatment-mapping.ts` 映射（決策 B），`design-planner` 與渲染器都經此映射，避免兩個 enum 漂移。
- **不變條件**：圖表同樣遵守上面 5 條（來源忠實、self-contained、結構契約、可降級、無祕密）；資料不足以成真圖時安全 fallback 並寫 review note，絕不畫誤導性或空白圖。
- **每個風格都要能預覽**：`pnpm --filter @slides-agent/api preview:chart-matrix` 產生「每個 `support=full` 風格 × 每種 chart visual」的矩陣，新增風格或視覺未補對應組合時 smoke test 會 fail。

---

## 6. 名詞對照

| 詞 | 意義 |
|----|------|
| design skill | 一套設計知識來源（如 UIUX Pro Max），提供調色盤/字型/風格/規則 |
| `DesignStyleKit` | 設計層的穩定輸出契約；渲染器唯一輸入 |
| provider | 把某個 skill 的知識轉成 `DesignStyleKit` 的選型器 |
| pattern / layout | slide 的版型家族（cover / title-bullets / metric-cards / matrix / closing） |
| 模板為主 | 目前架構：④用確定性渲染器產 HTML（快/穩/免費），LLM 只做上游選型 |
```

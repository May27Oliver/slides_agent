# Data Model: 007 design-theme-system

> 宣告式狀態(theme token)放 DB,確定性引擎(`composeKit`/`buildDeckStyleCss`)留 codebase。
> 006 已建 `themes` 表結構;007 加 `kind` 欄並灌資料。三軸以 `kind` 區分,`style_kit` 為分 kind 的 partial token。

## 關聯(themes 與 006 既有表)

```
accounts ──1:N── decks ──1:N── deck_revisions
   │                                  ▲
   │ 1:0..N (account_id, 008 才有資料)  │ generation_summary.selectedTheme
   ▼                                  │ 記三軸 id(邏輯關聯,無 FK)
themes ◄──────────────────────────────┘
```

詳見 spec 的「資料模型與關聯圖」。007 只灌 `scope=builtin`、`account_id=NULL`。

## `themes` 表(007 後最終形)

| 欄位 | 型別 | 約束 / 預設 | 說明 |
|---|---|---|---|
| `id` | text | PK | builtin slug,`{kind}-{序位}-{slug}`(如 `style-10-glassmorphism` / `palette-10-aurora` / `font-10-inter-lora`;安全預設用 `00`) |
| `scope` | text | NOT NULL | 007 只 `builtin`;`account` 留 008 |
| `kind` | text | **NOT NULL(007 新增)** | `font` \| `palette` \| `style` |
| `account_id` | text | FK→accounts(id) ON DELETE cascade,NULL | builtin 為 NULL |
| `name` | text | NOT NULL | 顯示名 |
| `description` | text | NULL | 風格描述 |
| `keywords` | jsonb | NOT NULL DEFAULT `'[]'` | `selectTheme` 評分用 |
| `applies_to` | text | NOT NULL | presentation \| landing \| dashboard \| universal |
| `support` | text | NOT NULL | full \| partial \| raw |
| `style_kit` | jsonb | NOT NULL | **分 kind 的 partial token**(見下);載入時 kind-aware 驗證 |
| `active` | boolean | NOT NULL DEFAULT true | inactive 不入候選 |
| `created_at`/`updated_at` | timestamptz | NOT NULL DEFAULT now() | seed upsert 更新 `updated_at` |

**索引(DR-007)**:
- 既有 `themes_scope_idx (scope)`、`themes_account_idx (account_id)` 保留(供 008)。
- `themes_select_idx` 以 `kind` 為前導重建為 `(kind, applies_to, support)`,涵蓋 selection 查詢。

**id 排序約定(DR-004,保證安全預設排首位)**:`ORDER BY id` 下「第一筆」即各 kind 的安全預設,故 seed id 採可排序前綴——安全預設用 `00` 序位、其餘用 `10`+:

| kind | 安全預設 id(`00`) | 其餘(`10`+) |
|---|---|---|
| `style` | `style-00-minimalism` | `style-10-glassmorphism`、`style-10-neumorphism`… |
| `palette` | `palette-00-safe-default` | `palette-10-aurora`… |
| `font` | `font-00-sans-default` | `font-10-inter-lora`… |

## 預期分佈(驗收 checklist,權威來源 `THEME_SEED_INVENTORY.md`)

seed 完成時 `themes` 列數/標籤分佈 MUST 對齊下表(完工時逐筆對照,確認「全部」確實覆蓋):

| kind | 總數 | support 分佈 |
|---|---|---|
| `font` | 57 | 全 `full`(純值,自動轉) |
| `palette` | 96 | 全 `full`(純值,自動轉) |
| `style` | 67 | `full` = A 級 14 + B 級 ~6 = ~20;`raw` = C 級 ~22 + N/A landing/dashboard/互動 ~25 = ~47 |

- **A 級 14**(`support=full`,`applies_to=presentation`):Minimalism、Neumorphism、Brutalism、Vibrant、Dark Mode OLED、Claymorphism、Flat、Soft UI、Neubrutalism、Organic Biophilic、Dimensional Layering、Exaggerated Minimalism、E-Ink/Paper、Nature Distilled。
- **B 級 ~6**(US3 擴 token 後 `support=full`):Glassmorphism(blur)、Aurora UI(漸層動畫)、Y2K(glow)、Gradient Mesh(mesh 動畫)、Vintage Analog(grain)、+ 共用 texture 升級的 E-Ink/Nature。
- **C 級 ~22 + N/A ~25**(`support=raw` 或非 presentation `applies_to`):入庫但預設不被選。

**migration**:`pnpm db:generate` 由 schema 差異產出 `0001_*.sql`(`ALTER TABLE themes ADD COLUMN kind text NOT NULL;` + drop/create 選擇索引)。因 006 表為空,加 NOT NULL 欄無回填問題。

## `style_kit` 分 kind 的 partial token

每列只裝其 `kind` 對應的子集(完整詞彙見 `design-style-kit.types.ts`):

```ts
// kind = "font" —— 來源 typography.csv(57)
interface FontStyleKit {
  fonts: { heading: string; body: string; googleFontsHref?: string };
}

// kind = "palette" —— 來源 colors.csv(96)
interface PaletteStyleKit {
  accentHues: AccentHue[];          // index 0 = primary
  accentGradient: string;
  background: { css: string };      // 分層漸層(含 dark 變體)
  cardSurface: string;
  cardBorder: string;
}

// kind = "style" —— 來源 styles.csv(67)
interface StyleStyleKit {           // support=full/partial
  effects: { cardRadiusPx: number; cardShadow: string;
             cardBackdropBlurPx?: number; glow?: string };   // B 級新 token
  motion: DesignMotion;
  typeScale?: Partial<DesignTypeScale>;
  patternLayouts?: PatternLayoutHint[];
  antiPatterns?: string[];
  backgroundStructure?: { textureOverlay?: "grain"|"noise"|"paper";
                          gradientAnimation?: { preset:"aurora"|"mesh"; durationMs:number } };
}

interface RawStyleKit {             // support=raw(C 級;selection 排除,引擎不渲染)
  rawDesignSystemVariables: string; // CSV Design System Variables 原文
}
```

> kind-aware 驗證(zod 或等價):每 kind 一套 schema;`style` 依 `support` 分 `full/partial` vs `raw`。不合法者攔截回報、不寫入(FR-007)。

## domain 型別(`packages/domain/src/design/`)

```ts
// theme.types.ts —— 純語言,不含 SQL
export type ThemeKind = "font" | "palette" | "style";
export type ThemeSupport = "full" | "partial" | "raw";
export type ThemeAppliesTo = "presentation" | "landing" | "dashboard" | "universal";

export interface SelectableTheme {          // adapter 從 DB 撈出、交給純函式的形狀
  id: string;
  kind: ThemeKind;
  keywords: string[];
  support: ThemeSupport;
  styleKit: unknown;                        // partial kit(由 composeKit 依 kind 解讀)
}

export interface SelectedTheme {
  styleKit: DesignStyleKit;                 // composeKit 合併後的完整 kit
  ids: { style: string | null; palette: string | null; font: string | null };
  fallback: boolean;                        // 任一軸缺候選 → 該軸用 default
}
```

```ts
// theme-store.port.ts —— adapter 邊界
export interface ThemeStore {
  // 穩定排序(ORDER BY id);預設只回 scope='builtin' + active + applies_to in (presentation,universal),
  // style kind 排除 support=raw。回傳依 kind 分組或扁平清單由 selectTheme 過濾。
  listSelectable(): Promise<SelectableTheme[]>;
}
```

```ts
// select-theme.ts —— 純函式
export function selectTheme(
  brief: { purpose?: string; audience?: string; styleDirection?: string },
  candidates: SelectableTheme[]
): SelectedTheme;
// 對 font/palette/style 三 kind 各 pickBest(沿用既有評分);各軸無候選→該軸 null + default;
// 合併呼叫 composeKit。全空→styleKit=defaultDesignStyleKit、fallback=true。

// compose-kit.ts —— 純函式(重用既有引擎)
export function composeKit(parts: {
  style?: StyleStyleKit; palette?: PaletteStyleKit; font?: FontStyleKit;
}): DesignStyleKit;
// 起點 defaultDesignStyleKit → 套 style 結構 → 套 palette 色 → 套 font;缺軸用 default 該部分。
```

## `DesignStyleKit` B 級 token 擴充(`design-style-kit.types.ts`)

皆 **optional**(缺則引擎忽略,不破版),沿用既有逐值 sanitize:

```ts
interface DesignEffects {
  // ...既有 cardRadiusPx / cardBorder / cardShadow / cardSurface / accentGradient
  readonly cardBackdropBlurPx?: number;   // safeNumber → backdrop-filter: blur(Npx)
  readonly glow?: string;                 // safeCssValue → 疊加 box-shadow/drop-shadow
}
interface DesignBackground {
  // ...既有 css
  readonly textureOverlay?: "grain" | "noise" | "paper";              // enum,引擎映射內建疊層
  readonly gradientAnimation?: { readonly preset: "aurora" | "mesh"; readonly durationMs: number };
}
```

渲染(`buildDeckStyleCss`):`cardBackdropBlurPx`→`--card-backdrop-blur`、`glow`→強化陰影、`textureOverlay`→`.deck::before` 內建紋理、`gradientAnimation`→`@keyframes`(受 `motion.respectReducedMotion` / `prefers-reduced-motion` 守衛)。

## `GenerationSummary` 擴充(`deck/deck.types.ts`)

```ts
export interface GenerationSummary {
  slideCount: number;
  sourceFactCount: number;
  chartIntentCount: number;
  uncertainClaimCount: number;
  selectedTheme?: {                       // 007 新增(FR-013)
    style: string | null; palette: string | null; font: string | null;
    fallback: boolean;
  };
}
```

由 `slides.service` 從 `SelectedTheme` 填入;隨 `deck_revisions.generation_summary` jsonb 持久化(無 migration,欄已 opaque)。

## seed JSON 形狀(`apps/api/src/infra/db/seeds/*.json`)

每檔一個陣列,元素對映一列 `themes`(轉換腳本產 font/palette,style 由人工補 `styleKit`):

```jsonc
// theme-styles.json(節選)
[
  { "id": "style-00-minimalism", "kind": "style", "name": "Minimalism & Swiss",
    "appliesTo": "presentation", "support": "full",
    "keywords": ["minimal","swiss","clean","whitespace"],
    "styleKit": { "effects": { "cardRadiusPx": 0, "cardShadow": "none" },
                  "motion": { "...": "..." } } },              // 00 序位 = 各 kind 安全預設,ORDER BY id 排首位
  { "id": "style-10-glassmorphism", "kind": "style", "name": "Glassmorphism",
    "appliesTo": "presentation", "support": "full",
    "keywords": ["glass","frosted","modern","translucent"],
    "styleKit": { "effects": { "cardRadiusPx": 18, "cardShadow": "...", "cardBackdropBlurPx": 14 },
                  "motion": { "...": "..." } } },
  { "id": "style-10-bento-grids", "kind": "style", "name": "Bento Grids",
    "appliesTo": "presentation", "support": "raw",
    "keywords": ["bento","grid"],
    "styleKit": { "rawDesignSystemVariables": "<CSV 原文>" } }
]
```

## selection 流程(slides.service design 階段)

```
deckBrief ── (1) themeStore.listSelectable()  [API adapter,DB,穩定排序]
          ── (2) planner.plan(...)            [domain;產 designSystem/pattern/chart,不帶 styleKit]
          ── (3) selectTheme(deckBrief, candidates)  [domain 純函式]
                   ├ font:   pickBest → composeKit.font
                   ├ palette:pickBest → composeKit.palette
                   └ style:  pickBest(排 raw)→ composeKit.style
                   → SelectedTheme { styleKit, ids, fallback }
          ── (4) result = { ...planResult, styleKit: selected.styleKit }
                 generationSummary.selectedTheme = { ...selected.ids, fallback }
          ── (5) renderTemplateDeckArtifact(deck, result)  [既有;resolveStyleKit 取 styleKit]
```

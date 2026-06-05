# Contract: Theme Selection(內部介面 —— 007 無新 HTTP API)

> 007 不新增對外 REST 端點(account 主題與其 API 留 008)。可審查介面為:`ThemeStore` port、
> `selectTheme`/`composeKit` 純函式、seed JSON schema、`generationSummary.selectedTheme`。

## 1. `ThemeStore` port(`packages/domain/src/design/theme-store.port.ts`)

```ts
export interface ThemeStore {
  /**
   * 回傳可選 builtin themes(font/palette/style 三 kind)。
   * 預設過濾:scope='builtin'、active=true、applies_to in (presentation, universal)、
   *           style kind 排除 support=raw(scope='account' 為 008 才有,明確排除)。
   * 排序:ORDER BY id(穩定,使 selectTheme 的「無命中/平手取第一筆」可重現;
   *       安全預設以 seed id `00` 序位前綴保證排首位)。
   */
  listSelectable(): Promise<SelectableTheme[]>;
}
```

adapter:`DrizzleThemeStore`(`apps/api/src/modules/themes/drizzle-theme-store.ts`,inject `DRIZZLE`),仿 `DrizzleDeckStore`。

## 2. `selectTheme`(`packages/domain/src/design/select-theme.ts`)

```ts
export function selectTheme(
  brief: { purpose?: string; audience?: string; styleDirection?: string },
  candidates: SelectableTheme[]
): SelectedTheme;
```

**契約**:
- 對 `font`/`palette`/`style` 三 kind 各 `pickBest`(`styleDirection` 強、`purpose`+`audience` 弱;沿用既有權重)。
- 無命中或平手 → 該 kind 取候選(已穩定排序)第一筆;該首筆即各 kind 的安全預設(seed id `00` 序位前綴,如 `style-00-minimalism`)。
- 某 kind **無任何候選** → 該軸 id=null,`composeKit` 用 default 該部分,`fallback=true`。
- 三軸全無候選 → `styleKit = defaultDesignStyleKit()`、ids 全 null、`fallback=true`。
- **確定性**:同 `brief` + 同 `candidates`(同序)→ 同輸出。
- 不拋例外(候選為空亦安全回 default)。

## 3. `composeKit`(`packages/domain/src/design/compose-kit.ts`)

```ts
export function composeKit(parts: {
  style?: StyleStyleKit; palette?: PaletteStyleKit; font?: FontStyleKit;
}): DesignStyleKit;
```

**契約**:起點 `defaultDesignStyleKit()` → 套 `style`(effects/motion/typeScale/patternLayouts/background 結構)→ 套 `palette`(accentHues/accentGradient/background 色/cardSurface/cardBorder)→ 套 `font`(fonts)。任一 part 缺 → 該部分留 default。重用既有 `buildPaletteHues`/`buildCuratedEffects`/`buildBackground`。輸出為完整、合法的 `DesignStyleKit`(供 `buildDeckStyleCss` 逐值 sanitize)。

## 4. seed JSON schema(`apps/api/src/infra/db/seeds/*.json`)

每元素對映一列 `themes`。共同欄位 + 依 `kind` 的 `styleKit`:

```ts
interface ThemeSeed {
  id: string;                 // 穩定 slug,各 kind 前綴(style-/palette-/font-)
  kind: "font" | "palette" | "style";
  scope: "builtin";           // 007 固定
  name: string;
  description?: string;
  keywords: string[];
  appliesTo: "presentation" | "landing" | "dashboard" | "universal";
  support: "full" | "partial" | "raw";
  active?: boolean;           // 預設 true
  styleKit: FontStyleKit | PaletteStyleKit | StyleStyleKit | RawStyleKit;  // 依 kind
}
```

`seedThemes(db, seeds)`:idempotent `onConflictDoUpdate`(target=`themes.id`,更新 name/description/keywords/appliesTo/support/styleKit/active/updatedAt)。**全量先驗證再寫入**:對每筆 `styleKit` 做 **kind-aware 驗證**,任一不合法 → **整批不寫入**(單一 transaction rollback)並回報**所有**不合法列;不採「跳過壞列」的 partial success,確保不留半殘 catalog(FR-007)。

## 5. `generationSummary.selectedTheme`(可追溯證據,FR-013)

```ts
selectedTheme?: {
  style: string | null;     // 被選 style theme id
  palette: string | null;   // 被選 palette theme id
  font: string | null;      // 被選 font theme id
  fallback: boolean;         // 任一軸或全部退回 default
}
```

由 `slides.service` 填入,隨 `deck_revisions.generation_summary` 持久化,可由 `GET /api/decks/:id`(006 既有唯讀 API)回看。

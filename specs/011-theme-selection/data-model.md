# Data Model: 主題庫手動選擇（011）

> 本批**無 DB migration**。沿用 007 `themes`（三軸 220 列）與 010 revision 既有的 `generationSummary.selectedTheme.ids`（三軸 id 持久化）。以下為新增的 **contract / domain 型別**、**套用演算法**與**瀏覽讀取形狀**。

## §1 手動主題選擇（contract + domain）

```ts
// 三軸各可選一個；皆 optional——只指定想覆寫的軸，其餘走 baseline。
export interface ManualThemeSelection {
  fontId?: string;
  paletteId?: string;
  styleId?: string;
}
```

- **生成頁**：掛在 `GeneratePreviewRequestContract` 頂層 `themeSelection?: ManualThemeSelection`（非 deckBrief——主題不是內容意圖）。
- **編輯頁**：掛在 edit-revision request `themeSelection?: ManualThemeSelection`。
- **空物件 / 未提供** = 完全維持現況（關鍵字 selectTheme），不得改變既有行為。

## §2 套用演算法 `applyThemeSelection`（domain，純函式，不重寫 selectTheme）

```ts
applyThemeSelection(
  baseline: SelectedTheme,            // = selectTheme(brief, candidates)
  selection: ManualThemeSelection | undefined,
  candidates: SelectableTheme[]
): SelectedTheme
```

規則（對齊鎖定決策）：
```
若 selection 無任何指定 → 直接回 baseline（現況）。
取 baseline.ids 為起點 ids = { style, palette, font }。
for axis in [font, palette, style]:
  若 selection.<axis>Id 有值:
     找 candidates 中 id===該值 且 kind===axis 的主題
       命中 → 用其 styleKit 取代該軸、ids.<axis> = 該 id
       未命中（停用/不存在）→ 該軸沿用 baseline + 記一筆 fallback note（不報錯）
styleKit = composeKit({ style?, palette?, font? })   // 取代的軸用候選 kit，其餘用 baseline 對應 kit
return { styleKit: {...styleKit, kitName: composeKitName(ids)}, ids, fallback: 任一軸最終為 null }
```

- **零 LLM、純確定性**；與 `selectTheme` 同樣的 `composeKit` 合成路徑。
- baseline 已含三軸（關鍵字選 + 預設 fallback），故「只覆寫 palette」也能得到完整 kit。

## §3 生成路徑串接（slides.service）

現況：`themedDesignPlanningResult.styleKit = selectTheme(brief, candidates).styleKit`。
本批：
```
const baseline = selectTheme(brief, candidates);
const selected = applyThemeSelection(baseline, request.themeSelection, candidates);
themedDesignPlanningResult.styleKit = selected.styleKit;
// generationSummary.selectedTheme 仍由 projectSelectedThemeSummary(selected, …) 投影（三軸 id 上身、可持久化）
```
**LLM 步驟完全不變**；只換 render 階段套用的 styleKit。

## §4 編輯路徑串接（010 applyDeckEdit）

`applyDeckEdit` 帶 `themeSelection` 時：
```
baseline = 從 base revision 還原的 selectedTheme（base.generationSummary.selectedTheme 的三軸）作為 baseline，
           或對 base deck 重跑 selectTheme(baseBrief)；以 base 既有三軸為準較穩。
selected = applyThemeSelection(baseline, themeSelection, candidates)
designPlan = { ...baseDesignPlan, styleKit: selected.styleKit }   // 只換 styleKit
→ 重渲染（render→validate→summary，I3 順序不變），其餘（文字/結構/chartIntents）一律沿用 base。
```
- 編輯頁換主題 = 新 `origin="edit"` revision（與 010 一致）；**不跑 LLM、不改內容**。
- 需要 candidates（themes）→ 編輯端點載入 themeStore.listSelectable()（或瀏覽讀取）供 applyThemeSelection。

## §5 瀏覽讀取（browse）形狀

`listSelectable()` 回 `SelectableTheme{ id, kind, keywords, support, styleKit }`——**缺 name/description**，瀏覽器需要可讀標籤 + swatch 欄位。新增瀏覽讀取：

```ts
export interface BrowsableTheme {
  id: string;
  kind: "font" | "palette" | "style";
  name: string;            // themes.name（DB 有）
  description?: string;    // themes.description
  keywords: string[];
  // swatch 用：從該軸 styleKit 萃取的輕量呈現資料（不送整包 styleKit）
  swatch: {
    // palette：主要顏色們；font：字體家族名 + googleFontsHref；style：結構標籤/縮影提示
    colors?: string[];
    fontFamilies?: string[];
    googleFontsHref?: string;
    styleLabel?: string;
  };
}

export interface ThemeCatalogResponseContract {
  font: BrowsableTheme[];
  palette: BrowsableTheme[];
  style: BrowsableTheme[];
}
```

- 後端 `ThemeStore` 加 `listBrowsable()`（或擴充 listSelectable 回傳 name/description），`DrizzleThemeStore` 從 `themes` 表讀 name/description + 由 styleKit 萃取 swatch。
- swatch 萃取為**純投影**（不洩漏可注入 CSS；只取顏色 hex / 字體名 / 結構 enum 標籤）。

## §6 前端模型

- **選擇狀態**：`{ fontId?: string; paletteId?: string; styleId?: string }`（= ManualThemeSelection）。
- **`ThemeBrowserModal`（彈窗）**：開啟才載入/呈現三軸 swatch 清單（搜尋/篩選/分頁），選中以 id 記錄；頂部組合摘要 + 套用；a11y focus trap / Esc。**選定即關閉**，結果回填 summary。
- **`ThemeSummary`（常駐摘要）**：顯示三軸目前選擇（未覆寫軸標「自動」）+「瀏覽全部主題 →」開 modal。**生成頁掛表單側邊欄、編輯頁掛右側版面**（沿用 010）。
- 生成頁：6 張快速卡（寫 styleDirection，現況）與 modal 並存——卡片走關鍵字 baseline、modal 走 id 覆寫；summary 結果 → request.themeSelection。
- 編輯頁：summary → modal → 套用 → edit revision 帶 themeSelection。

## §7 失敗安全 / Edge

- 指定 id 不存在/停用 → 該軸退回 baseline + fallback note（§2），不報錯、不擋生成。
- 只指定部分軸 → 未指定軸走 baseline（§2）。
- 無 themeSelection → 現況（§1）。
- 編輯頁對 legacy deck（base 無三軸 id）→ baseline 退回對 base 重跑 selectTheme 或預設；換主題仍可運作。

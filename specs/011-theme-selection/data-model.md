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

## §4 編輯路徑串接（010 applyDeckEdit）— **明確的 baseline 還原演算法**

> **問題（修正）**：base revision 的 `generationSummary.selectedTheme` 是 009 的投影摘要,**只有三軸 id、沒有 partial styleKit**;不能只靠 ids + 現行 candidates 就保證「只換 palette、font/style 原樣保留」（base id 可能停用/刪除/為 null）。故定義明確演算法 + fallback 政策:

```
輸入: base revision、themeSelection、catalog(= listBrowsable 的三軸 partial kits)
baseIds = base.generationSummary.selectedTheme.ids        // {font,palette,style}，可能含 null

# 1) 還原 base 三軸的 partial（用 catalog 依 id 查；無法 resolve 則退預設 + note）
resolvedBase[axis] =
   baseIds[axis] 可在 catalog 查到 → 該 partial
   否則（null / 已停用 / 已刪除）→ 該軸預設 partial + warning{axis, reason:"base_unresolved"}

# 2) 套用使用者覆寫（同 §2 規則：指定軸用 catalog 查；查不到退該軸 resolvedBase + warning）
applied[axis] =
   themeSelection.<axis>Id 有值 →
        catalog 查到 → 該 partial（ids[axis]=該值）
        查不到 → resolvedBase[axis] + warning{axis, requestedId, reason:"invalid_id"}
   無值 → resolvedBase[axis]（沿用 base，達成「只換指定軸」）

styleKit = composeKit(applied 三軸)
designPlan = { ...baseDesignPlan, styleKit }              // 只換 styleKit
→ 重渲染（render→validate→summary，I3 順序不變）；文字/結構/chartIntents 一律沿用 base
```

- **「只換 palette、font/style 保留」** 在 base 三軸 id 皆可 resolve 時成立;某軸 base id 無法 resolve → 該軸退預設並**誠實標 warning**(§8),不靜默、不亂套。
- 編輯頁換主題 = 新 `origin="edit"` revision(與 010 一致);**不跑 LLM、不改內容**。
- 需要 catalog → 編輯端點載入 `listBrowsable()`(含 partial kits)供還原 + 覆寫。
- client 端即時預覽走**同一演算法**(catalog 已在前端,§5),與 server 存檔結果一致(parity)。

## §5 瀏覽讀取（browse）形狀 — **回傳完整 partial styleKit**（修正：原本「只回 swatch」無法支撐編輯頁 client 即時重渲染）

> **設計裁決**：編輯頁要 client 端即時 WYSIWYG 換主題（沿用 010 client renderer），就需要 `composeKit` 三軸的**完整 partial styleKit**——swatch 不足以 compose/render。因此 `GET /api/themes` MUST 回傳每個主題**經 sanitize 的完整 partial styleKit**（就是 `SelectableTheme.styleKit`）。安全性：這些 styleKit 是 builtin 主題庫、**已在 007 seed 階段驗證過**（`seedThemes` 擋 CSS-breakout / 非法 token），是「伺服器自己拿來 render 的同一份資料」，非使用者輸入——回傳它與回傳 slideDeck/designPlan 同樣安全。**swatch 改由 client 從 partial styleKit 萃取**（不需後端額外投影）。

```ts
export interface BrowsableTheme {
  id: string;
  kind: "font" | "palette" | "style";
  name: string;            // themes.name
  description?: string;    // themes.description
  keywords: string[];
  /**
   * 經 sanitize 的 *partial* DesignStyleKit（該軸），= SelectableTheme.styleKit。
   * client 用它：① 萃取 swatch 顯示；② 編輯頁 composeKit + 即時重渲染（010 parity）。
   */
  styleKit: unknown;
}

export interface ThemeCatalogResponseContract {
  font: BrowsableTheme[];      // 57
  palette: BrowsableTheme[];   // 96
  style: BrowsableTheme[];     // 67
}
```

- 後端 `ThemeStore` 加 `listBrowsable()`（= listSelectable 同來源 + name/description），`DrizzleThemeStore` 從 `themes` 表讀 name/description/keywords/style_kit。
- payload 上限考量：220 個 partial kit JSON（多為小物件，估數百 KB）；單次 GET 可接受。若實測過大，**改為依軸 lazy load**（`GET /api/themes?kind=palette`）——modal 開啟才抓、且本就分軸瀏覽。
- swatch（顏色 hex / 字體家族名 / 風格標籤）由 client 從 `styleKit` 萃取顯示，不在後端做縮減投影。

## §6 前端模型

- **選擇狀態**：`{ fontId?: string; paletteId?: string; styleId?: string }`（= ManualThemeSelection）。
- **`ThemeBrowserModal`（彈窗）**：開啟才載入/呈現三軸 swatch 清單（搜尋/篩選/分頁），選中以 id 記錄；頂部組合摘要 + 套用；a11y focus trap / Esc。**選定即關閉**，結果回填 summary。
- **`ThemeSummary`（常駐摘要）**：顯示三軸目前選擇（未覆寫軸標「自動」）+「瀏覽全部主題 →」開 modal。**生成頁掛表單側邊欄、編輯頁掛右側版面**（沿用 010）。
- 生成頁：6 張快速卡（寫 styleDirection，現況）與 modal 並存——卡片走關鍵字 baseline、modal 走 id 覆寫；summary 結果 → request.themeSelection。
- 編輯頁：summary → modal → 套用 → edit revision 帶 themeSelection。

## §7 失敗安全 / Edge

- 指定 id 不存在/停用 → 該軸退回 baseline + **warning（§8）**，不報錯、不擋生成。
- 只指定部分軸 → 未指定軸走 baseline（§2）。
- 無 themeSelection → 現況（§1）。
- 編輯頁對 legacy deck（base 無三軸 id）→ 該軸退預設 + warning（§4/§8）；換主題仍可運作。

## §8 結果證據：themeSelectionWarnings（修正：fallback 需有 contract 承載）

> **問題（修正）**：spec/quickstart 要求「指定 id 無效 → 退 baseline 並有明確提示」,但 `SelectedThemeSummary.fallback` 只表示「軸為 null/預設」,**無法表達「使用者指定的 id 被拒、但 baseline 有值」**。需要明確的唯讀結果證據（與 008/009 圖表 fallback review note 同精神:誠實揭露、不靜默）。

```ts
export interface ThemeSelectionWarning {
  axis: "font" | "palette" | "style";
  requestedId?: string;                 // 使用者要的 id（base 無法 resolve 時可省略）
  reason: "invalid_id" | "disabled" | "base_unresolved";
}
```

- **承載位置**：`GenerationSummary` 新增 `themeSelectionWarnings: ThemeSelectionWarning[]`（`[]` 表示全部照指定套用）。同時用於生成回應與 edit revision 回應（兩條路徑都會 fallback）。
- **行為**：有 warning 時仍**正常產生/儲存**（不報錯）;前端依此**誠實提示**使用者「你選的色票已停用,已退回自動」。
- malformed（非字串型別等）仍走既有 **400** 請求驗證（contract §2）——warning 只處理「型別合法但 id 解析不到」。

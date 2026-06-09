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

> **修正(F1/F2)**：`SelectedTheme` 只有「composed 完整 styleKit + 三軸 id」,**無法反解出各軸 partial**。所以本函式**不從 baseline.styleKit 取部分**,而是**從 candidates 依 id 重新解析每軸 partial**(baseline 與覆寫都走 id → partial)。並**回傳 warnings**(否則 caller 無法得知哪軸失敗)。此演算法**同時供生成與編輯**使用(差別只在 baseline ids 來源),消除 §3/§4 重複(No-drift)。

```ts
export interface ApplyThemeResult {
  selectedTheme: SelectedTheme;          // { styleKit, ids, fallback }
  warnings: ThemeSelectionWarning[];     // §8；[] 表全照(baseline+覆寫)套用
}

applyThemeSelection(
  baselineIds: { font: string | null; palette: string | null; style: string | null },  // 生成=selectTheme(brief).ids；編輯=base.selectedTheme.ids
  selection: ManualThemeSelection | undefined,
  candidates: SelectableTheme[]          // 三軸 partial（= browse 回傳的同一份）
): ApplyThemeResult
```

規則（對齊鎖定決策）：
```
warnings = []
for axis in [font, palette, style]:
  requestedId = selection?.<axis>Id            # 使用者覆寫（可能 undefined）
  effectiveId = requestedId ?? baselineIds[axis]
  if effectiveId == null:                       # 該軸無 baseline、也沒覆寫
      partial[axis] = 省略 → composeKit 對該軸用預設
      continue
  hit = candidates.find(id===effectiveId && kind===axis)
  if hit:
      partial[axis] = hit.styleKit;  ids[axis] = effectiveId
  else:                                         # effectiveId 解析不到（不在現行可選目錄）
      partial[axis] = 省略（用預設）;  ids[axis] = null
      warnings.push({ axis,
                      ...(requestedId ? { requestedId } : {}),
                      reason: requestedId ? "invalid_id" : "base_unresolved" })
styleKit = composeKit({ style?: partial.style, palette?: partial.palette, font?: partial.font })
return {
  selectedTheme: { styleKit: {...styleKit, kitName: composeKitName(ids)}, ids,
                   fallback: 任一軸 ids 為 null },
  warnings
}
```

- **零 LLM、純確定性**；與 `selectTheme` 同樣的 `composeKit` 路徑；每軸 partial 一律**由 id 從 candidates 解析**（不反解 composed kit）。
- `selection` 全空 → effectiveId 全 = baselineIds → 等同 baseline（現況），warnings 視 baseline 是否可解析。

## §3 生成路徑串接（slides.service）

現況：`themedDesignPlanningResult.styleKit = selectTheme(brief, candidates).styleKit`。
本批：
```
const baseline = selectTheme(brief, candidates);                 // 取三軸 ids
const { selectedTheme, warnings } =
  applyThemeSelection(baseline.ids, request.themeSelection, candidates);
themedDesignPlanningResult.styleKit = selectedTheme.styleKit;
// generationSummary.selectedTheme = projectSelectedThemeSummary(selectedTheme, …)（三軸 id 上身、可持久化）
// generationSummary.themeSelectionWarnings = warnings（§8）
```
**LLM 步驟完全不變**；只換 render 階段套用的 styleKit。

## §4 編輯路徑串接（010 applyDeckEdit）— **重用同一個 `applyThemeSelection`**

編輯與生成走**同一個 §2 resolver**,差別只在 baseline ids 來源（消除重複、避免 drift）:

```
baselineIds = base.generationSummary.selectedTheme.ids      // 編輯的 baseline 來自 base revision（可能含 null）
const { selectedTheme, warnings } =
  applyThemeSelection(baselineIds, themeSelection, candidates);   // candidates = listBrowsable 的 partial kits
designPlan = { ...baseDesignPlan, styleKit: selectedTheme.styleKit }   // 只換 styleKit
→ 重渲染（render→validate→summary，I3 順序不變）；文字/結構/chartIntents 一律沿用 base
// 新版本回應帶 generationSummary.themeSelectionWarnings = warnings（§8）
```

- §2 的規則自動達成**「只換 palette、font/style 保留」**：未覆寫軸 effectiveId = baselineIds[axis] → 從 candidates 解析該 base partial;某 base 軸 id 無法解析 → 退預設 + `base_unresolved` warning(誠實、不亂套)。
- 編輯頁換主題 = 新 `origin="edit"` revision(與 010 一致);**不跑 LLM、不改內容**。
- 需要 candidates → 編輯端點載入 `listBrowsable()`(含 partial kits)。
- client 端即時預覽呼叫**同一個 `applyThemeSelection`**(candidates 已在前端,§5),與 server 存檔結果一致(parity)。

## §5 瀏覽讀取（browse）形狀 — **回傳完整 partial styleKit**（修正：原本「只回 swatch」無法支撐編輯頁 client 即時重渲染）

> **設計裁決**：編輯頁要 client 端即時 WYSIWYG 換主題（沿用 010 client renderer），就需要 `composeKit` 三軸的**完整 partial styleKit**——swatch 不足以 compose/render。因此 `GET /api/themes` MUST 回傳每個主題的**完整 partial styleKit**（就是 `SelectableTheme.styleKit`）。安全性（修正 F6，措辭精準）：這是 **trusted builtin 資料**（007 `seedThemes` 已驗證、擋 CSS-breakout / 非法 token；是伺服器自己 render 用的同一份），端點**不另做執行期 sanitize**;最終以 **renderer 既有 escaping 在 use boundary 把關**（與 007/008 渲染同路徑）。即「trusted builtin partial kit;render/client 在使用邊界 escape」。**swatch 改由 client 從 partial styleKit 萃取**（不需後端額外投影）。

```ts
export interface BrowsableTheme {
  id: string;
  kind: "font" | "palette" | "style";
  name: string;            // themes.name
  description?: string;    // themes.description
  keywords: string[];
  /**
   * trusted builtin *partial* DesignStyleKit（該軸），= SelectableTheme.styleKit
   * （007 seed 已驗證；render/client 在使用邊界 escape）。
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
- payload 上限考量：220 個 partial kit JSON（多為小物件，估數百 KB）；**單次 GET 回完整 `{font,palette,style}`,本批不做 `?kind=` 分軸**（YAGNI，避免未定義/未用的回應形狀）。若實測 payload 過大再加（屆時維持同一回應物件、非請求軸回 `[]`）——列為 future、不在 011。
- swatch（顏色 hex / 字體家族名 / 風格標籤）由 client 從 `styleKit` 萃取顯示，不在後端做縮減投影。

## §6 前端模型

- **選擇狀態**：`{ fontId?: string; paletteId?: string; styleId?: string }`（= ManualThemeSelection）。
- **`ThemeBrowserModal`（彈窗）**：開啟才載入/呈現三軸 swatch 清單（搜尋/篩選/分頁），選中以 id 記錄；頂部組合摘要 + 套用；a11y focus trap / Esc。**選定即關閉**，結果回填 summary。
- **`ThemeSummary`（常駐摘要）**：顯示三軸目前選擇（未覆寫軸標「自動」）+「瀏覽全部主題 →」開 modal。**生成頁掛表單側邊欄、編輯頁掛右側版面**（沿用 010）。
- 生成頁：6 張快速卡（寫 styleDirection，現況）與 modal 並存——卡片走關鍵字 baseline、modal 走 id 覆寫；summary 結果 → request.themeSelection。
- 編輯頁：summary → modal → 套用 → edit revision 帶 themeSelection。

## §7 失敗安全 / Edge

- 指定 id 不在可選目錄（刪除/停用/打錯，現行過濾下不可區分）→ **該軸退預設**（非 baseline）+ **warning `invalid_id`（§8）**，不報錯、不擋生成。
- 只指定部分軸 → 未指定軸走 baseline（§2）。
- 無 themeSelection → 現況（§1）。
- 編輯頁對 legacy deck（base 無三軸 id）→ 該軸退預設 + warning（§4/§8）；換主題仍可運作。

## §8 結果證據：themeSelectionWarnings（修正：fallback 需有 contract 承載）

> **問題（修正）**：「指定 id 無效 → 該軸退預設」需要明確提示,但 `SelectedThemeSummary.fallback` 只表示「軸為 null/預設」,**無法表達「是使用者指定的 id 被拒(invalid_id) vs base 軸無法解析(base_unresolved)」**。需要明確的唯讀結果證據（與 008/009 圖表 fallback review note 同精神:誠實揭露、不靜默）。

```ts
export interface ThemeSelectionWarning {
  axis: "font" | "palette" | "style";
  requestedId?: string;                 // 使用者覆寫的 id（base 軸無法 resolve 時省略）
  reason: "invalid_id" | "base_unresolved";
}
```

- **reason（修正 F4）**：只用兩種,因為 `GET /api/themes`/candidates 已 `active=true` 過濾 → **無法區分「停用」與「刪除」**,一律視為「不在現行可選目錄」:
  - `invalid_id`：**使用者覆寫**的 id 不在可選目錄（含已停用/已刪除/打錯）。
  - `base_unresolved`：**base 軸** id 不在可選目錄或為 null（編輯既有 deck 時）。
  - （不設 `disabled`——現行過濾下不可觀測；若日後要區分,需另開「可查 inactive」的伺服器路徑。）
- **承載位置**：`GenerationSummary` 新增 `themeSelectionWarnings: ThemeSelectionWarning[]`（`[]` 表示全部照 baseline+覆寫套用）。生成回應與 edit revision 回應共用。
- **行為**：有 warning 時仍**正常產生/儲存**（不報錯）;前端依此**誠實提示**「你選的主題已無法使用,該軸已改用**預設**主題」（**不可寫「自動」**——fallback 是退預設,非 baseline）。
- malformed（非字串型別等）仍走既有 **400** 請求驗證（contract §2）——warning 只處理「型別合法但 id 解析不到」。

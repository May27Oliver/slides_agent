# Contract: 預覽就地更新 postMessage 協議（016）

**用途**：編輯頁父視窗 ↔ 預覽 iframe（deck runtime）之間的訊息協議，讓編輯就地更新預覽而不重載文件。**內部協議**（同源頁面與其 sandbox iframe），非 HTTP/API 契約；無後端、無持久化。

## 訊息（既有 + 新增）

| 方向 | type | 既有/新增 | 內容 |
|------|------|----------|------|
| 父 → iframe | `deck:goToSlide` | 既有(010) | `{ index:number }` 切到第 index 張 |
| iframe → 父 | `deck:slideChanged` | 既有(014) | `{ index:number }` 使用者在 iframe 內導覽，父據此同步編輯選取 |
| 父 → iframe | **`deck:patchSlides`** | **新增(016)** | `{ slidesHtml:string, index:number, fontsHref:string\|null }` |

### `deck:patchSlides`（新增）

```ts
{ type: "deck:patchSlides"; slidesHtml: string; index: number; fontsHref: string | null }
```

**runtime 收到後（依序）**：
1. 來源檢查：`event.source === window.parent`，否則忽略（FR-008）。
2. `deck.classList.add("deck-static")`：關閉 `.anim`/chart 進場動畫重播（FR-004）。
3. `ensureOverrideFontLink(fontsHref)`：與現有 `#override-fonts` link 比對——同 href 不動（**不重抓字型**，FR-003 #2）、不同則更新、null 則移除。
4. 只替換投影片 sections 的 innerHTML（不動 progress / sidedots / controls 節點）。
5. 重抓 `slides`、依新數量重建 dots。
6. `show(clamp(index, 0, slides.length-1))`：套用後停在指定頁、夾到合法範圍（FR-002 / FR-009）。

**不變式**：
- runtime **不重載文件**：無 `srcDoc` 變更、無 `load` 事件、無 script 重啟（FR-001 / SC-001）。
- `slidesHtml` 由 domain `renderSlidesRegion` 產生，與全量渲染逐字相同（parity，FR-005）。
- 對 standalone deck（無父視窗 / 無人 postMessage）完全 inert：既有下載/匯出 HTML 的 runtime 行為與輸出不變。

## 父視窗（LivePreview）何時送 patch vs 重載

- **送 `deck:patchSlides`**：`frameKey`（`deckId:revision:themeKey`）不變、且該 frameKey 的 iframe 已 load 完成。
- **改 `srcDoc`（全量重載）**：frameKey 改變——切 deck / Save 後新 revision / 換主題（FR-006）。
- **降級**：iframe 尚未 load 完當前 frameKey 時不送 patch；load 完成後補送一次最新 patch，確保不漏更新（FR-007）。

## 安全

- 僅接受 `event.source === window.parent` 且 `type` 在白名單內的訊息；其餘忽略（沿用 014 reverse-sync 的來源檢查精神）。
- `slidesHtml` 為本地受信任 renderer 的輸出，注入自家 sandbox iframe；非第三方內容。

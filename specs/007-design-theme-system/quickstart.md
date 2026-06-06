# Quickstart: 007 design-theme-system(本機驗證)

> 前提:已完成 006 的本機 Postgres 設定(Homebrew PG16 + `DATABASE_URL`)。本檔聚焦 007 新增的
> migration、CSV→seed 轉換、theme seed、與生成時的 theme 選擇驗證。

## 1. 套用 schema(kind 欄)

```bash
cd apps/api
pnpm db:generate     # 由 schema 差異產出 0001_*.sql(themes ADD COLUMN kind + 重建選擇索引)
pnpm db:migrate      # 套用
```

驗證:`psql slides_agent -c '\d themes'` 應見 `kind` 欄;選擇索引含 `(kind, applies_to, support)`。

## 2. CSV → seed JSON(dev-time,一次性)

```bash
pnpm tsx scripts/convert-csv-to-theme-seeds.ts   # 讀 .claude/skills/ui-ux-pro-max/data/*.csv
```

產出 `src/infra/db/seeds/theme-fonts.json`(57)、`theme-palettes.json`(96)、`theme-styles.json`(67 骨架)。
**font/palette 自動轉完整;`style` kind 的 `styleKit` token 需人工補**(A 級對應 structure、C 級存 raw),補完 commit 進版控。`db:seed` 之後只讀這些 JSON,**不**再依賴 `.claude/skills`。

## 3. 灌 themes seed

```bash
pnpm db:seed         # accounts(006 既有)+ themes(007 新增,idempotent upsert)
```

驗證列數與標籤分佈:

```bash
psql slides_agent -c "SELECT kind, count(*) FROM themes GROUP BY kind;"
# 預期 font≈57、palette≈96、style≈67

psql slides_agent -c "SELECT support, count(*) FROM themes WHERE kind='style' GROUP BY support;"
# 預期 full(A+B 級)、raw(C 級)

psql slides_agent -c "SELECT applies_to, count(*) FROM themes GROUP BY applies_to;"
# presentation / universal(可選)+ landing / dashboard(入庫但不被選)
```

重跑 `pnpm db:seed` 應 **idempotent**(列數不變,`updated_at` 可更新)。

## 4. 端到端:生成時選 theme(兩路徑)

1. 啟動 API + worker + web,登入(006 帳號)。
2. 貼內容、給不同 `styleDirection`(如「glassmorphism 玻璃感」vs「brutalist 粗獷」)各生成一份。
3. 驗證:
   - 兩份的 HTML 外觀**不同**(配色/字體/圓角/陰影/動態),且**非寫死 default**。
   - 查 `GET /api/decks/:id`,`previewArtifact.generationSummary.selectedTheme` 記錄被選三軸 id:
     ```json
     { "style": "style-10-glassmorphism", "palette": "palette-10-...", "font": "font-10-...", "fallback": false }
     ```
4. **fallback 路徑**:暫時關閉 LLM port(或令其失敗)再生成 → 仍套到具名 theme(`selectedTheme` 非全 null),HTML 仍有風格。
5. **DB 無候選**:對空 `themes` 表生成 → 安全退回 default,`selectedTheme.fallback=true`,流程不報錯。

## 5. B 級效果肉眼驗證

- `style-10-glassmorphism`:卡片有 `backdrop-filter: blur(...)` 玻璃感。
- `style-10-aurora`/`style-10-gradient-mesh`:背景漸層動畫;開啟系統「減少動態」後動畫停止(keyframe 受 `prefers-reduced-motion` 守衛)。
- 檢查產出 HTML 的 `<style>`:新 token 值已 sanitize(非法 HEX/CSS 不出現)。

## 實作狀態清單

- [x] US1 selectTheme 必經 + 兩路徑套具名 theme(`selectedTheme` 入 summary)
- [x] US2 轉換腳本 + 全量 seed(font/palette/style;idempotent;kind-aware 驗證)
- [x] US3 B 級四類 token(blur/glow/grain/漸層動畫)+ B 級升 full
- [x] schema kind 欄 + 0001 migration + 選擇索引
- [x] 移除 CURATED_* 寫死資料、保留 compose 引擎、`selectDesignStyleKit`→`selectTheme`+`composeKit`
- [x] 全 monorepo 回歸綠燈

## 驗證證據(2026-06-06 回填)

- **0001 migration**(`0001_steep_mach_iv.sql`):`DROP INDEX themes_select_idx` → `ADD COLUMN kind text NOT NULL` → `CREATE INDEX themes_select_idx ON themes (kind, applies_to, support)`。
- **轉換腳本輸出**(`pnpm db:convert-seeds`):`fonts=57, palettes=96, styles=67`。
- **`pnpm db:seed` 列數/分佈**:`Seeded 220 theme(s): font=57, palette=96, style=67`;`style` 分佈 `full=20 / raw=47`(A 級 14 + B 級 6 升 full)。
- **`selectedTheme` 記錄**:兩路徑由 `slides-service.theme-selection.test.ts` 覆蓋(LLM-success 與 fallback 皆寫入 summary)。對 **live seeded DB**(173 個可選候選)跑 `selectTheme`,不同 brief → 不同三軸,且 B 級可被選中:
  - `"frosted glass dashboard"` → `style-10-glassmorphism` + `font-10-dashboard-data`(B 級)
  - `"brutalist raw poster"` → `style-10-brutalism` + `font-10-brutalist-raw`
  - `"aurora luminous gradient"` → `style-10-aurora-ui`(B 級);皆 `fallback=false`。
- **B 級效果快照**:`pnpm --filter @slides-agent/api preview:bgrade` 產出 6 份 HTML,Chrome 實測 blur/glow/grain/aurora/mesh 皆如預期(mesh 已修 `no-repeat` 不破圖、動畫層錨 `.deck::after` 確實顯示)。
- **`listSelectable` EXPLAIN(實測修正)**:在 220 列規模下,planner 走 **`themes_scope_idx`**(`Bitmap Index Scan on scope='builtin'` + Filter,Execution ~1.5ms),**並未**走 `(kind, applies_to, support)` 索引——因為 `listSelectable` 沒有 `kind =` 等值前綴(WHERE 為 `scope/active/applies_to IN/(kind<>style OR support<>raw)`)。此索引在現行查詢形狀下休眠;待 008 `scope=account` 列把表撐大時,依 US2 review 的 **M-1** 重設計索引(改 partial index 或以 `scope` 領頭)。資料量小時 planner 選 scope 索引屬正確行為,非缺陷。

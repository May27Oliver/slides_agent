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

產出 `src/infra/db/seeds/theme-fonts.json`(56)、`theme-palettes.json`(96)、`theme-styles.json`(67 骨架)。
**font/palette 自動轉完整;`style` kind 的 `styleKit` token 需人工補**(A 級對應 structure、C 級存 raw),補完 commit 進版控。`db:seed` 之後只讀這些 JSON,**不**再依賴 `.claude/skills`。

## 3. 灌 themes seed

```bash
pnpm db:seed         # accounts(006 既有)+ themes(007 新增,idempotent upsert)
```

驗證列數與標籤分佈:

```bash
psql slides_agent -c "SELECT kind, count(*) FROM themes GROUP BY kind;"
# 預期 font≈56、palette≈96、style≈67

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

- [ ] US1 selectTheme 必經 + 兩路徑套具名 theme(`selectedTheme` 入 summary)
- [ ] US2 轉換腳本 + 全量 seed(font/palette/style;idempotent;kind-aware 驗證)
- [ ] US3 B 級四類 token(blur/glow/grain/漸層動畫)+ B 級升 full
- [ ] schema kind 欄 + 0001 migration + 選擇索引
- [ ] 移除 CURATED_* 寫死資料、保留 compose 引擎、`selectDesignStyleKit`→`selectTheme`+`composeKit`
- [ ] 全 monorepo 回歸綠燈

## 驗證證據

- `0001_*.sql`(kind 欄 + 索引)、轉換腳本輸出、`db:seed` 列數/標籤分佈。
- `selectedTheme` 記錄(可由唯讀 API 回看)、不同 brief→不同 theme 的兩份 HTML、B 級效果快照。
- `listSelectable` 的 EXPLAIN 走 `(kind, applies_to, support)` 索引。

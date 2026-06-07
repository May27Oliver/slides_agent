# Quickstart: 008 chart-rendering

## 前置

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
```

008 本身不新增 DB migration;`db:migrate`/`db:seed` 是為了讓 007 builtin themes 可供 preview matrix 使用。

## 自動驗證

```bash
pnpm --filter @slides-agent/domain test
pnpm --filter @slides-agent/api test
```

預期覆蓋:

- metric value parsing。
- `ChartSeries` extraction / validation。
- pie/donut、line、bar SVG renderer。
- metric card、metric group、table、fallback HTML renderer。
- sanitize/self-contained guards。
- `VisualizationType → ChartTreatment` mapping。
- `renderTemplateDeck` 插入 chart visuals。
- preview matrix completeness smoke。

## 產生 chart × style preview matrix

```bash
pnpm --filter @slides-agent/api preview:chart-matrix
```

預期 script 產出:

```text
apps/api/preview/chart-matrix/
├── index.html
├── style-00-minimalism__pie_donut.html
├── style-00-minimalism__line.html
├── style-00-minimalism__bar.html
├── ...
└── matrix.json
```

每個已啟用 style 都應有:

- pie/donut chart
- line chart
- bar chart
- metric card
- metric group
- table
- fallback text

若新增 style 或 chart visual 但未補 preview case,script/test 必須 fail 並指出缺少組合。

## 肉眼檢查 checklist

打開:

```text
apps/api/preview/chart-matrix/index.html
```

逐 style 檢查:

- pie/donut label、legend、比例值清楚可讀。
- line chart 軸線、點、折線與 x labels 不重疊。
- bar chart label/value 不溢出。
- metric card / metric group 數字大小和容器協調。
- table 表頭/列距/截斷提示清楚。
- fallback text 不像壞圖,且有 review/fallback note。
- 深色/淺色/高彩度/玻璃/漸層/紙感等風格下對比足夠。
- slide keyboard navigation 仍可用。
- 窄寬度或縮放下 chart 不超出版面。

## Self-contained output check

抽查任一 matrix artifact:

```bash
rg -n "<script src=|<link href=|url\\(http|onclick=" apps/api/preview/chart-matrix
```

chart renderer 不應新增外部 runtime 或 event handler。既有 deck-level Google Fonts link 若存在,不算 chart runtime;chart fragment 本身不可新增外部資源。

## Demo path

1. 執行 `preview:chart-matrix`。
2. 開啟 matrix index。
3. 用 index 逐一打開至少一個 A 級與一個 B 級 style 的所有 chart visual。
4. 再抽查一個高彩度 palette 與一個 dark style。
5. 確認每個 chart 都有 source lineage data attributes,且 fallback cases 顯示合理文字。

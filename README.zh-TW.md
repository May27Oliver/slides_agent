# HTML 簡報生成器（HTML Slides Agent）

[English](README.md) · **繁體中文**

把原始文字（筆記、逐字稿、報告）轉成**可預覽、可下載的 HTML 簡報**——在本機執行,採用「LLM 輔助、確定性渲染」的流程。

貼上或上傳內容、選一種簡報風格,系統會規劃投影片、設計視覺系統,並產出一份 self-contained 的 16:9 HTML 簡報,可在 App 內預覽,也可下載成單一檔案。

---

## 功能特色

- **內容 → 簡報 pipeline**:語意切段 → 大綱規劃 → 設計規劃 → HTML 渲染 → 驗證。
- **LLM 輔助、確定性渲染**:LLM 負責語言／結構／設計「選型」;最終 HTML 由確定性、reference 級的模板渲染器產生(快、免費、穩定、必過驗證)。
- **UIUX Pro Max 設計系統**:依簡報需求挑選策展調色盤＋字型配對＋具體 style kit(字級、動態、效果)。見 [`docs/design.md`](docs/design.md)。
- **非同步預覽工作流**:送出工作 → 輪詢進度 → 取得結果,含逾時、失敗回報與可取消的輪詢 UI。
- **Self-contained 輸出**:單一 HTML 檔、inline CSS/JS、鍵盤導覽,唯一的外部資源是 Google Fonts。
- **忠於來源**:驗證器把關投影片順序、內容忠實度與數字保真,不捏造事實。
- **沒有 API 金鑰也能跑**:`OPENAI_API_KEY` 留空時,流程會走確定性 fallback。

---

## 架構

pnpm monorepo,核心領域邏輯乾淨、App 外殼輕薄。

| 套件 | 名稱 | 角色 |
|---|---|---|
| `packages/domain` | `@slides-agent/domain` | 純領域邏輯:切段、大綱/版面規劃、設計系統、渲染、預覽工作生命週期。無 I/O。 |
| `packages/contracts` | `@slides-agent/contracts` | 共用的請求/回應契約 + 執行期驗證器。 |
| `apps/api` | `@slides-agent/api` | NestJS 後端:REST 端點、LLM adapter(port)、預覽工作 store/runner。 |
| `apps/web` | `@slides-agent/web` | React + Vite 前端:輸入表單、風格預設、工作輪詢、預覽。 |

### 生成 pipeline

```
sourceContent + deckBrief
        │
        ▼ content_planning   語意切段（LLM,含確定性 fallback）
        ▼ deck_planning      大綱 + LLM 精修（來源忠實守門）
        ▼ design_planning    UIUX Pro Max 設計系統 + 策展 style kit 選型
        ▼ html_generation    確定性 reference 級模板渲染器
        ▼ html_validation    self-contained / 順序 / 內容 / 設計 檢查
        ▼
   PreviewArtifact（self-contained HTML）
```

LLM 呼叫都藏在 port 之後(adapter 模式);沒有設定金鑰時,每個階段都會確定性 fallback。HTML 階段為 **template-primary**:最終 HTML 由確定性渲染器產出,所以又快又一致、必過驗證。

---

## 環境需求

- Node.js `20.19.5`
- pnpm `10.30.3`（這是 **pnpm** 專案——請勿使用 `yarn`／`npm`）

> 專案在 `package.json` 釘了 `packageManager: pnpm@10.30.3`。若有 Corepack,執行 `corepack enable` 會自動使用正確版本。

## 安裝設定

```bash
cp .env.example .env      # 接著填入 OPENAI_API_KEY（可選）
pnpm install
```

## 設定（環境變數）

所有 LLM 設定都是**後端專用**,不會外洩到前端或 API 回應。設在根目錄 `.env`:

| 變數 | 預設 | 說明 |
|---|---|---|
| `PORT` | `3000` | API 伺服器埠號。 |
| `LLM_PROVIDER` | `openai` | LLM 供應商(僅支援 `openai`)。 |
| `OPENAI_API_KEY` | — | OpenAI 金鑰。**留空 → 走確定性 fallback**(App 仍可用)。 |
| `LLM_MODEL` | — | 所有 LLM 操作的預設模型。 |
| `SEMANTIC_SEGMENTATION_MODEL` | `LLM_MODEL` | 可選的單一操作模型覆寫。 |
| `DESIGN_PLANNING_MODEL` | `LLM_MODEL` | 可選的單一操作模型覆寫。 |
| `LLM_MAX_REPAIR_ATTEMPTS` | `1` | 驗證型 LLM 輸出的修補次數上限。 |
| `PREVIEW_RATE_LIMIT_MAX` | `5` | 每個來源 IP 在時間窗內的預覽 POST 上限。 |
| `PREVIEW_RATE_LIMIT_WINDOW_MS` | `60000` | rate-limit 時間窗(毫秒)。 |
| `VITE_API_PROXY_TARGET` | `http://localhost:3000` | (web)dev 伺服器的 API proxy 目標。 |

---

## 本機執行

一個指令(把目前 iTerm2 分頁切成兩個 pane:API + web):

```bash
pnpm dev:iterm
```

預覽生成以**非同步 job**形式跑在 **Redis + BullMQ** 佇列上,由一個獨立的
**worker** 程序消費——這樣 LLM 在生成時 API 仍能即時回應。Redis 為**必要**,
請先啟動:

```bash
docker run --rm -p 6379:6379 --name slides-redis redis:7
```

接著分別手動啟動各程序:

```bash
# 後端 API（watch 模式,變更自動重啟）→ http://localhost:3000
pnpm --filter @slides-agent/api dev

# 預覽 job worker（獨立、非 HTTP 程序;消費佇列）
pnpm --filter @slides-agent/api worker:dev

# 前端（Vite HMR）→ http://localhost:5173
pnpm --filter @slides-agent/web dev -- --host localhost --port 5173
```

開啟 <http://localhost:5173>。前端 dev 伺服器會把 `/api/*` proxy 到 API(可用 `VITE_API_PROXY_TARGET` 覆寫)。

### 煙霧測試

```bash
curl -I http://localhost:5173/                                 # 前端存活
curl -i http://localhost:3000/api/slides/preview-jobs/example   # → 404 PREVIEW_JOB_UNAVAILABLE
```

---

## API

基底路徑:`/api/slides`

| 方法 | 路徑 | 說明 |
|---|---|---|
| `POST` | `/preview` | 同步生成預覽,回傳完整 artifact。 |
| `POST` | `/preview-jobs` | 建立非同步預覽工作 → `202`,含 `jobId` 與 `statusUrl`。 |
| `GET` | `/preview-jobs/:jobId` | 輪詢工作狀態/結果(未知或過期 → `404 PREVIEW_JOB_UNAVAILABLE`)。 |

請求 body(兩個 POST 通用):

```jsonc
{
  "sourceContent": "…你的筆記/逐字稿…",        // 必填,≤ 50,000 字
  "deckBrief": {
    "purpose": "面試",                          // 必填
    "audience": "長官",                         // 必填
    "styleDirection": "專業商務",               // 可選,引導設計 kit
    "chartEmphasis": "…",                       // 可選
    "segmentationGuidance": "…",                // 可選
    "language": "zh-TW"                          // 可選
  }
}
```

兩個 POST 端點**共用**同一個 per-IP rate-limit 預算;來源與簡報欄位都有長度上限。

---

## 測試

```bash
pnpm test                                   # 全部套件（domain、contracts、api、web）
pnpm --filter @slides-agent/domain test     # 單一套件
pnpm --filter @slides-agent/web test:e2e    # Playwright E2E
```

型別檢查:`pnpm --filter <name> exec tsc --noEmit`(各套件的 `build` script 即為 no-emit 型別檢查)。

---

## 專案結構

```
apps/
  api/        NestJS 後端（controller、LLM adapter、預覽工作 store/runner）
  web/        React + Vite 前端（表單、風格預設、輪詢、預覽）
packages/
  domain/     純領域邏輯（切段、deck/design/render、preview-job）
  contracts/  共用契約 + 驗證器
docs/
  design.md   設計系統架構 + 如何新增設計 skill
specs/        功能規格（003-async-preview-jobs）
```

---

## 備註

- **沒金鑰也能用**:每個 LLM 階段都有確定性 fallback;品質會優雅降級,不會壞掉。
- **Self-contained 輸出**:產出的 HTML 只外連 Google Fonts,其餘全部 inline;預覽在 sandboxed iframe 內執行。
- **設計可擴充**:要新增設計 skill(調色盤/字型/風格),見 [`docs/design.md`](docs/design.md) 的 provider/registry 指南。

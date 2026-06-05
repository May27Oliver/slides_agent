# Contract: Decks 唯讀 API

**Branch**: `006-db-persistence`

兩個端點皆受 `JwtAuthGuard` 保護,且**強制 `account_id = 當前使用者`**。錯誤形狀沿用既有
`AuthErrorContract`(`AUTH_REQUIRED`)與 not-found 慣例。

---

## GET /api/decks

列出當前使用者的簡報(新到舊)。本版不分頁。

**Auth**: `Authorization: Bearer <jwt>` 必要。

**200 回應**(`DeckListResponseContract`):

```jsonc
{
  "decks": [
    {
      "id": "f3c…uuid",
      "title": "Q2 業務回顧",
      "status": "ready",
      "updatedAt": "2026-06-05T08:12:00.000Z"
    }
  ]
}
```

- 僅含 summary 欄位(`id/title/status/updatedAt`),**不回 html/slide_deck**(列表查詢不觸碰重欄位)。
- 空清單回 `{ "decks": [] }`。

**401**:未帶/無效 JWT → `{ "code": "AUTH_REQUIRED", "message": … }`。

---

## GET /api/decks/:id

取單份簡報內容(當前使用者擁有者)。

**Auth**: 必要。

**200 回應**(`DeckDetailResponseContract`):

```jsonc
{
  "id": "f3c…uuid",
  "title": "Q2 業務回顧",
  "status": "ready",
  "sourceContent": "…",
  "deckBrief": { "purpose": "…", "audience": "…" },
  "currentRevision": {
    "revision": 1,
    "slideDeck": { /* 結構化 SlideDeck */ },
    "designPlan": { /* DesignPlanningResult，可為 null */ },
    "html": "<!doctype html>…",
    "generationSummary": { /* 可為 null */ },
    "origin": "generation",
    "sourceJobId": "preview_job_…",
    "createdAt": "2026-06-05T08:12:00.000Z"
  }
}
```

- 回傳 `current_revision_id` 指向的那一版。

**401**:未帶/無效 JWT → `AUTH_REQUIRED`。

**404**:deckId 不存在 **或屬於其他帳號** → 統一 not-found(不揭露存在與否):

```jsonc
{ "code": "DECK_NOT_FOUND", "message": "Deck not found." }
```

**400**:deckId 非合法 uuid → 沿用既有 param 驗證錯誤形狀(對齊 preview-jobs 的 `assertValidJobId` 慣例,新增 `assertValidDeckId`)。

---

## Contract 型別(packages/contracts/src/deck.ts)

```ts
export interface DeckSummaryContract { id: string; title: string; status: string; updatedAt: string; }
export interface DeckListResponseContract { decks: DeckSummaryContract[]; }

export interface DeckRevisionContract {
  revision: number;
  slideDeck: unknown;            // 結構化 SlideDeck（前端不重新定義 domain 型別）
  designPlan: unknown | null;
  html: string | null;
  generationSummary: unknown | null;
  origin: "generation" | "edit";
  sourceJobId: string | null;
  createdAt: string;
}
export interface DeckDetailResponseContract {
  id: string; title: string; status: string;
  sourceContent: string; deckBrief: unknown;
  currentRevision: DeckRevisionContract;
}

export interface DeckNotFoundContract { code: "DECK_NOT_FOUND"; message: string; }
```

- OpenAPI:於既有手刻 `openapi-document.ts` 補上這兩個端點 + schema(沿用 005/004 的作法,因 tsx 無 reflection)。

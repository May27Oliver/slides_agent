# Data Model: 006 db-persistence

**Branch**: `006-db-persistence` | **Date**: 2026-06-05

domain 概念 → DB 表的對映。設計原則:**結構化資料為事實來源、HTML 為衍生快取;domain 不含 SQL**。

> 與 spec 的差異(plan 階段精煉):`username` 改用 `text` + 應用層 lowercase 正規化(沿用 005 `ConfiguredUserAccountStore` 既有行為),**不採 citext**——免 extension 依賴、相容 pglite 測試。

---

## 實體與關係

```
accounts 1 ──< decks 1 ──< deck_revisions
                 └ current_revision_id ─(軟參照)→ deck_revisions.id

themes (獨立,006 僅建結構;account_id 選擇性參照 accounts)
```

---

## 表定義

### accounts(對應 domain `UserAccount`)

| 欄位 | 型別 | 約束 |
|---|---|---|
| id | text | PK(沿用 `user_owner` 這種 id,= JWT `sub`) |
| username | text | NOT NULL、UNIQUE(存正規化後的 lowercase) |
| display_name | text | NOT NULL |
| password_hash | text | NOT NULL(scrypt `salt:hash`) |
| active | boolean | NOT NULL DEFAULT true |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| updated_at | timestamptz | NOT NULL DEFAULT now() |

- 查詢一律以正規化 username 比對(`username.trim().toLowerCase()`),與 005 一致。

### decks(一份簡報)

| 欄位 | 型別 | 約束 |
|---|---|---|
| id | uuid | PK DEFAULT gen_random_uuid() |
| account_id | text | NOT NULL,FK→accounts(id) ON DELETE CASCADE |
| title | text | NOT NULL(取自 `SlideDeck.title`) |
| status | text | NOT NULL（本版恆 `ready`；失敗不落 DB） |
| source_content | text | NOT NULL（原始輸入，可重生/追溯） |
| deck_brief | jsonb | NOT NULL（`DeckBrief`） |
| current_revision_id | uuid | NULL（軟參照最新 revision，app 維護） |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| updated_at | timestamptz | NOT NULL DEFAULT now() |

- INDEX `decks_account_updated_idx` ON `(account_id, updated_at DESC)`。
- `current_revision_id` 不設硬 FK(避免與 deck_revisions 的循環 FK);由 app 在寫入 revision 後更新。

### deck_revisions(每次生成/編輯的整份快照)

| 欄位 | 型別 | 約束 |
|---|---|---|
| id | uuid | PK DEFAULT gen_random_uuid() |
| deck_id | uuid | NOT NULL,FK→decks(id) ON DELETE CASCADE |
| revision | integer | NOT NULL（每 deck 遞增 1,2,3…） |
| slide_deck | jsonb | NOT NULL（結構化 `SlideDeck` = 事實來源） |
| design_plan | jsonb | NULL（`DesignPlanningResult`，含 styleKit） |
| html | text | NULL（渲染快取，可由 slide_deck+design_plan 重算） |
| generation_summary | jsonb | NULL |
| origin | text | NOT NULL（`generation` \| `edit`；本版只產 `generation`） |
| source_job_id | text | NULL（追溯 preview job） |
| created_at | timestamptz | NOT NULL DEFAULT now() |

- UNIQUE `(deck_id, revision)`;INDEX `(deck_id, revision DESC)`。

### themes（006 僅建結構,內容由 007 灌——見 `THEME_SEED_INVENTORY.md`）

| 欄位 | 型別 | 約束 |
|---|---|---|
| id | text | PK |
| scope | text | NOT NULL（`builtin` \| `account`） |
| account_id | text | NULL,FK→accounts(id) ON DELETE CASCADE |
| name | text | NOT NULL |
| description | text | NULL |
| keywords | jsonb | NOT NULL DEFAULT '[]' |
| applies_to | text | NOT NULL（presentation \| landing \| dashboard \| universal） |
| support | text | NOT NULL（full \| partial \| raw） |
| style_kit | jsonb | NOT NULL（`DesignStyleKit` token；載入時驗證 + 既有 sanitize） |
| active | boolean | NOT NULL DEFAULT true |
| created_at / updated_at | timestamptz | NOT NULL DEFAULT now() |

- INDEX `(scope)`、`(account_id)`、`(applies_to, support)`。006 不寫入任何列。

---

## domain 型別(packages/domain/src/deck-persistence/)

```ts
// deck.types.ts —— 純語言,不含 DB
export type DeckOrigin = "generation" | "edit";

export interface DeckRevision {
  revision: number;
  slideDeck: SlideDeck;                 // 事實來源
  designPlan: DesignPlanningResult | null;
  html: string | null;                  // 衍生快取
  generationSummary: GenerationSummary | null;
  origin: DeckOrigin;
  sourceJobId: string | null;
}

export interface Deck {
  accountId: string;
  title: string;
  status: "ready" | "failed";
  sourceContent: string;
  deckBrief: DeckBrief;
  revision: DeckRevision;               // 建立當下的首版
}
```

```ts
// deck-store.port.ts —— adapter 邊界
export interface DeckSummary { id: string; title: string; status: string; updatedAt: string; }

export interface DeckStore {
  // 寫入一份新 deck（含首版 revision），回傳 deckId；交易內完成並設 current_revision_id
  saveNewDeck(deck: Deck): Promise<{ deckId: string }>;
  listByAccount(accountId: string): Promise<DeckSummary[]>;            // 新到舊
  findByIdForAccount(accountId: string, deckId: string): Promise<DeckDetail | null>; // 隔離
}
```

```ts
// create-deck-from-preview.ts —— 純對映（首批 TDD 目標）
export function createDeckFromPreviewResult(input: {
  accountId: string;
  request: PreviewJobRequest;     // sourceContent + deckBrief
  result: PreviewResult;          // slideDeck + designPlanningResult + previewArtifact
  sourceJobId: string;
}): Deck;
```

---

## 持久化流程(auto-save)

1. controller 建 job 時把 `accountId`(來自 `req.user`)寫入 job payload。
   → 需於 `PreviewJobRequest`/序列化加 `accountId`(向後相容:舊 job 無此欄位則略過存檔)。
2. worker 生成**成功**後:`createDeckFromPreviewResult(...)` → `DeckStore.saveNewDeck(...)`。
3. `saveNewDeck` 在一個交易內:insert `decks` → insert `deck_revisions(revision=1, origin='generation')` → update `decks.current_revision_id`。
4. 持久化**失敗**:catch、記錄內部錯誤(對齊既有錯誤形狀)、**不改變 job 的 succeeded 結果**(clarify 決議)。

---

## Drizzle schema 草案(apps/api/src/infra/db/schema.ts)

```ts
import { pgTable, text, uuid, integer, boolean, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const decks = pgTable("decks", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status").notNull(),
  sourceContent: text("source_content").notNull(),
  deckBrief: jsonb("deck_brief").notNull(),
  currentRevisionId: uuid("current_revision_id"),  // 軟參照
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ accountUpdated: index("decks_account_updated_idx").on(t.accountId, t.updatedAt) }));

export const deckRevisions = pgTable("deck_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  deckId: uuid("deck_id").notNull().references(() => decks.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull(),
  slideDeck: jsonb("slide_deck").notNull(),
  designPlan: jsonb("design_plan"),
  html: text("html"),
  generationSummary: jsonb("generation_summary"),
  origin: text("origin").notNull(),
  sourceJobId: text("source_job_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ deckRev: uniqueIndex("deck_revisions_deck_rev_idx").on(t.deckId, t.revision) }));

export const themes = pgTable("themes", {
  id: text("id").primaryKey(),
  scope: text("scope").notNull(),
  accountId: text("account_id").references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  keywords: jsonb("keywords").notNull().default([]),
  appliesTo: text("applies_to").notNull(),
  support: text("support").notNull(),
  styleKit: jsonb("style_kit").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  scopeIdx: index("themes_scope_idx").on(t.scope),
  accountIdx: index("themes_account_idx").on(t.accountId),
  selectIdx: index("themes_select_idx").on(t.appliesTo, t.support),
}));
```

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { DeckDetailResponseContract, DeckSummaryContract } from "@slides-agent/contracts";
import { useAuth } from "@/features/auth/AuthProvider";
import { AuthError } from "@/features/auth/auth-client";
import { getDeck, listDecks } from "@/features/decks/decks-client";
import { filterDecksByTitle } from "@/features/deck-switcher/recent-decks";
import { useI18n } from "@/i18n";

type LoadState = "loading" | "ready" | "error";

/**
 * Minimal "my decks" screen (006 US3): a list of the signed-in user's decks and
 * an inline read-only preview of the selected deck's current revision. Reads go
 * through the auth-aware fetch, so a 401 redirects to /login via AuthProvider.
 */
export function MyDecksView() {
  const { authFetch, logout, user } = useAuth();
  const { t } = useI18n();
  const [state, setState] = useState<LoadState>("loading");
  const [decks, setDecks] = useState<DeckSummaryContract[]>([]);
  const [selected, setSelected] = useState<DeckDetailResponseContract | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    listDecks(authFetch)
      .then((result) => {
        if (!cancelled) {
          setDecks(result.decks);
          setState("ready");
        }
      })
      .catch((error) => {
        // AuthError already triggered a redirect to /login; don't flash an error.
        if (!cancelled && !(error instanceof AuthError)) {
          setState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const openDeck = useCallback(
    (id: string) => {
      getDeck(id, authFetch)
        .then((detail) => setSelected(detail))
        .catch((error) => {
          if (!(error instanceof AuthError)) {
            setState("error");
          }
        });
    },
    [authFetch]
  );

  return (
    <div className="min-h-screen bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-panel px-5 py-2 text-sm">
        <Link to="/" className="font-medium text-brand-700 hover:underline">
          {t("decks.create")}
        </Link>
        <div className="flex items-center gap-3">
          {user ? <span className="text-ink-soft">{user.displayName}</span> : null}
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg border border-line px-3 py-1 font-medium text-ink hover:bg-surface"
          >
            {t("decks.logout")}
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-5 py-8">
        {selected ? (
          <DeckDetailView detail={selected} onBack={() => setSelected(null)} />
        ) : (
          <DeckList state={state} decks={decks} onOpen={openDeck} />
        )}
      </main>
    </div>
  );
}

function DeckList({
  state,
  decks,
  onOpen
}: {
  state: LoadState;
  decks: DeckSummaryContract[];
  onOpen: (id: string) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const filtered = filterDecksByTitle(decks, query);

  return (
    <section>
      <header className="mb-5">
        <h1 className="text-xl font-bold text-ink">{t("decks.heading")}</h1>
        <p className="mt-1 text-sm text-ink-soft">{t("decks.subtitle")}</p>
      </header>

      {state === "ready" && decks.length > 0 ? (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("switcher.search")}
          aria-label={t("switcher.search")}
          className="mb-4 w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
        />
      ) : null}

      {state === "loading" ? <p className="text-sm text-ink-soft">{t("decks.loading")}</p> : null}
      {state === "error" ? <p className="text-sm text-red-600">{t("decks.error")}</p> : null}
      {state === "ready" && decks.length === 0 ? (
        <p className="text-sm text-ink-soft">{t("decks.empty")}</p>
      ) : null}
      {state === "ready" && decks.length > 0 && filtered.length === 0 ? (
        <p className="text-sm text-ink-soft">{t("switcher.empty")}</p>
      ) : null}

      {state === "ready" && filtered.length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
          {filtered.map((deck) => (
            <li key={deck.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{deck.title}</p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {statusLabel(deck.status, t)} · {formatDate(deck.updatedAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpen(deck.id)}
                  className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink transition-colors duration-200 hover:bg-surface"
                >
                  {t("decks.open")}
                </button>
                <Link
                  to={`/decks/${deck.id}/edit`}
                  className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-brand-800"
                >
                  {t("switcher.edit")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function DeckDetailView({
  detail,
  onBack
}: {
  detail: DeckDetailResponseContract;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const html = detail.currentRevision?.html ?? null;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="truncate text-xl font-bold text-ink">{detail.title}</h1>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 cursor-pointer rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink transition-colors duration-200 hover:bg-surface"
        >
          {t("decks.back")}
        </button>
      </div>

      {html ? (
        <iframe
          className="h-[clamp(420px,60vh,760px)] w-full overflow-hidden rounded-2xl border border-line bg-[#0b1512]"
          srcDoc={html}
          title={t("preview.iframeTitle")}
          // Same sandbox posture as the live preview: untrusted deck HTML gets an
          // opaque origin (no parent/storage/cookie access); allow-scripts keeps
          // keyboard navigation working.
          sandbox="allow-scripts"
          allow="fullscreen"
          referrerPolicy="no-referrer"
        />
      ) : (
        <p className="text-sm text-ink-soft">{t("decks.empty")}</p>
      )}
    </section>
  );
}

function statusLabel(
  status: string,
  t: (key: "decks.status.ready" | "decks.status.failed") => string
): string {
  if (status === "ready") {
    return t("decks.status.ready");
  }
  if (status === "failed") {
    return t("decks.status.failed");
  }
  return status;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

import { useState } from "react";
import { fetchOwner, triggerIngest, type Repo } from "./api";
import RepoList   from "./components/RepoList";
import RepoDetail from "./components/RepoDetail";

type View =
  | { kind: "home" }
  | { kind: "loading"; owner: string }
  | { kind: "list";   owner: string; repos: Repo[]; fetched_at: string | null }
  | { kind: "detail"; owner: string; repo: Repo };

export default function App() {
  const [view,  setView]  = useState<View>({ kind: "home" });
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const owner = query.trim();
    if (!owner) return;
    setError(null);
    setView({ kind: "loading", owner });

    try {
      const data = await fetchOwner(owner);
      setView({ kind: "list", owner, repos: data.repos, fetched_at: data.fetched_at });
      return;
    } catch {
      // not in DB yet — run ingest
    }

    try {
      await triggerIngest(owner);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setView({ kind: "home" });
      return;
    }

    try {
      const data = await fetchOwner(owner);
      setView({ kind: "list", owner, repos: data.repos, fetched_at: data.fetched_at });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setView({ kind: "home" });
    }
  }

  async function handleRefresh(owner: string) {
    setView({ kind: "loading", owner });
    setError(null);
    try {
      await triggerIngest(owner);
      const data = await fetchOwner(owner);
      setView({ kind: "list", owner, repos: data.repos, fetched_at: data.fetched_at });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Refresh failed");
      // Fall back to whatever is cached in the DB rather than showing an empty list
      try {
        const data = await fetchOwner(owner);
        setView({ kind: "list", owner, repos: data.repos, fetched_at: data.fetched_at });
      } catch {
        setView({ kind: "home" });
      }
    }
  }

  const isHome = view.kind === "home";

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Nav */}
      <div style={{ borderBottom: "1px solid var(--border)", marginBottom: isHome ? 0 : "44px" }}>
        <div style={{ maxWidth: "860px", margin: "0 auto", padding: "0 32px", height: "64px", display: "flex", alignItems: "center" }}>
          <span
            onClick={() => { setView({ kind: "home" }); setQuery(""); setError(null); }}
            style={{ fontFamily: "var(--serif)", fontSize: "22px", fontWeight: 300, letterSpacing: "0.4px", cursor: "pointer", color: "var(--text)" }}
          >
            GitHub Health
          </span>
        </div>
      </div>

      {/* Home hero */}
      {isHome && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 64px)", padding: "0 32px 80px", textAlign: "center" }}>
          <p style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "3px", textTransform: "uppercase", color: "var(--dim)", marginBottom: "24px" }}>
            Repository Intelligence
          </p>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(40px, 5vw, 64px)", fontWeight: 300, color: "var(--text)", margin: "0 0 20px", letterSpacing: "-1px", lineHeight: 1.1 }}>
            How healthy are your repos?
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "17px", margin: "0 0 48px", maxWidth: "460px", lineHeight: 1.7 }}>
            Score commit activity, PR hygiene, and issue resolution across any public GitHub profile.
          </p>

          <form onSubmit={handleSearch} style={{ display: "flex", width: "min(580px, 100%)" }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="github username or org"
              style={{
                flex: 1, padding: "14px 20px",
                background: "var(--surface)", border: "1px solid var(--border)", borderRight: "none",
                borderRadius: "var(--radius) 0 0 var(--radius)", color: "var(--text)",
                fontSize: "16px", outline: "none",
              }}
              onFocus={e => (e.target.style.borderColor = "var(--accent)")}
              onBlur={e  => (e.target.style.borderColor = "var(--border)")}
            />
            <button
              type="submit"
              style={{
                padding: "14px 32px", background: "var(--accent)", color: "var(--bg)",
                borderRadius: "0 var(--radius) var(--radius) 0",
                fontSize: "15px", fontWeight: 500,
                whiteSpace: "nowrap", letterSpacing: "0.2px",
              }}
            >
              Analyze
            </button>
          </form>

          {error && (
            <p style={{ color: "var(--bad-text)", marginTop: "20px", padding: "12px 20px", background: "var(--bad-bg)", borderRadius: "var(--radius)", border: "1px solid var(--bad-border)", fontSize: "14px" }}>
              {error}
            </p>
          )}

          <p style={{ color: "var(--dim)", fontSize: "13px", marginTop: "16px" }}>
            First-time analysis takes ~20 seconds — fetches live data.
          </p>
        </div>
      )}

      {/* Content area (non-home) */}
      {!isHome && (
        <div style={{ maxWidth: "860px", margin: "0 auto", padding: "0 32px 60px" }}>

          {/* Compact search bar on list/detail/loading views */}
          {view.kind !== "detail" && (
            <form onSubmit={handleSearch} style={{ display: "flex", width: "min(520px, 100%)", marginBottom: "40px" }}>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="github username or org"
                style={{
                  flex: 1, padding: "11px 16px",
                  background: "var(--surface)", border: "1px solid var(--border)", borderRight: "none",
                  borderRadius: "var(--radius) 0 0 var(--radius)", color: "var(--text)",
                  fontSize: "15px", outline: "none",
                }}
                onFocus={e => (e.target.style.borderColor = "var(--accent)")}
                onBlur={e  => (e.target.style.borderColor = "var(--border)")}
              />
              <button
                type="submit"
                disabled={view.kind === "loading"}
                style={{
                  padding: "11px 24px", background: "var(--accent)", color: "var(--bg)",
                  borderRadius: "0 var(--radius) var(--radius) 0",
                  fontSize: "15px", fontWeight: 500, opacity: view.kind === "loading" ? 0.6 : 1,
                }}
              >
                {view.kind === "loading" ? "Analyzing…" : "Analyze"}
              </button>
            </form>
          )}

          {error && (
            <p style={{ color: "var(--bad-text)", marginBottom: "20px", padding: "12px 20px", background: "var(--bad-bg)", borderRadius: "var(--radius)", border: "1px solid var(--bad-border)", fontSize: "14px" }}>
              {error}
            </p>
          )}

          {view.kind === "loading" && (
            <div style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: "10px", fontSize: "15px" }}>
              <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>↻</span>
              Fetching repos for <strong style={{ color: "var(--text)", fontWeight: 600 }}>{view.owner}</strong>…
            </div>
          )}

          {view.kind === "list" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
                <span />
                <button
                  onClick={() => handleRefresh(view.owner)}
                  style={{ background: "none", color: "var(--muted)", fontSize: "13px", padding: "4px 0", border: "none", letterSpacing: "0.2px" }}
                >
                  ↻ Refresh
                </button>
              </div>
              <RepoList
                owner={view.owner}
                repos={view.repos}
                onSelect={repo => setView({ kind: "detail", owner: view.owner, repo })}
              />
            </>
          )}

          {view.kind === "detail" && (
            <RepoDetail
              owner={view.owner}
              repoName={view.repo.name}
              onBack={() => {
                fetchOwner(view.owner).then(data =>
                  setView({ kind: "list", owner: view.owner, repos: data.repos, fetched_at: data.fetched_at })
                );
              }}
            />
          )}
        </div>
      )}
    </>
  );
}

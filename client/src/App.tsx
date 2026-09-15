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

    // Try to load existing data first
    try {
      const data = await fetchOwner(owner);
      setView({ kind: "list", owner, repos: data.repos, fetched_at: data.fetched_at });
      return;
    } catch {
      // Not in DB yet — run ingest
    }

    try {
      await triggerIngest(owner);
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
    }
  }

  return (
    <div style={{ maxWidth: "780px", margin: "0 auto", padding: "40px 20px" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1
          onClick={() => { setView({ kind: "home" }); setQuery(""); setError(null); }}
          style={{ fontSize: "24px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "10px" }}
        >
          <span style={{ fontSize: "22px" }}>⬡</span> GitHub Health
        </h1>
        <p style={{ color: "var(--muted)", marginTop: "4px" }}>
          Analyze the activity and health of any public GitHub profile.
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} style={{ display: "flex", gap: "8px", marginBottom: "32px" }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Enter a GitHub username or org…"
          style={{
            flex:         1,
            padding:      "10px 14px",
            background:   "var(--surface)",
            border:       "1px solid var(--border)",
            borderRadius: "var(--radius)",
            color:        "var(--text)",
            fontSize:     "15px",
            outline:      "none",
          }}
          onFocus={e => (e.target.style.borderColor = "var(--accent)")}
          onBlur={e  => (e.target.style.borderColor = "var(--border)")}
        />
        <button
          type="submit"
          disabled={view.kind === "loading"}
          style={{
            padding:      "10px 20px",
            background:   "var(--accent)",
            color:        "#0d1117",
            borderRadius: "var(--radius)",
            fontWeight:   600,
            fontSize:     "15px",
            opacity:      view.kind === "loading" ? 0.6 : 1,
          }}
        >
          {view.kind === "loading" ? "Analyzing…" : "Analyze"}
        </button>
      </form>

      {error && (
        <p style={{ color: "var(--red)", marginBottom: "16px", padding: "12px 16px", background: "rgba(248,81,73,0.1)", borderRadius: "var(--radius)", border: "1px solid var(--red)" }}>
          {error}
        </p>
      )}

      {/* Loading state */}
      {view.kind === "loading" && (
        <div style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>↻</span>
          Fetching repos for <strong style={{ color: "var(--text)" }}>{view.owner}</strong>…
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Repo list */}
      {view.kind === "list" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <span />
            <button
              onClick={() => handleRefresh(view.owner)}
              style={{ background: "none", color: "var(--muted)", fontSize: "13px", padding: "4px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}
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

      {/* Repo detail */}
      {view.kind === "detail" && (
        <RepoDetail
          owner={view.owner}
          repoName={view.repo.name}
          onBack={() => {
            // Go back to list — re-fetch from DB (instant, no ingest)
            fetchOwner(view.owner).then(data =>
              setView({ kind: "list", owner: view.owner, repos: data.repos, fetched_at: data.fetched_at })
            );
          }}
        />
      )}

      {/* Home empty state */}
      {view.kind === "home" && (
        <div style={{ textAlign: "center", color: "var(--muted)", marginTop: "60px" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>⬡</div>
          <p>Enter a GitHub username or org to get started.</p>
          <p style={{ fontSize: "12px", marginTop: "8px" }}>
            First-time analysis fetches live data — takes ~20s per profile.
          </p>
        </div>
      )}
    </div>
  );
}

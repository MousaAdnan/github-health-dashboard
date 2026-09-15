import type { Repo } from "../api";
import HealthBadge from "./HealthBadge";

interface Props {
  owner: string;
  repos: Repo[];
  onSelect: (repo: Repo) => void;
}

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30)  return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const COL = "1fr 120px 110px 100px";

export default function RepoList({ owner, repos, onSelect }: Props) {
  return (
    <div>
      <p style={{ color: "var(--muted)", marginBottom: "18px", fontSize: "15px" }}>
        {repos.length} public repos for <strong style={{ color: "var(--text)", fontWeight: 600 }}>{owner}</strong>
      </p>

      {/* Column headers */}
      <div style={{
        display: "grid", gridTemplateColumns: COL, gap: "16px",
        padding: "0 20px 10px", borderBottom: "1px solid var(--border)",
      }}>
        {["Repository", "Language", "Last pushed", "Health"].map(h => (
          <span key={h} style={{ fontSize: "11px", fontWeight: 600, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div style={{ border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 var(--radius) var(--radius)", overflow: "hidden" }}>
        {repos.map((repo, i) => (
          <button
            key={repo.id}
            onClick={() => onSelect(repo)}
            style={{
              display:             "grid",
              gridTemplateColumns: COL,
              alignItems:          "center",
              gap:                 "16px",
              padding:             "18px 20px",
              width:               "100%",
              background:          "var(--bg)",
              borderBottom:        i < repos.length - 1 ? "1px solid var(--row-div)" : "none",
              color:               "var(--text)",
              textAlign:           "left",
              transition:          "background 0.12s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--surface)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--bg)")}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: "16px", letterSpacing: "-0.1px" }}>{repo.name}</div>
              {repo.description
                ? <div style={{ color: "var(--muted)", fontSize: "13px", marginTop: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{repo.description.length > 50 ? repo.description.slice(0, 50) + "…" : repo.description}</div>
                : <div style={{ color: "var(--dim)", fontSize: "13px", marginTop: "3px", fontStyle: "italic" }}>No description</div>
              }
            </div>
            <span style={{ color: "var(--muted)", fontSize: "14px" }}>{repo.language ?? "—"}</span>
            <span style={{ color: "var(--muted)", fontSize: "14px" }}>{timeAgo(repo.last_pushed)}</span>
            <HealthBadge score={repo.health} />
          </button>
        ))}
      </div>
    </div>
  );
}

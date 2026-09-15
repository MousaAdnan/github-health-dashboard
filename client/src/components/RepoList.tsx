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

export default function RepoList({ owner, repos, onSelect }: Props) {
  return (
    <div>
      <p style={{ color: "var(--muted)", marginBottom: "16px" }}>
        {repos.length} public repos for <strong style={{ color: "var(--text)" }}>{owner}</strong>
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {repos.map(repo => (
          <button
            key={repo.id}
            onClick={() => onSelect(repo)}
            style={{
              display:         "grid",
              gridTemplateColumns: "1fr auto auto auto",
              alignItems:      "center",
              gap:             "16px",
              padding:         "14px 16px",
              background:      "var(--surface)",
              border:          "1px solid var(--border)",
              borderRadius:    "var(--radius)",
              color:           "var(--text)",
              textAlign:       "left",
              transition:      "border-color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: "15px" }}>{repo.name}</div>
              {repo.description && (
                <div style={{ color: "var(--muted)", fontSize: "13px", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "380px" }}>
                  {repo.description}
                </div>
              )}
            </div>
            <span style={{ color: "var(--muted)", fontSize: "12px", whiteSpace: "nowrap" }}>
              {repo.language ?? "—"}
            </span>
            <span style={{ color: "var(--muted)", fontSize: "12px", whiteSpace: "nowrap" }}>
              {timeAgo(repo.last_pushed)}
            </span>
            <HealthBadge score={repo.health} />
          </button>
        ))}
      </div>
    </div>
  );
}

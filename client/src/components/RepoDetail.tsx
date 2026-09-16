import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { fetchRepo, type RepoDetail as Detail } from "../api";
import HealthBadge from "./HealthBadge";

interface Props {
  owner: string;
  repoName: string;
  onBack: () => void;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      padding:      "24px 28px",
      background:   "var(--surface)",
      border:       "1px solid var(--border)",
      borderRadius: "var(--radius)",
      flex:         "1",
      minWidth:     "160px",
    }}>
      <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--serif)", fontSize: "48px", fontWeight: 300, color: "var(--text)", lineHeight: 1, marginBottom: "8px" }}>
        {value}
      </div>
      {sub && <div style={{ color: "var(--dim)", fontSize: "13px" }}>{sub}</div>}
    </div>
  );
}

export default function RepoDetail({ owner, repoName, onBack }: Props) {
  const [data,    setData]    = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchRepo(owner, repoName)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [owner, repoName]);

  if (loading) return <p style={{ color: "var(--muted)" }}>Loading…</p>;
  if (error)   return <p style={{ color: "var(--bad-text)" }}>Error: {error}</p>;
  if (!data)   return null;

  const { repo, commits, stats } = data;

  const chartData = commits.slice(-26).map(w => ({
    week:    w.week_start.slice(5),
    commits: w.count,
  }));

  const totalCommits = commits.reduce((s, w) => s + w.count, 0);
  const avgPerWeek   = commits.length ? (totalCommits / commits.length).toFixed(1) : "0";

  return (
    <div>
      {/* Back */}
      <button
        onClick={onBack}
        style={{ background: "none", color: "var(--accent)", marginBottom: "32px", padding: 0, fontSize: "14px", fontWeight: 500, display: "flex", alignItems: "center", gap: "6px" }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 3L5 8l5 5" />
        </svg>
        All repos
      </button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "10px", flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: "40px", fontWeight: 300, color: "var(--text)", margin: 0, letterSpacing: "-0.5px", lineHeight: 1.1 }}>
          {repo.name}
        </h2>
        <HealthBadge score={repo.health} size="lg" />
      </div>

      {repo.description && (
        <p style={{ color: "var(--muted)", fontSize: "16px", marginBottom: "8px" }}>{repo.description}</p>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--muted)", fontSize: "14px", marginBottom: "40px", flexWrap: "wrap" }}>
        {repo.language && <><span style={{ color: "var(--text)", fontWeight: 500 }}>{repo.language}</span><span style={{ color: "var(--border)" }}>·</span></>}
        <span>★ {repo.stars}</span>
        <span style={{ color: "var(--border)" }}>·</span>
        <span>⑂ {repo.forks}</span>
        <span style={{ color: "var(--border)" }}>·</span>
        {/* repo.id is "owner/name", which is already the path GitHub uses */}
        <a
          href={`https://github.com/${repo.id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--accent)", fontWeight: 500, textDecoration: "none" }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
          View on GitHub
        </a>
      </div>

      {/* Chart */}
      <div style={{ marginBottom: "32px" }}>
        <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "16px" }}>
          Commit Activity — last 26 weeks
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "24px 20px 16px" }}>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="var(--row-div)" strokeDasharray="4 4" />
              <XAxis dataKey="week" stroke="var(--dim)" tick={{ fontSize: 11, fill: "var(--dim)", fontFamily: "Work Sans, sans-serif" }} interval={3} />
              <YAxis stroke="var(--dim)" tick={{ fontSize: 11, fill: "var(--dim)", fontFamily: "Work Sans, sans-serif" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "4px", fontFamily: "Work Sans, sans-serif", fontSize: "13px" }}
                labelStyle={{ color: "var(--muted)" }}
                itemStyle={{ color: "var(--accent)" }}
              />
              <Line type="monotone" dataKey="commits" stroke="var(--accent)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "var(--accent)" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
        <StatCard label="Commits" value={totalCommits} sub={`${avgPerWeek}/wk avg (52 wks)`} />
        <StatCard
          label="Pull Requests"
          value={stats.prs.merged}
          sub={`merged · ${stats.prs.open} open${stats.prs.avg_merge_days != null ? ` · ${stats.prs.avg_merge_days}d avg` : ""}`}
        />
        <StatCard
          label="Issues"
          value={stats.issues.closed}
          sub={`closed · ${stats.issues.open} open${stats.issues.avg_open_days != null ? ` · ${stats.issues.avg_open_days}d avg age` : ""}`}
        />
      </div>
    </div>
  );
}

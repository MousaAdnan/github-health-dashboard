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
      padding:      "16px 20px",
      background:   "var(--surface)",
      border:       "1px solid var(--border)",
      borderRadius: "var(--radius)",
      flex:         "1",
      minWidth:     "160px",
    }}>
      <div style={{ color: "var(--muted)", fontSize: "12px", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}
      </div>
      <div style={{ fontSize: "24px", fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ color: "var(--muted)", fontSize: "12px", marginTop: "4px" }}>{sub}</div>}
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
  if (error)   return <p style={{ color: "var(--red)"   }}>Error: {error}</p>;
  if (!data)   return null;

  const { repo, commits, stats } = data;

  // Only show last 26 weeks for readability
  const chartData = commits.slice(-26).map(w => ({
    week:    w.week_start.slice(5),  // "MM-DD"
    commits: w.count,
  }));

  const totalCommits = commits.reduce((s, w) => s + w.count, 0);
  const avgPerWeek   = commits.length
    ? (totalCommits / commits.length).toFixed(1)
    : "0";

  return (
    <div>
      {/* Header */}
      <button
        onClick={onBack}
        style={{ background: "none", color: "var(--accent)", marginBottom: "20px", padding: "0", fontSize: "14px" }}
      >
        ← Back
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "8px", flexWrap: "wrap" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 700 }}>{repo.name}</h2>
        <HealthBadge score={repo.health} size="lg" />
      </div>

      {repo.description && (
        <p style={{ color: "var(--muted)", marginBottom: "6px" }}>{repo.description}</p>
      )}
      <p style={{ color: "var(--muted)", fontSize: "13px", marginBottom: "28px" }}>
        {repo.language && <><span style={{ color: "var(--text)" }}>{repo.language}</span> · </>}
        ★ {repo.stars} · ⑂ {repo.forks}
      </p>

      {/* Commit chart */}
      <h3 style={{ marginBottom: "12px", fontSize: "15px", fontWeight: 600 }}>
        Commit Activity — last 26 weeks
      </h3>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: "20px", marginBottom: "24px",
      }}>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="week" stroke="var(--muted)" tick={{ fontSize: 11 }} interval={3} />
            <YAxis stroke="var(--muted)" tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "6px" }}
              labelStyle={{ color: "var(--muted)" }}
              itemStyle={{ color: "var(--accent)" }}
            />
            <Line
              type="monotone" dataKey="commits" stroke="var(--accent)"
              strokeWidth={2} dot={false} activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Stat cards */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <StatCard
          label="Commits"
          value={totalCommits}
          sub={`${avgPerWeek}/wk avg (52 wks)`}
        />
        <StatCard
          label="Pull Requests"
          value={`${stats.prs.merged} merged`}
          sub={`${stats.prs.open} open · ${
            stats.prs.avg_merge_days != null
              ? `${stats.prs.avg_merge_days}d avg merge`
              : "no merge data"
          }`}
        />
        <StatCard
          label="Issues"
          value={`${stats.issues.closed} closed`}
          sub={`${stats.issues.open} open · ${
            stats.issues.avg_open_days != null
              ? `${stats.issues.avg_open_days}d avg age`
              : "no open issues"
          }`}
        />
      </div>
    </div>
  );
}

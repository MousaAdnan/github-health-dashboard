const BASE = "/api";

export interface Repo {
  id: string;
  owner: string;
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  last_pushed: string;
  health: number;
  fetched_at: string;
}

export interface WeeklyCommit {
  week_start: string;
  count: number;
}

export interface RepoDetail {
  repo: Repo;
  commits: WeeklyCommit[];
  stats: {
    prs: {
      open: number;
      closed: number;
      merged: number;
      avg_merge_days: number | null;
    };
    issues: {
      open: number;
      closed: number;
      avg_open_days: number | null;
    };
  };
}

export async function fetchOwner(owner: string): Promise<{ owner: string; fetched_at: string | null; repos: Repo[] }> {
  const res = await fetch(`${BASE}/repos/${encodeURIComponent(owner)}`);
  if (!res.ok) throw new Error((await res.json()).error ?? "Not found");
  return res.json();
}

export async function fetchRepo(owner: string, repo: string): Promise<RepoDetail> {
  const res = await fetch(`${BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  if (!res.ok) throw new Error((await res.json()).error ?? "Not found");
  return res.json();
}

export async function triggerIngest(owner: string): Promise<void> {
  const res = await fetch(`${BASE}/ingest/${encodeURIComponent(owner)}`, { method: "POST" });
  if (!res.ok) throw new Error((await res.json()).error ?? "Ingest failed");
}

const BASE = "/api";

// A failing request doesn't always carry JSON: a proxy in front of the app
// (cold start, gateway timeout, out-of-memory restart) answers with an HTML
// page, and blindly calling res.json() on that throws a parse error that hides
// the real status. Read the body as text and only parse it when it is JSON.
async function errorFrom(res: Response): Promise<Error> {
  const body = await res.text().catch(() => "");
  try {
    const parsed = JSON.parse(body);
    if (parsed?.error) return new Error(parsed.error);
  } catch {
    // not JSON — fall through to a status-based message
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    return new Error(
      `The server is waking up or restarting (HTTP ${res.status}). Give it up to a minute and try again.`
    );
  }
  return new Error(`Request failed with HTTP ${res.status}.`);
}

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
  if (!res.ok) throw await errorFrom(res);
  return res.json();
}

export async function fetchRepo(owner: string, repo: string): Promise<RepoDetail> {
  const res = await fetch(`${BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  if (!res.ok) throw await errorFrom(res);
  return res.json();
}

export async function triggerIngest(owner: string): Promise<void> {
  const res = await fetch(`${BASE}/ingest/${encodeURIComponent(owner)}`, { method: "POST" });
  if (!res.ok) throw await errorFrom(res);
}

export type User = { id: number; username: string; role: "user" | "admin" };
export type GameInfo = { id: string; name: string; description: string; rules: string };
export type Match = {
  id: number;
  gameId: string;
  state: unknown;
  status: string;
  winner: "human_win" | "bot_win" | "draw" | null;
};
export type Scoreboard = {
  me: {
    global: { played: number; wins: number; losses: number; draws: number };
    byGame: Array<{
      gameId: string;
      played: number;
      wins: number;
      losses: number;
      draws: number;
    }>;
  };
  leaderboard: Array<{
    username: string;
    played: number;
    wins: number;
    losses: number;
    draws: number;
  }>;
};
export type AdminInsights = {
  popularity: Array<{
    gameId: string;
    name: string;
    plays: number;
    humanWins: number;
    botWins: number;
    draws: number;
    plays24h: number;
  }>;
  favored: {
    gameId: string;
    name: string;
    plays: number;
    plays24h: number;
  } | null;
  recent: Array<{
    id: number;
    username: string;
    gameId: string;
    status: string;
    winner: string | null;
    createdAt: string;
  }>;
  leaderboard: Scoreboard["leaderboard"];
  totals: { plays: number; plays24h: number; players: number };
};

export type MetricDef = {
  name: string;
  type: "counter" | "gauge" | "histogram";
  description: string;
  defaultLabels: Record<string, string>;
  source: string;
};

export type ActionDef = {
  event: string;
  description: string;
  metrics: Array<{
    name: string;
    type: "counter" | "gauge" | "histogram";
    defaultLabels: Record<string, string>;
  }>;
  source: string;
};

export type ObservabilityCatalog = {
  configured: boolean;
  streams: { logs: string; traces: string };
  metrics: MetricDef[];
  actions: ActionDef[];
};

export type VerifyReport = {
  configured: boolean;
  ok: boolean;
  error?: string;
  probe_id?: string;
  duration_ms?: number;
  attempts?: number;
  streams?: { logs: string; traces: string };
  signals?: {
    logs: { ingest: boolean; fetched: boolean };
    metrics: { ingest: boolean; fetched: boolean };
    traces: { ingest: boolean; fetched: boolean; stream: string };
  };
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

/** Wire session expiry → clear client auth (once per app boot). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers,
  });

  let data: { error?: string } = {};
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text) as { error?: string };
    } catch {
      data = { error: text.slice(0, 120) || "request failed" };
    }
  }

  if (res.status === 401) {
    // login/register use 401 for bad credentials — do not treat as session expiry
    if (path !== "/api/auth/login" && path !== "/api/auth/register") {
      onUnauthorized?.();
    }
    throw new ApiError(data.error ?? "unauthorized", 401);
  }
  if (!res.ok) {
    throw new ApiError(data.error ?? "request failed", res.status);
  }
  return data as T;
}

export const api = {
  me: () => request<{ user: User | null }>("/api/auth/me"),
  login: (username: string, password: string) =>
    request<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  register: (username: string, password: string) =>
    request<{ user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  games: () => request<{ games: GameInfo[] }>("/api/games"),
  match: (gameId: string) => request<Match>(`/api/games/${gameId}/match`),
  newMatch: (gameId: string) =>
    request<Match>(`/api/games/${gameId}/match/new`, { method: "POST" }),
  move: (gameId: string, body: unknown) =>
    request<Match>(`/api/games/${gameId}/match/move`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  scoreboard: () => request<Scoreboard>("/api/scoreboard"),
  adminInsights: () => request<AdminInsights>("/api/admin/insights"),
  adminObservability: () => request<ObservabilityCatalog>("/api/admin/observability"),
  adminVerify: () =>
    request<VerifyReport>("/api/admin/observability/verify", { method: "POST" }),
  adminInjectAction: (event: string, count: number) =>
    request<{ ok: boolean; event: string; count: number; traceIds: string[] }>(
      "/api/admin/actions/inject",
      { method: "POST", body: JSON.stringify({ event, count }) },
    ),
};

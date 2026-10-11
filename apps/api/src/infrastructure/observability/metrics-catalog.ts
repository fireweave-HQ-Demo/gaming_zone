/**
 * Single catalog of every metric emitted by arcade.
 */
export type MetricDef = {
  name: string;
  type: "counter" | "gauge" | "histogram";
  description: string;
  /** Example / default labels */
  defaultLabels: Record<string, string>;
  /** Where it is emitted in code */
  source: string;
};

export const METRICS_CATALOG: MetricDef[] = [
  {
    name: "arcade_http_requests",
    type: "counter",
    description: "HTTP requests handled by the API",
    defaultLabels: { method: "GET", route: "/api/health", status: "200" },
    source: "openobserve.finishRequest",
  },
  {
    name: "arcade_http_duration_ms",
    type: "histogram",
    description: "HTTP request duration in milliseconds",
    defaultLabels: { method: "GET", route: "/api/health", status: "200" },
    source: "openobserve.finishRequest",
  },
  {
    name: "arcade_events",
    type: "counter",
    description: "Auth and product events (login, register, logout, …)",
    defaultLabels: { event: "admin_insights", result: "ok" },
    source: "emitAction (auth.*, admin.*, …)",
  },
  {
    name: "arcade_auth_failures_total",
    type: "counter",
    description: "Failed login or register attempts",
    defaultLabels: { reason: "bad_password" },
    source: "auth.login / auth.register",
  },
  {
    name: "arcade_matches_total",
    type: "counter",
    description: "Matches started or finished",
    defaultLabels: { game: "tictactoe", result: "started" },
    source: "games.getOrCreateMatch / games.applyMove",
  },
  {
    name: "arcade_game_popularity",
    type: "counter",
    description: "Game selection / play popularity",
    defaultLabels: { game: "tictactoe" },
    source: "games.getOrCreateMatch",
  },
  {
    name: "arcade_moves_total",
    type: "counter",
    description: "Human and bot moves applied",
    defaultLabels: { game: "tictactoe", actor: "human" },
    source: "games.applyMove",
  },
  {
    name: "arcade_illegal_moves_total",
    type: "counter",
    description: "Illegal human moves rejected",
    defaultLabels: { game: "tictactoe" },
    source: "games.applyMove",
  },
  {
    name: "arcade_match_duration_ms",
    type: "histogram",
    description: "Finished match duration in milliseconds",
    defaultLabels: { game: "tictactoe", result: "human_win" },
    source: "games.applyMove (match.end)",
  },
  {
    name: "arcade_bot_move_duration_ms",
    type: "histogram",
    description: "Bot engine think time in milliseconds",
    defaultLabels: { game: "tictactoe" },
    source: "games.applyMove",
  },
  {
    name: "arcade_active_matches",
    type: "gauge",
    description: "In-process count of active matches by game",
    defaultLabels: { game: "tictactoe" },
    source: "games match.start / match.end",
  },
  {
    name: "arcade_lobby_views_total",
    type: "counter",
    description: "Lobby / game list views",
    defaultLabels: {},
    source: "games.listGames",
  },
  {
    name: "arcade_scoreboard_views_total",
    type: "counter",
    description: "Scoreboard page loads",
    defaultLabels: {},
    source: "scoreboard.forUser",
  },
  {
    name: "arcade_admin_injects_total",
    type: "counter",
    description: "Admin portal injections of an action triad (log, metrics, span)",
    defaultLabels: { kind: "action", name: "match.move" },
    source: "admin.injectAction",
  },
  {
    name: "arcade_openobserve_export_errors_total",
    type: "counter",
    description: "Failed exports to OpenObserve",
    defaultLabels: { signal: "metrics" },
    source: "openobserve postJson failures",
  },
  {
    name: "arcade_verify",
    type: "counter",
    description: "Observability probe / verify injections",
    defaultLabels: { probe_id: "admin", signal: "metrics" },
    source: "openobserve.verifyInjection",
  },
];

export function metricNames(): string[] {
  return METRICS_CATALOG.map((m) => m.name);
}

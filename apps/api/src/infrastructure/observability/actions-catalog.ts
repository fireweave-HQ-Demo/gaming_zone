/**
 * Product actions that must emit a correlated log + metric(s) + trace span.
 */

export type ActionDef = {
  event: string;
  description: string;
  /** Metrics emitted for a successful action. */
  metrics: Array<{
    name: string;
    type: "counter" | "gauge" | "histogram";
    defaultLabels: Record<string, string>;
  }>;
  source: string;
};

export const ACTIONS_CATALOG: ActionDef[] = [
  {
    event: "http.request",
    description: "API HTTP request (baseline RED)",
    metrics: [
      {
        name: "arcade_http_requests",
        type: "counter",
        defaultLabels: { method: "GET", route: "/api/health", status: "200" },
      },
      {
        name: "arcade_http_duration_ms",
        type: "histogram",
        defaultLabels: { method: "GET", route: "/api/health", status: "200" },
      },
    ],
    source: "openobserve.finishRequest",
  },
  {
    event: "auth.register",
    description: "Player account created",
    metrics: [
      {
        name: "arcade_events",
        type: "counter",
        defaultLabels: { event: "register", result: "ok" },
      },
    ],
    source: "auth.register",
  },
  {
    event: "auth.login",
    description: "Player or admin session created",
    metrics: [
      {
        name: "arcade_events",
        type: "counter",
        defaultLabels: { event: "login", result: "ok", role: "user" },
      },
    ],
    source: "auth.login",
  },
  {
    event: "auth.logout",
    description: "Session cleared",
    metrics: [
      {
        name: "arcade_events",
        type: "counter",
        defaultLabels: { event: "logout", result: "ok" },
      },
    ],
    source: "auth.logout",
  },
  {
    event: "auth.session_restore",
    description: "Cookie session lookup via /api/auth/me",
    metrics: [
      {
        name: "arcade_events",
        type: "counter",
        defaultLabels: { event: "session_restore", result: "hit" },
      },
    ],
    source: "auth.me",
  },
  {
    event: "auth.failure",
    description: "Failed login or register",
    metrics: [
      {
        name: "arcade_auth_failures_total",
        type: "counter",
        defaultLabels: { reason: "bad_password" },
      },
      {
        name: "arcade_events",
        type: "counter",
        defaultLabels: { event: "login", result: "fail" },
      },
    ],
    source: "auth.login / auth.register",
  },
  {
    event: "lobby.view",
    description: "Game catalogue listed",
    metrics: [
      {
        name: "arcade_lobby_views_total",
        type: "counter",
        defaultLabels: {},
      },
    ],
    source: "games.listGames",
  },
  {
    event: "scoreboard.view",
    description: "Scoreboard / leaderboard read",
    metrics: [
      {
        name: "arcade_scoreboard_views_total",
        type: "counter",
        defaultLabels: {},
      },
    ],
    source: "scoreboard.forUser",
  },
  {
    event: "match.start",
    description: "New match created",
    metrics: [
      {
        name: "arcade_matches_total",
        type: "counter",
        defaultLabels: { game: "tictactoe", result: "started" },
      },
      {
        name: "arcade_game_popularity",
        type: "counter",
        defaultLabels: { game: "tictactoe" },
      },
      {
        name: "arcade_active_matches",
        type: "gauge",
        defaultLabels: { game: "tictactoe" },
      },
    ],
    source: "games.getOrCreateMatch",
  },
  {
    event: "match.move",
    description: "Human or bot move applied",
    metrics: [
      {
        name: "arcade_moves_total",
        type: "counter",
        defaultLabels: { game: "tictactoe", actor: "human" },
      },
    ],
    source: "games.applyMove",
  },
  {
    event: "match.bot_think",
    description: "Bot move latency",
    metrics: [
      {
        name: "arcade_bot_move_duration_ms",
        type: "histogram",
        defaultLabels: { game: "tictactoe" },
      },
    ],
    source: "games.applyMove",
  },
  {
    event: "match.end",
    description: "Match finished",
    metrics: [
      {
        name: "arcade_matches_total",
        type: "counter",
        defaultLabels: { game: "tictactoe", result: "human_win" },
      },
      {
        name: "arcade_match_duration_ms",
        type: "histogram",
        defaultLabels: { game: "tictactoe", result: "human_win" },
      },
      {
        name: "arcade_active_matches",
        type: "gauge",
        defaultLabels: { game: "tictactoe" },
      },
    ],
    source: "games.applyMove",
  },
  {
    event: "match.illegal",
    description: "Illegal human move rejected",
    metrics: [
      {
        name: "arcade_illegal_moves_total",
        type: "counter",
        defaultLabels: { game: "tictactoe" },
      },
    ],
    source: "games.applyMove",
  },
  {
    event: "admin.insights",
    description: "Admin insights dashboard loaded",
    metrics: [
      {
        name: "arcade_events",
        type: "counter",
        defaultLabels: { event: "admin_insights", result: "ok" },
      },
    ],
    source: "admin.insights",
  },
  {
    event: "admin.action_inject",
    description: "Admin injected a log + metric + span triad",
    metrics: [
      {
        name: "arcade_admin_injects_total",
        type: "counter",
        defaultLabels: { kind: "action", name: "match.move" },
      },
    ],
    source: "admin.injectAction",
  },
  {
    event: "observability.verify",
    description: "Canary probe for logs/metrics/traces",
    metrics: [
      {
        name: "arcade_verify",
        type: "counter",
        defaultLabels: { probe_id: "admin", signal: "metrics" },
      },
    ],
    source: "openobserve.verifyInjection",
  },
];

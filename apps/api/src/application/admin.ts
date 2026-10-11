import { AppError, type PublicUser } from "@arcade/shared";
import type { EngineCatalog, MatchRepository, ObservabilityPort, TraceCtx } from "../domain/ports";
import { ACTIONS_CATALOG } from "../infrastructure/observability/actions-catalog";
import { METRICS_CATALOG } from "../infrastructure/observability/metrics-catalog";
import {
  LOG_STREAM,
  TRACE_STREAM,
  observabilityEnabled,
  verifyInjection,
} from "../infrastructure/observability/openobserve";

function traceFields(trace?: TraceCtx) {
  return { traceId: trace?.traceId, parentSpanId: trace?.parentSpanId };
}

function requireAdmin(user: PublicUser) {
  if (user.role !== "admin") throw new AppError("Forbidden", 403, "forbidden");
}

function sampleCount(raw: number) {
  const count = Math.floor(raw);
  if (!Number.isFinite(count) || count < 1 || count > 50) {
    throw new AppError("count must be between 1 and 50", 400, "bad_count");
  }
  return count;
}

function sampleValue(type: "counter" | "gauge" | "histogram") {
  if (type === "histogram") return 25;
  return 1;
}

export function createAdminUseCases(deps: {
  matches: MatchRepository;
  engines: EngineCatalog;
  obs: ObservabilityPort;
}) {
  return {
    async insights(user: PublicUser, trace?: TraceCtx) {
      requireAdmin(user);

      const [popularity, recent, leaderboard] = await Promise.all([
        deps.matches.popularity(),
        deps.matches.recentMatches(30),
        deps.matches.globalScoreboard(10),
      ]);

      const catalogue = deps.engines.list().map((e) => ({
        id: e.id,
        name: e.name,
      }));

      const enriched = catalogue
        .map((g) => {
          const p = popularity.find((x) => x.gameId === g.id);
          return {
            gameId: g.id,
            name: g.name,
            plays: p?.plays ?? 0,
            humanWins: p?.humanWins ?? 0,
            botWins: p?.botWins ?? 0,
            draws: p?.draws ?? 0,
            plays24h: p?.plays24h ?? 0,
          };
        })
        .sort((a, b) => b.plays - a.plays);

      const favored = enriched[0] ?? null;

      await deps.obs.emitAction({
        event: "admin.insights",
        ...traceFields(trace),
        user: user.username,
        metrics: [
          {
            name: "arcade_events",
            value: 1,
            labels: { event: "admin_insights", result: "ok" },
          },
        ],
      });

      return {
        popularity: enriched,
        favored,
        recent,
        leaderboard,
        totals: {
          plays: enriched.reduce((s, g) => s + g.plays, 0),
          plays24h: enriched.reduce((s, g) => s + g.plays24h, 0),
          players: leaderboard.length,
        },
      };
    },

    catalog(user: PublicUser) {
      requireAdmin(user);
      return {
        configured: observabilityEnabled(),
        streams: { logs: LOG_STREAM, traces: TRACE_STREAM },
        metrics: METRICS_CATALOG,
        actions: ACTIONS_CATALOG,
      };
    },

    async injectAction(
      user: PublicUser,
      event: string,
      count: number,
      trace?: TraceCtx,
    ) {
      requireAdmin(user);
      const def = ACTIONS_CATALOG.find((a) => a.event === event);
      if (!def) throw new AppError("unknown action", 404, "unknown_action");
      const n = sampleCount(count);
      if (!observabilityEnabled()) {
        throw new AppError("OpenObserve is not configured", 503, "oo_unconfigured");
      }

      const traces: string[] = [];
      for (let i = 0; i < n; i++) {
        const emitted = await deps.obs.emitAction({
          event: def.event,
          ...traceFields(trace),
          user: user.username,
          logFields: { injected: true, sample: i + 1 },
          spanAttributes: { injected: true },
          metrics: def.metrics.map((m) => ({
            name: m.name,
            value: sampleValue(m.type),
            labels: m.defaultLabels,
            type: m.type,
          })),
        });
        traces.push(emitted.traceId);
      }

      await deps.obs.emitAction({
        event: "admin.action_inject",
        ...traceFields(trace),
        user: user.username,
        metrics: [
          {
            name: "arcade_admin_injects_total",
            value: 1,
            labels: { kind: "action", name: def.event },
          },
        ],
        logFields: { action: def.event, count: n },
      });

      return { ok: true, event: def.event, count: n, traceIds: traces };
    },

    async verify(user: PublicUser) {
      requireAdmin(user);
      const report = await verifyInjection();
      if (!report.configured || !report.streams || !report.ingest || !report.fetch) {
        return {
          configured: false as const,
          ok: false,
          error: report.error ?? "OpenObserve is not configured",
        };
      }
      return {
        configured: true as const,
        ok: report.ok,
        probe_id: report.probe_id,
        duration_ms: report.duration_ms,
        attempts: report.attempts,
        streams: { logs: report.streams.logs, traces: report.streams.traces },
        signals: {
          logs: {
            ingest: report.ingest.logs.ok,
            fetched: report.fetch.logs.ok,
          },
          metrics: {
            ingest: report.ingest.metrics.ok,
            fetched: report.fetch.metrics.ok,
          },
          traces: {
            ingest: report.ingest.traces.ok,
            fetched: report.fetch.traces.ok,
            stream: report.fetch.traces.stream,
          },
        },
      };
    },
  };
}

export type AdminUseCases = ReturnType<typeof createAdminUseCases>;

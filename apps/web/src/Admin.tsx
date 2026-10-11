import { useEffect, useMemo, useState } from "react";
import { api, type AdminInsights } from "./api";
import { ObservabilityPanel } from "./Observability";

type Portal = "insights" | "openobserve";

export function AdminPage() {
  const [portal, setPortal] = useState<Portal>("insights");

  return (
    <div className="admin-shell">
      <section className="panel">
        <div className="topbar">
          <div>
            <div className="status">admin portal</div>
            <p className="hint">
              {portal === "insights"
                ? "game popularity, outcomes, and recent matches"
                : "OpenObserve catalog, pipeline check, and signal injection"}
            </p>
          </div>
          <div className="nav">
            <button
              type="button"
              className={`btn secondary ${portal === "insights" ? "active" : ""}`}
              onClick={() => setPortal("insights")}
            >
              insights
            </button>
            <button
              type="button"
              className={`btn secondary ${portal === "openobserve" ? "active" : ""}`}
              onClick={() => setPortal("openobserve")}
            >
              openobserve
            </button>
          </div>
        </div>
      </section>

      {portal === "insights" ? <InsightsPanel /> : <ObservabilityPanel />}
    </div>
  );
}

function InsightsPanel() {
  const [data, setData] = useState<AdminInsights | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void api
      .adminInsights()
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  const maxPlays = useMemo(
    () => Math.max(1, ...(data?.popularity.map((p) => p.plays) ?? [1])),
    [data],
  );

  if (error) {
    return (
      <section className="panel">
        <p className="error">{error}</p>
      </section>
    );
  }
  if (!data) {
    return (
      <section className="panel">
        <p className="hint">loading insights…</p>
      </section>
    );
  }

  return (
    <>
      <section className="panel">
        <div className="status">overview</div>
        <div className="stats" style={{ marginTop: "1rem" }}>
          <div>
            <strong>{data.totals.plays}</strong>total plays
          </div>
          <div>
            <strong>{data.totals.plays24h}</strong>last 24h
          </div>
          <div>
            <strong>{data.totals.players}</strong>on leaderboard
          </div>
          <div>
            <strong>{data.favored?.name ?? "—"}</strong>most favoured
          </div>
        </div>
        {data.favored ? (
          <p className="hint" style={{ marginTop: "0.85rem" }}>
            players favour <strong>{data.favored.name}</strong> ({data.favored.plays} plays
            · {data.favored.plays24h} in 24h)
          </p>
        ) : null}
      </section>

      <section className="panel">
        <div className="status">game popularity</div>
        <div className="bars">
          {data.popularity.map((p) => (
            <div className="bar-row" key={p.gameId}>
              <span>{p.name}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(p.plays / maxPlays) * 100}%` }} />
              </div>
              <span>{p.plays}</span>
            </div>
          ))}
        </div>
        <h3 style={{ marginTop: "1.5rem" }}>outcomes by game</h3>
        <table className="data">
          <thead>
            <tr>
              <th>game</th>
              <th>human</th>
              <th>bot</th>
              <th>draw</th>
              <th>24h</th>
            </tr>
          </thead>
          <tbody>
            {data.popularity.map((p) => (
              <tr key={p.gameId}>
                <td>{p.name}</td>
                <td>{p.humanWins}</td>
                <td>{p.botWins}</td>
                <td>{p.draws}</td>
                <td>{p.plays24h}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <div className="status">top players</div>
        <p className="hint">global wins across all games</p>
        <table className="data" style={{ marginTop: "0.75rem" }}>
          <thead>
            <tr>
              <th>#</th>
              <th>player</th>
              <th>wins</th>
              <th>played</th>
              <th>draws</th>
              <th>losses</th>
            </tr>
          </thead>
          <tbody>
            {data.leaderboard.map((r, i) => (
              <tr key={r.username}>
                <td>{i + 1}</td>
                <td>{r.username}</td>
                <td>{r.wins}</td>
                <td>{r.played}</td>
                <td>{r.draws}</td>
                <td>{r.losses}</td>
              </tr>
            ))}
            {!data.leaderboard.length ? (
              <tr>
                <td colSpan={6}>no finished matches yet</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <div className="status">recent matches</div>
        <table className="data" style={{ marginTop: "0.75rem" }}>
          <thead>
            <tr>
              <th>id</th>
              <th>user</th>
              <th>game</th>
              <th>result</th>
            </tr>
          </thead>
          <tbody>
            {data.recent.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.username}</td>
                <td>{r.gameId}</td>
                <td>{r.winner ?? r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

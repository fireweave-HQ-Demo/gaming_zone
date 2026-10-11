import { useEffect, useState, type FormEvent } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { api, type GameInfo, type Match, type Scoreboard } from "./api";
import { AdminPage } from "./Admin";
import { AuthProvider, RequireAdmin, RequireAuth, useAuth } from "./auth";
import { LobbyPage } from "./Lobby";
import { GameBoard } from "./games/GameBoard";
import { ArcadeMark, GameMark } from "./games/logos";
import { OutcomeFX } from "./games/outcome";

type LoginMode = "player" | "admin";

function AuthPage() {
  const { user, loading, login, register, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  const [mode, setMode] = useState<LoginMode>(
    fromPath?.startsWith("/admin") ? "admin" : "player",
  );
  const [username, setUsername] = useState(mode === "admin" ? "admin" : "");
  const [password, setPassword] = useState(mode === "admin" ? "admin" : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function switchMode(next: LoginMode) {
    setMode(next);
    setError("");
    if (next === "admin") {
      setUsername("admin");
      setPassword("admin");
    } else {
      setUsername("");
      setPassword("");
    }
  }

  function homeFor(role: "user" | "admin") {
    if (role === "admin") {
      if (fromPath && fromPath.startsWith("/admin")) return fromPath;
      return "/admin";
    }
    if (fromPath && !fromPath.startsWith("/admin") && fromPath !== "/login") {
      return fromPath;
    }
    return "/";
  }

  useEffect(() => {
    if (!loading && user) navigate(homeFor(user.role), { replace: true });
  }, [loading, user]);

  async function submit(kind: "login" | "register") {
    setBusy(true);
    setError("");
    try {
      const next =
        kind === "login"
          ? await login(username, password)
          : await register(username, password);
      if (mode === "admin" && next.role !== "admin") {
        await logout();
        setError("this account is not an admin — use player login");
        return;
      }
      navigate(homeFor(next.role), { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="panel">
        <p className="hint">checking session…</p>
      </section>
    );
  }

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  return (
    <section className="panel auth-panel">
      <div className="nav auth-modes">
        <button
          type="button"
          className={`btn secondary ${mode === "player" ? "active" : ""}`}
          onClick={() => switchMode("player")}
        >
          player
        </button>
        <button
          type="button"
          className={`btn secondary ${mode === "admin" ? "active" : ""}`}
          onClick={() => switchMode("admin")}
        >
          admin portal
        </button>
      </div>

      <p className="hint" style={{ marginTop: "1rem" }}>
        {mode === "admin"
          ? "insights, leaderboards, and OpenObserve logs, metrics, and traces"
          : "one account for every game · human vs arcade bot"}
      </p>

      <form
        className="auth-form"
        style={{ marginTop: "1rem" }}
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void submit("login");
        }}
      >
        <label>
          username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            autoComplete="username"
          />
        </label>
        <label>
          password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={4}
            autoComplete="current-password"
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <div className="row">
          <button className="btn mint" type="submit" disabled={busy}>
            {mode === "admin" ? "enter admin portal" : "log in"}
          </button>
          {mode === "player" ? (
            <button
              className="btn secondary"
              type="button"
              disabled={busy}
              onClick={() => void submit("register")}
            >
              create account
            </button>
          ) : null}
        </div>
        {mode === "admin" ? (
          <p className="hint">default credentials: admin / admin</p>
        ) : (
          <p className="hint">new here? create an account — admin login is a separate tab</p>
        )}
      </form>
    </section>
  );
}

function PlayPage() {
  const { gameId = "" } = useParams();
  const [game, setGame] = useState<GameInfo | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setBooting(true);
    setError("");
    setMatch(null);
    void (async () => {
      try {
        const { games } = await api.games();
        const found = games.find((g) => g.id === gameId) ?? null;
        if (cancelled) return;
        if (!found) {
          setGame(null);
          setError("unknown game");
          return;
        }
        setGame(found);
        setMatch(await api.match(found.id));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "failed");
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  async function move(body: unknown) {
    if (!game) return;
    setBusy(true);
    setError("");
    try {
      setMatch(await api.move(game.id, body));
    } catch (e) {
      setError(e instanceof Error ? e.message : "move failed");
    } finally {
      setBusy(false);
    }
  }

  async function fresh() {
    if (!game) return;
    setBusy(true);
    setError("");
    try {
      setMatch(await api.newMatch(game.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  if (booting) {
    return (
      <section className="panel">
        <p className="hint">restoring match…</p>
      </section>
    );
  }

  if (!game) {
    return (
      <section className="panel">
        <p className="error">{error || "game not found"}</p>
        <Link className="btn secondary" to="/" style={{ marginTop: "1rem", display: "inline-block" }}>
          back to lobby
        </Link>
      </section>
    );
  }

  const statusText = !match
    ? "loading…"
    : match.winner === "human_win"
      ? "you win"
      : match.winner === "bot_win"
        ? "arcade bot wins"
        : match.winner === "draw"
          ? "draw"
          : "your move";

  const statusClass =
    match?.winner === "human_win" ? "win" : match?.winner === "bot_win" ? "lose" : "";

  return (
    <section className={`panel play-panel ${statusClass}`}>
      <div className="play-bar">
        <GameMark id={game.id} />
        <div className="play-title">
          <div className="status">{game.name}</div>
          <p className="hint">{game.description}</p>
        </div>
        <div key={statusText} className={`status turn pill ${statusClass}`}>
          {statusText}
        </div>
        <div className="row">
          <Link className="btn secondary" to="/">
            lobby
          </Link>
          <button className="btn mint" disabled={busy} onClick={() => void fresh()}>
            new game
          </button>
          <details className="rules-pop">
            <summary>rules</summary>
            <p>{game.rules}</p>
          </details>
        </div>
      </div>
      <div
        className="play-fit"
        data-game={game.id}
        data-result={statusClass}
        key={match?.winner ?? "playing"}
      >
        <OutcomeFX gameId={game.id} result={statusClass === "win" || statusClass === "lose" ? statusClass : ""} />
        {match ? <GameBoard match={match} busy={busy} onMove={move} /> : null}
      </div>
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

function ScoreboardPage() {
  const [data, setData] = useState<Scoreboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void api
      .scoreboard()
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

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
        <p className="hint">loading scoreboard…</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="status">your scoreboard</div>
      <div className="stats" style={{ marginTop: "1rem" }}>
        <div>
          <strong>{data.me.global.played}</strong>played
        </div>
        <div>
          <strong>{data.me.global.wins}</strong>wins
        </div>
        <div>
          <strong>{data.me.global.draws}</strong>draws
        </div>
        <div>
          <strong>{data.me.global.losses}</strong>losses
        </div>
      </div>
      <h3 style={{ marginTop: "1.5rem" }}>by game</h3>
      <table className="data">
        <thead>
          <tr>
            <th>game</th>
            <th>played</th>
            <th>wins</th>
            <th>draws</th>
            <th>losses</th>
          </tr>
        </thead>
        <tbody>
          {data.me.byGame.map((r) => (
            <tr key={r.gameId}>
              <td>{r.gameId}</td>
              <td>{r.played}</td>
              <td>{r.wins}</td>
              <td>{r.draws}</td>
              <td>{r.losses}</td>
            </tr>
          ))}
          {!data.me.byGame.length ? (
            <tr>
              <td colSpan={5}>no finished matches yet</td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <h3 style={{ marginTop: "1.5rem" }}>leaderboard</h3>
      <table className="data">
        <thead>
          <tr>
            <th>player</th>
            <th>wins</th>
            <th>played</th>
          </tr>
        </thead>
        <tbody>
          {data.leaderboard.map((r) => (
            <tr key={r.username}>
              <td>{r.username}</td>
              <td>{r.wins}</td>
              <td>{r.played}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Shell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === "admin";
  const onAdmin = location.pathname.startsWith("/admin");
  const onLobby = location.pathname === "/";
  const gamesActive =
    location.pathname === "/" || location.pathname.startsWith("/play/");

  return (
    <>
      <div className={`chrome ${onLobby ? "chrome-lobby" : ""}`}>
        <div className="topbar">
          <p className="hint">
            {isAdmin ? (
              <>
                admin · <strong>{user?.username}</strong>
                {onAdmin ? " · portal" : ""}
              </>
            ) : (
              <>
                hi, <strong>{user?.username}</strong>
              </>
            )}
          </p>
          <button className="btn secondary" onClick={() => void logout()}>
            log out
          </button>
        </div>
        <nav className="nav">
          {isAdmin ? (
            <NavLink
              to="/admin"
              className={({ isActive }) => `btn secondary ${isActive ? "active" : ""}`}
            >
              admin
            </NavLink>
          ) : null}
          <NavLink
            to="/"
            end
            className={() => `btn secondary ${gamesActive ? "active" : ""}`}
          >
            games
          </NavLink>
          <NavLink
            to="/scoreboard"
            className={({ isActive }) => `btn secondary ${isActive ? "active" : ""}`}
          >
            scoreboard
          </NavLink>
        </nav>
      </div>
      <Outlet />
    </>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route index element={<LobbyPage />} />
        <Route path="play/:gameId" element={<PlayPage />} />
        <Route path="scoreboard" element={<ScoreboardPage />} />
        <Route
          path="admin"
          element={
            <RequireAdmin>
              <AdminPage />
            </RequireAdmin>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AppChrome() {
  const { user } = useAuth();
  const location = useLocation();
  const adminPortal = user?.role === "admin" && location.pathname.startsWith("/admin");
  const playing = location.pathname.startsWith("/play/");
  const lobby = location.pathname === "/";

  return (
    <main
      className={[
        "app",
        adminPortal ? "app-admin" : "",
        playing ? "app-play" : "",
        lobby ? "app-lobby" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="mast">
        <Link to={user?.role === "admin" ? "/admin" : "/"} className="logo">
          <ArcadeMark />
          <span>
            arcade
            {adminPortal ? <em> admin</em> : null}
          </span>
        </Link>
        {playing || lobby ? null : (
          <p className="tagline">
            {adminPortal
              ? "insights and OpenObserve logs, metrics, traces"
              : "human vs arcade bot · one login · one scoreboard"}
          </p>
        )}
      </header>
      <div className="stage">
        <AppRoutes />
      </div>
    </main>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppChrome />
    </AuthProvider>
  );
}

import { useEffect, useState } from "react";
import { api, type ObservabilityCatalog, type VerifyReport } from "./api";

type Tab = "metrics" | "actions";

export function ObservabilityPanel() {
  const [data, setData] = useState<ObservabilityCatalog | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("metrics");
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [report, setReport] = useState<VerifyReport | null>(null);

  useEffect(() => {
    void api
      .adminObservability()
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  async function verify() {
    setBusy("verify");
    setNote("");
    setError("");
    try {
      setReport(await api.adminVerify());
    } catch (e) {
      setError(e instanceof Error ? e.message : "verify failed");
    } finally {
      setBusy("");
    }
  }

  async function injectAction(event: string) {
    setBusy(event);
    setNote("");
    setError("");
    try {
      const result = await api.adminInjectAction(event, count);
      setNote(
        `injected ${result.count}× ${result.event} (log + metrics + span) · trace ${result.traceIds[0] ?? "—"}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "inject failed");
    } finally {
      setBusy("");
    }
  }

  if (error && !data) {
    return (
      <section className="panel">
        <p className="error">{error}</p>
      </section>
    );
  }
  if (!data) {
    return (
      <section className="panel">
        <p className="hint">loading OpenObserve catalog…</p>
      </section>
    );
  }

  return (
    <>
      <section className="panel">
        <div className="topbar">
          <div>
            <div className="status">OpenObserve</div>
            <p className="hint">
              logs <code>{data.streams.logs}</code> · traces <code>{data.streams.traces}</code> ·
              metrics <code>arcade_*</code>
            </p>
          </div>
          <button type="button" className="btn mint" disabled={busy === "verify"} onClick={() => void verify()}>
            {busy === "verify" ? "checking…" : "verify pipeline"}
          </button>
        </div>
        <p className={data.configured ? "hint oo-ok" : "error"} style={{ marginTop: "0.85rem" }}>
          {data.configured
            ? "credentials configured · exports go to OpenObserve"
            : "OPENOBSERVE_URL, OPENOBSERVE_USER, and OPENOBSERVE_PASSWORD are not set"}
        </p>
        {report ? <VerifySummary report={report} /> : null}
        {note ? <p className="hint oo-ok">{note}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="panel">
        <div className="nav">
          <button
            type="button"
            className={`btn secondary ${tab === "metrics" ? "active" : ""}`}
            onClick={() => setTab("metrics")}
          >
            metrics
          </button>
          <button
            type="button"
            className={`btn secondary ${tab === "actions" ? "active" : ""}`}
            onClick={() => setTab("actions")}
          >
            actions
          </button>
          {tab === "actions" ? (
            <label className="oo-count">
              samples
              <input
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              />
            </label>
          ) : null}
        </div>
        <p className="hint" style={{ marginTop: "0.85rem" }}>
          {tab === "metrics"
            ? "every arcade_* series the API emits. labels stay low-cardinality (no usernames or match ids)."
            : "inject writes the full triad: one log, the action’s metrics, and a span parented to this request."}
        </p>

        {tab === "metrics" ? (
          <table className="data" style={{ marginTop: "0.75rem" }}>
            <thead>
              <tr>
                <th>metric</th>
                <th>type</th>
                <th>labels</th>
              </tr>
            </thead>
            <tbody>
              {data.metrics.map((m) => (
                <tr key={m.name}>
                  <td>
                    <strong>{m.name}</strong>
                    <div className="hint">{m.description}</div>
                  </td>
                  <td>{m.type}</td>
                  <td className="hint">{formatLabels(m.defaultLabels)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="data" style={{ marginTop: "0.75rem" }}>
            <thead>
              <tr>
                <th>action</th>
                <th>metrics</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.actions.map((a) => (
                <tr key={a.event}>
                  <td>
                    <strong>{a.event}</strong>
                    <div className="hint">{a.description}</div>
                  </td>
                  <td className="hint">{a.metrics.map((m) => m.name).join(", ")}</td>
                  <td>
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={!data.configured || Boolean(busy)}
                      onClick={() => void injectAction(a.event)}
                    >
                      {busy === a.event ? "sending…" : "inject triad"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function VerifySummary({ report }: { report: VerifyReport }) {
  if (!report.configured || !report.signals) {
    return <p className="error">{report.error ?? "OpenObserve is not configured"}</p>;
  }
  const signals = report.signals;
  return (
    <div className="oo-signals">
      <Signal name="logs" ok={signals.logs.ingest && signals.logs.fetched} />
      <Signal name="metrics" ok={signals.metrics.ingest && signals.metrics.fetched} />
      <Signal name="traces" ok={signals.traces.ingest && signals.traces.fetched} />
      <span className="hint">
        probe {report.probe_id} · {report.duration_ms}ms · {report.attempts} tries
        {report.ok ? "" : " · fetch lagged or a signal failed"}
      </span>
    </div>
  );
}

function Signal({ name, ok }: { name: string; ok: boolean }) {
  return <span className={ok ? "oo-pill ok" : "oo-pill bad"}>{name}</span>;
}

function formatLabels(labels: Record<string, string>) {
  const entries = Object.entries(labels);
  if (!entries.length) return "—";
  return entries.map(([k, v]) => `${k}=${v}`).join(" ");
}

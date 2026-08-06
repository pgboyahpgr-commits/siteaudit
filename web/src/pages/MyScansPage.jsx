import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { api, logout } from "../api.js";
import { scoreColor, SEV_ORDER } from "../theme.js";

export default function MyScansPage({ onAuthed }) {
  const [scans, setScans] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.myScans().then((r) => setScans(r.scans || [])).catch((e) => setError(e.message));
  }, []);

  const chartData = scans
    .filter((s) => s.score != null)
    .slice()
    .reverse()
    .map((s) => ({ name: s.targetUrl.replace(/^https?:\/\//, "").slice(0, 18), score: s.score }));

  return (
    <>
      <div className="section-head">
        <div>
          <h2>MY SCAN HISTORY</h2>
          <span className="small dim">Every scan you've run while signed in. Scores over time.</span>
        </div>
        <Link to="/" className="btn btn-ghost btn-sm">▸ NEW SCAN</Link>
      </div>

      {error && <div className="error-box">{error}</div>}

      {chartData.length > 1 && (
        <div className="console mt">
          <div className="console-title">
            <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
            <span>score_history.exe — security score trend</span>
          </div>
          <div className="console-body" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#7f92b8" fontSize={10} tickFormatter={(v) => v} />
                <YAxis stroke="#7f92b8" fontSize={10} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: "#0a0f1e", border: "1px solid #2a3a6e", fontFamily: "monospace", fontSize: 12 }}
                  labelStyle={{ color: "#33ffa1" }}
                />
                <Bar dataKey="score" radius={[2, 2, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={scoreColor(d.score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {scans.length === 0 && !error ? (
        <div className="empty mt">
          <span className="big">01</span>
          No scans yet. Run your first scan and sign in — it'll be saved here.
          <div className="mt">
            <Link to="/" className="btn btn-primary btn-sm">▸ RUN A SCAN</Link>
          </div>
        </div>
      ) : (
        <div className="scan-table mt">
          {scans.map((s) => (
            <Link key={s.scanId} to={`/scan/${s.scanId}`} className="scan-row">
              <div className="sr-main">
                <span className={`sr-status ${s.status}`}>{s.status}</span>
                <span className="sr-url">{s.targetUrl}</span>
                <span className="sr-mode">{s.mode}</span>
              </div>
              <div className="sr-side">
                {s.verified && <span className="nav-pill live" style={{ cursor: "default" }}>VERIFIED</span>}
                {s.score != null && <b style={{ color: scoreColor(s.score) }}>{s.score}</b>}
                <span className="sr-date">{new Date(s.createdAt).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="center mt">
        <button className="btn btn-ghost btn-sm" onClick={() => { logout(); onAuthed?.(); }}>
          LOG OUT
        </button>
      </div>
    </>
  );
}

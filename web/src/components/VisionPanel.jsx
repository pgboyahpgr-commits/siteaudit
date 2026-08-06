import { useState, useEffect } from "react";
import { api } from "../api.js";

function Rating({ label, icon, r }) {
  const color = r.score >= 70 ? "#3ddc97" : r.score >= 45 ? "#ff9f1a" : "#ff3860";
  return (
    <div className="ui-rating">
      <div className="ui-rating-head">
        <span className="ui-rating-label">
          {icon} {label}
        </span>
        <span className="ui-rating-verdict" style={{ color }}>{r.verdict}</span>
      </div>
      <div className="ui-meter">
        <div className="ui-meter-bar" style={{ width: `${r.score}%`, background: color }} />
        <span className="ui-meter-score">{r.score}</span>
      </div>
      {r.strengths?.length > 0 && (
        <div className="ui-strengths">
          <b style={{ color: "#3ddc97" }}>+</b> {r.strengths.join(" · ")}
        </div>
      )}
      {r.improvements?.length > 0 && (
        <div className="ui-impr">
          <b style={{ color: "#ff9f1a" }}>→</b> {r.improvements.join(" · ")}
        </div>
      )}
    </div>
  );
}

export default function VisionPanel({ scanId }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setErr("");
    try {
      const v = await api.getVision(scanId);
      setD(v);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId]);

  return (
    <div className="console mt">
      <div className="console-title">
        <span className="traffic">
          <span className="t g" />
          <span className="t a" />
          <span className="t r" />
        </span>
        <span>
          UI RATING — <span className="dim">image analysis · desktop &amp; mobile · {d ? `via ${d.provider}` : "vision"}</span>
        </span>
        <button className="btn btn-ghost btn-xs" onClick={load} disabled={busy}>
          {busy ? "ANALYZING..." : "↻ RE-ANALYZE"}
        </button>
      </div>
      <div className="console-body">
        {err && <div className="error-box">{err}</div>}
        {!d && !err && <div className="small dim">capturing screenshots &amp; analyzing visual trust...</div>}
        {d && (
          <>
            {d.captured === false && <div className="small dim">Screenshots unavailable — showing a source-based estimate.</div>}
            <div className="ui-grid">
              <Rating label="DESKTOP / PC" icon="🖥" r={d.desktop} />
              <Rating label="MOBILE" icon="📱" r={d.mobile} />
            </div>
            <div className="ui-meta">
              <span className={`chip ${d.responsive ? "ok" : ""}`}>
                {d.responsive ? "✓ RESPONSIVE LAYOUT" : "⚠ NOT CLEARLY RESPONSIVE"}
              </span>
            </div>
            {d.visualVibe?.length > 0 && (
              <div className="ui-vibes">
                <span className="label">Visual trust signals</span>
                <div className="ui-vibe-chips">
                  {d.visualVibe.map((v) => (
                    <span key={v} className="nav-pill" style={{ margin: "0 6px 6px 0", display: "inline-block" }}>
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {d.gradingNote && <div className="small dim mt">{d.gradingNote}</div>}
          </>
        )}
      </div>
    </div>
  );
}
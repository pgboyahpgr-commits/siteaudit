import { useState, useEffect } from "react";
import { api } from "../api.js";
import { scoreColor } from "../theme.js";

function VibeMeter({ score }) {
  const color = score >= 70 ? "#ff4d5e" : score >= 45 ? "#ffb020" : score >= 20 ? "#38e1ff" : "#33ffa1";
  return (
    <div className="vibe-meter">
      <div className="vibe-track">
        <div className="vibe-fill" style={{ width: `${Math.max(3, score)}%`, background: color }} />
      </div>
      <div className="vibe-scale">
        <span>0 · custom</span>
        <span>100 · vibe-coded</span>
      </div>
    </div>
  );
}

export default function AiPanels({ scanId }) {
  const [ai, setAi] = useState(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const r = await api.getAi(scanId);
        if (!stop) {
          setAi(r.ai);
          setState("ready");
        }
      } catch (err) {
        if (!stop) setState("error");
      }
    })();
    return () => {
      stop = true;
    };
  }, [scanId]);

  if (state === "loading") {
    return (
      <div className="console mt">
        <div className="console-title"><span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span><span>ai_analyst.exe — generating insights...</span></div>
        <div className="console-body">
          <div className="loading" style={{ padding: 20 }}>
            <span className="spinner" /> running AI analysis (vibe check + risk report + fix plan)...
          </div>
        </div>
      </div>
    );
  }

  if (state === "error" || !ai) {
    return (
      <div className="empty mt">
        <span className="big">✕</span>
        AI analysis unavailable.
        <div className="small dim mt">The local fallback engine couldn't produce a report for this scan.</div>
      </div>
    );
  }

  const sevColor = ai.severityAssessment === "high" ? "#ff4d5e" : ai.severityAssessment === "medium" ? "#ffb020" : "#33ffa1";

  return (
    <div className="ai-wrap">
      {/* ---- AI RISK REPORT ---- */}
      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>ai_analyst.exe — RISK REPORT {ai.engine === "ai" ? `via ${ai.provider}` : "(local engine)"}</span>
        </div>
        <div className="console-body">
          <div className="ai-summary">
            <span className="ai-sev" style={{ color: sevColor, borderColor: sevColor }}>
              {ai.severityAssessment?.toUpperCase() || "N/A"} RISK
            </span>
            <p>{ai.summary}</p>
          </div>
          {ai.priorities?.length > 0 && (
            <div className="block">
              <div className="label">TOP PRIORITIES</div>
              <ol className="ai-list">
                {ai.priorities.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* ---- VIBE CHECK ---- */}
      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>vibe_check.exe — how vibe-coded is this site?</span>
        </div>
        <div className="console-body">
          <div className="vibe-head">
            <div className="vibe-score" style={{ color: scoreColor(100 - ai.vibe.score) }}>
              <b>{ai.vibe.score}</b>
              <span>/100 vibe-coded</span>
            </div>
            <div className="vibe-meta">
              <span className={`nav-pill ${ai.vibe.score >= 45 ? "" : "live"}`} style={{ cursor: "default", display: "inline-block" }}>
                {ai.vibe.label}
              </span>
              <span className="small dim">{ai.vibe.signalCount} signals detected</span>
            </div>
          </div>
          <VibeMeter score={ai.vibe.score} />
          <p className="vibe-assess">{ai.vibe.assessment}</p>
          {ai.vibe.recommendations?.length > 0 && (
            <div className="block">
              <div className="label">MAKE IT LOOK PRODUCTION-GRADE</div>
              <ol className="ai-list">
                {ai.vibe.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ol>
            </div>
          )}
          {ai.vibe.signals?.length > 0 && (
            <details className="vibe-details">
              <summary>Show detected signals ({ai.vibe.signals.length})</summary>
              {ai.vibe.signals.map((s, i) => (
                <div key={i} className="vibe-signal">
                  <span className="vs-name">{s.name}</span>
                  <span className="vs-detail">{s.detail}</span>
                  <span className="vs-evidence">{s.evidence}</span>
                </div>
              ))}
            </details>
          )}
        </div>
      </div>

      {/* ---- AI FIX PLAN ---- */}
      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>fix_engine.exe — prioritized remediation plan</span>
        </div>
        <div className="console-body">
          {ai.fixPlan?.length ? (
            ai.fixPlan.map((f, i) => (
              <div key={i} className="fix-step">
                <div className="fix-num">{String(i + 1).padStart(2, "0")}</div>
                <div className="fix-body">
                  <b>{f.step}</b>
                  <p>{f.action}</p>
                  <p className="fix-why">why: {f.why}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="small dim">No fix steps were generated for this scan.</div>
          )}
        </div>
      </div>
    </div>
  );
}

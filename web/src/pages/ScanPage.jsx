import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { api, getToken } from "../api.js";
import ScoreRing from "../components/ScoreRing.jsx";
import VerificationModal from "../components/VerificationModal.jsx";
import EndpointTable from "../components/EndpointTable.jsx";
import AiPanels from "../components/AiPanels.jsx";
import AdvisorChat from "../components/AdvisorChat.jsx";
import HostInfoPanel from "../components/HostInfoPanel.jsx";
import VideoGuides from "../components/VideoGuides.jsx";
import FindingFixTools from "../components/FindingFixTools.jsx";
import VisionPanel from "../components/VisionPanel.jsx";
import { downloadJSON, downloadCSV, downloadHTML } from "../report.js";
import { SEV_ORDER } from "../theme.js";
import { setAgentContext } from "../agentContext.js";
import { saveScanToHistory } from "../scanHistory.js";

const PHASE_LINE = {
  discovery: ["[phase:discovery]", "[crawl]", "Crawling pages, robots.txt & collecting source..."],
  fingerprint: ["[phase:fingerprint]", "[tech]", "Detecting technologies and versions..."],
  headers: ["[phase:headers]", "[audit]", "Auditing headers, cookies & CORS..."],
  tls: ["[phase:tls]", "[tls]", "Handshake & certificate analysis..."],
  enumeration: ["[phase:enumeration]", "[probe]", "Probing exposed paths, dir listings & source maps..."],
  endpoints: ["[phase:endpoints]", "[reverse]", "Reverse-engineering & probing every endpoint..."],
  source: ["[phase:source]", "[regex]", "Scanning source for secrets, leaks & CSRF..."],
  cve: ["[phase:cve]", "[match]", "Matching detected versions against known CVEs..."],
  done: ["[complete]", "[ok]", "Scan complete. Report generated."],
};

export default function ScanPage() {
  const { id } = useParams();
  const [scan, setScan] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState({});
  const [showVerify, setShowVerify] = useState(false);
  const [fullError, setFullError] = useState("");
  const [saved, setSaved] = useState(false);
  const termRef = useRef(null);

  useEffect(() => {
    let stop = false;
    let timer;
    let retries = 0;
    const load = async () => {
      try {
        const s = await api.getScan(id);
        if (stop) return;
        setScan(s);
        setError("");
        setAgentContext({ scanId: s.scanId, targetUrl: s.targetUrl });
        if (s.status === "completed" && s.findings?.length > 0) {
          saveScanToHistory(s);
        }
        retries = 0;
        if (s.status === "queued" || s.status === "running") {
          timer = setTimeout(load, 1300);
        }
      } catch (err) {
        if (stop) return;
        if (retries < 3) {
          retries++;
          timer = setTimeout(load, 2000 * retries);
        } else {
          setError(err.message);
        }
      }
    };
    load();
    return () => {
      stop = true;
      clearTimeout(timer);
      setAgentContext({ scanId: null, targetUrl: null });
    };
  }, [id]);

  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [scan?.progress]);

  const terminalLines = useMemo(() => {
    const lines = [];
    if (!scan) return lines;
    lines.push(`$ siteaudit --target "${scan.targetUrl}" --mode ${scan.mode}`);
    lines.push(`> consent_ok=true · scope_lock=${scan.host} · depth=${scan.crawlDepth || 25}`);
    if (scan.status === "queued") {
      lines.push("> job enqueued — waiting for scanner worker...");
      return lines;
    }
    if (scan.status === "failed") {
      lines.push(["! FATAL: " + (scan.error || "scan failed"), "err"]);
      return lines;
    }
    const seen = new Set();
    if (scan.progress?.phase) {
      const pl = PHASE_LINE[scan.progress.phase] || ["[phase]", "[scan]", scan.progress.message];
      if (!seen.has(pl[0])) {
        seen.add(pl[0]);
        lines.push([`${pl[0]} ${pl[1]} ${pl[2]}`, "ok"]);
      }
    }
    if (scan.meta) {
      lines.push([`> pages_crawled=${scan.meta.pagesCrawled} · js_files=${(scan.meta.jsFiles || []).length} · endpoints=${scan.meta.endpointCount ?? (scan.meta.endpoints || []).length} · cookies=${(scan.meta.cookies || []).length}`, "info"]);
      if (scan.meta.robots?.disallowed?.length) {
        lines.push([`> robots.txt: ${scan.meta.robots.disallowed.length} disallowed paths`, "info"]);
      }
      if (scan.meta.tech?.length) {
        lines.push([`> tech: ${scan.meta.tech.map((t) => t.name + (t.version ? "@" + t.version : "")).join(", ").slice(0, 120)}`, "info"]);
      }
    }
    if (scan.status === "completed") {
      lines.push([`> findings=${(scan.findings || []).length} · score=${scan.score}`, "ok"]);
      lines.push(["$ exit 0 — report ready", "dim"]);
    }
    return lines;
  }, [scan]);

  if (error) {
    return (
      <div className="empty">
        <span className="big">✕</span>
        {error}
        <div className="mt">
          <Link to="/" className="btn btn-ghost btn-sm">
            ← New scan
          </Link>
        </div>
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="center mt" style={{ padding: 60 }}>
        <div className="loading">
          <span className="spinner" /> connecting to scanner...
        </div>
      </div>
    );
  }

  const running = scan.status === "queued" || scan.status === "running";
  const counts = scan.findingsSummary || {};
  const findings = scan.findings || [];
  const filtered = filter === "all" ? findings : findings.filter((f) => f.severity === filter);
  const sorted = [...filtered].sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity));

  const pct =
    scan.status === "completed"
      ? 100
      : scan.status === "failed"
        ? 100
        : Math.round((((scan.progress?.phaseIndex || 1) - 1) / 8) * 100);

  async function runFull() {
    setFullError("");
    try {
      const s = await api.runFull(id);
      window.location.href = `/scan/${s.scanId}`;
    } catch (err) {
      setFullError(err.message);
      if (err.status === 403) setShowVerify(true);
    }
  }

  async function saveToAccount() {
    try {
      await api.saveScan(id);
      setSaved(true);
    } catch (err) {
      if (err.status === 401) window.location.href = "/auth";
      else setFullError(err.message);
    }
  }

  async function shareReport() {
    const url = `${window.location.origin}/scan/${scan.scanId}/report`;
    try {
      await navigator.clipboard.writeText(url);
      setFullError("Report link copied: " + url);
    } catch {
      window.open(url, "_blank", "noopener");
    }
  }

  return (
    <>
      <div className="section-head">
        <div>
          <Link to="/" className="small cyan" style={{ textDecoration: "none" }}>
            ← new scan
          </Link>
          <h2 style={{ marginTop: 6 }}>
            {scan.targetUrl} <span className="dim" style={{ fontSize: 14 }}>· {scan.mode}</span>
          </h2>
        </div>
        <span className={`nav-pill ${scan.verified ? "live" : ""}`} style={{ cursor: "default" }}>
          {scan.verified ? <span className="dot" /> : "🔒 "}
          {scan.verified ? "OWNERSHIP VERIFIED" : "NOT VERIFIED"}
        </span>
      </div>

      {/* ---- SAVE TO ACCOUNT ---- */}
      {!saved && scan.ownerId == null && scan.status === "completed" && (
        <div className="save-banner">
          <span>This scan isn't saved to an account yet.</span>
          {getToken() ? (
            <button className="btn btn-ghost btn-sm" onClick={saveToAccount}>
              SAVE TO MY ACCOUNT →
            </button>
          ) : (
            <Link to="/auth" className="btn btn-ghost btn-sm">
              SIGN IN TO SAVE →
            </Link>
          )}
        </div>
      )}

      {/* ---- VERIFICATION PANEL (always visible when not verified) ---- */}
      {!scan.verified && (
        <div className="verify-banner">
          <div className="vb-left">
            <div className="vb-title">
              <span className="vb-lock">🔒</span> FULL CHECK LOCKED — VERIFY OWNERSHIP TO UNLOCK
            </div>
            <div className="vb-steps">
              <span>1 · GENERATE TOKEN</span>
              <span>2 · PLACE IT ON YOUR SITE</span>
              <span>3 · CLICK VERIFY → DEEP SCAN UNLOCKED</span>
            </div>
            <div className="vb-desc">
              Unlocks: active injection tests (SQLi/XSS), aggressive enumeration, source-map &amp; secret deep scans,
              authenticated areas, and a full endpoint security table.
            </div>
          </div>
          <button className="btn btn-magenta btn-sm" onClick={() => setShowVerify(true)} style={{ flexShrink: 0 }}>
            VERIFY NOW →
          </button>
        </div>
      )}

      {running && (
        <div className="console mt">
          <div className="console-title">
            <span className="traffic">
              <span className="t g" />
              <span className="t a" />
              <span className="t r" />
            </span>
            <span>scan_target.exe — {scan.status}</span>
          </div>
          <div className="console-body">
            <div className="term" ref={termRef}>
              {terminalLines.map((line, i) => {
                const [text, kind] = Array.isArray(line) ? line : [line, "info"];
                return (
                  <div key={i} className={`l t-${kind || "info"}`}>
                    {text}
                  </div>
                );
              })}
              {running && <span className="cursor" />}
            </div>
            <div className="progress-track">
              <div className="progress-label">
                <span>
                  {scan.progress?.phase || "queued"} · {scan.progress?.message || ""}
                </span>
                <span>{pct}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.max(4, pct)}%` }} />
              </div>
            </div>
            <div className="btn-row mt">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowVerify(true)} disabled={scan.verified}>
                🔒 VERIFY OWNERSHIP (WHILE IT SCANS)
              </button>
            </div>
          </div>
        </div>
      )}

      {!running && scan.status === "completed" && (
        <>
          <div className="console mt">
            <div className="console-title">
              <span className="traffic">
                <span className="t g" />
                <span className="t a" />
                <span className="t r" />
              </span>
              <span>REPORT — scan_target.exe — completed</span>
            </div>
            <div className="console-body">
              <div className="score-wrap">
                <ScoreRing score={scan.score} />
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="small dim" style={{ letterSpacing: 2 }}>
                    TARGET PROFILE
                  </div>
                  <div className="mt" style={{ fontSize: 13 }}>
                    {(scan.meta?.tech?.length ? scan.meta.tech.map((t) => `${t.name}${t.version ? " " + t.version : ""}`) : ["Unknown"]).map((t) => (
                      <span key={t} className="nav-pill" style={{ margin: "0 6px 6px 0", display: "inline-block" }}>
                        {t}
                      </span>
                    ))}
                  </div>
                  {scan.meta?.services?.length > 0 && (
                    <div className="mt">
                      <div className="small dim" style={{ letterSpacing: 2, marginBottom: 8 }}>
                        THIRD-PARTY SERVICES
                      </div>
                      {(() => {
                        const groups = {};
                        for (const s of scan.meta.services) {
                          if (!groups[s.category]) groups[s.category] = [];
                          groups[s.category].push(s.name);
                        }
                        const colors = {
                          Analytics: "#4fc3f7",
                          Ads: "#f48fb1",
                          Payments: "#81c784",
                          Chat: "#ce93d8",
                          Marketing: "#ffb74d",
                          CDN: "#90caf9",
                          Auth: "#80cbc4",
                        };
                        return Object.entries(groups).map(([cat, names]) => (
                          <div key={cat} style={{ marginBottom: 6 }}>
                            <span className="nav-pill" style={{ margin: "0 6px 4px 0", display: "inline-block", fontSize: 10, background: colors[cat] || "#666", color: "#000", fontWeight: 700 }}>
                              {cat}
                            </span>
                            {names.map((n) => (
                              <span key={n} className="nav-pill" style={{ margin: "0 4px 4px 0", display: "inline-block", fontSize: 11, background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.2)" }}>
                                {n}
                              </span>
                            ))}
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                  <div className="mt small dim">
                    pages: <b className="cyan">{scan.meta?.pagesCrawled ?? 0}</b> · js:{" "}
                    <b className="cyan">{scan.meta?.jsFiles?.length ?? 0}</b> · endpoints:{" "}
                    <b className="cyan">{scan.meta?.endpointCount ?? scan.meta?.endpoints?.length ?? 0}</b> · cookies:{" "}
                    <b className="cyan">{scan.meta?.cookies?.length ?? 0}</b>
                  </div>
                </div>
              </div>

              <div className="stat-grid">
                {SEV_ORDER.map((s) => (
                  <div key={s} className={`stat ${s}`}>
                    <b>{counts[s] ?? 0}</b>
                    <span>{s}</span>
                  </div>
                ))}
              </div>

              <div className="btn-row mt">
                <button className="btn btn-ghost btn-sm" onClick={() => downloadJSON(scan)}>
                  ⭳ JSON
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => downloadCSV(scan)}>
                  ⭳ CSV
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => downloadHTML(scan)}>
                  ⭳ HTML REPORT
                </button>
                <button className="btn btn-ghost btn-sm" onClick={shareReport}>
                  ⇪ SHARE REPORT
                </button>
                {scan.verified ? (
                  <button className="btn btn-magenta btn-sm" onClick={runFull}>
                    🚀 RUN FULL CHECK
                  </button>
                ) : (
                  <button className="btn btn-magenta btn-sm" onClick={() => setShowVerify(true)}>
                    🔒 UNLOCK FULL CHECK — VERIFY
                  </button>
                )}
              </div>
              {fullError && <div className="error-box">{fullError}</div>}
            </div>
          </div>

          {scan.meta?.endpoints?.length > 0 && (
            <div className="section-head">
              <h2>ENDPOINT MAP ({scan.meta.endpoints.length})</h2>
            </div>
          )}
          {scan.meta?.endpoints?.length > 0 && <EndpointTable endpoints={scan.meta.endpoints} />}

          <VisionPanel scanId={scan.scanId} />
          <VideoGuides scanId={scan.scanId} />

          {/* ---- AI ANALYSIS ---- */}
          <div className="section-head">
            <h2>
              AI ANALYSIS <span className="dim" style={{ fontSize: 13 }}>· risk report · vibe check · fix plan</span>
            </h2>
          </div>
          <AiPanels scanId={scan.scanId} />
          <AdvisorChat scanId={scan.scanId} />

          <HostInfoPanel scanId={scan.scanId} />

          {/* ---- FINDINGS ---- */}
          <div className="section-head">
            <h2>FINDINGS ({findings.length})</h2>
            <div className="filters">
              <button className={`chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
                all
              </button>
              {SEV_ORDER.map((s) => (
                <button key={s} className={`chip ${filter === s ? "active" : ""}`} onClick={() => setFilter(s)}>
                  {s} ({counts[s] ?? 0})
                </button>
              ))}
            </div>
          </div>

          {sorted.length === 0 ? (
            <div className="empty">
              <span className="big">:) </span>
              No {filter !== "all" ? filter : ""} findings.
            </div>
          ) : (
            sorted.map((f) => (
              <div key={f.id} className={`finding sev-${f.severity} ${expanded[f.id] ? "open" : ""}`}>
                <div className="finding-head" onClick={() => setExpanded((p) => ({ ...p, [f.id]: !p[f.id] }))}>
                  <span className="sev">{f.severity}</span>
                  <div className="t">
                    <h3>{f.title}</h3>
                    <div className="meta">
                      <span className="cat">{f.category}</span>
                      {f.url}
                    </div>
                  </div>
                  <span className="chev">▶</span>
                </div>
                {expanded[f.id] && (
                  <div className="finding-body">
                    {f.cveId && (
                      <div className="block">
                        <div className="label">CVE</div>
                        <pre>{f.cveId}</pre>
                      </div>
                    )}
                    {f.evidence && (
                      <div className="block">
                        <div className="label">Evidence</div>
                        <pre>{f.evidence}</pre>
                      </div>
                    )}
                    {f.description && (
                      <div className="block">
                        <div className="label">What this means</div>
                        <p>{f.description}</p>
                      </div>
                    )}
                    {f.fix && (
                      <div className="block fix-box">
                        <div className="label">How to fix</div>
                        <p>{f.fix}</p>
                      </div>
                    )}
                    <FindingFixTools scanId={scan.scanId} finding={f} />
                    {f.references?.length > 0 && (
                      <div className="block refs">
                        <div className="label">References</div>
                        {f.references.map((r) => {
                          let label = r;
                          try { label = new URL(r).hostname; } catch { /* use raw string */ }
                          return (
                            <a key={r} href={r} target="_blank" rel="noreferrer">
                              {label} ↗
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </>
      )}

      {!running && scan.status === "failed" && (
        <div className="empty">
          <span className="big">✕</span>
          Scan failed: {scan.error}
          <div className="mt">
            <Link to="/" className="btn btn-ghost btn-sm">
              ← New scan
            </Link>
          </div>
        </div>
      )}

      {showVerify && <VerificationModal scan={scan} onClose={() => setShowVerify(false)} onVerified={() => window.location.reload()} />}
    </>
  );
}

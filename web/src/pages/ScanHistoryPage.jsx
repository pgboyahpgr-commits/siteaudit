import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { SEV_ORDER } from "../theme.js";

const STORAGE_KEY = "sa_scan_history";

function loadScans() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveScans(scans) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scans));
}

function scoreEmoji(score) {
  if (score == null) return "\u2753";
  if (score >= 90) return "\uD83D\uDFE2";
  if (score >= 70) return "\uD83D\uDFE1";
  if (score >= 50) return "\uD83D\uDFE0";
  if (score >= 30) return "\uD83D\uDFE0";
  return "\uD83D\uDD34";
}

function scoreColor(score) {
  if (score == null) return "var(--dim)";
  if (score >= 90) return "var(--green)";
  if (score >= 70) return "var(--cyan)";
  if (score >= 50) return "var(--amber)";
  if (score >= 30) return "var(--amber)";
  return "var(--red)";
}

function severityColor(sev) {
  const map = { critical: "var(--red)", high: "var(--magenta)", medium: "var(--amber)", low: "var(--cyan)", info: "var(--dim)" };
  return map[sev] || "var(--dim)";
}

function formatDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

export default function ScanHistoryPage() {
  const [scans, setScans] = useState(loadScans);
  const [expanded, setExpanded] = useState({});
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    saveScans(scans);
  }, [scans]);

  function handleDelete(id) {
    setScans((prev) => prev.filter((s) => s.id !== id));
    setExpanded((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSelected((prev) => prev.filter((sid) => sid !== id));
  }

  function handleClearAll() {
    setScans([]);
    setExpanded({});
    setSelected([]);
  }

  function toggleExpand(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((sid) => sid !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  // ── Compare helpers ──────────────────────────────────────────────────
  const compareA = scans.find((s) => s.id === selected[0]);
  const compareB = scans.find((s) => s.id === selected[1]);

  function countSeverity(findings, sev) {
    return (findings || []).filter((f) => f.severity === sev).length;
  }

  function renderCompareRow(label, aVal, bVal, colorFn) {
    const aColor = colorFn ? colorFn(aVal) : "var(--text)";
    const bColor = colorFn ? colorFn(bVal) : "var(--text)";
    return (
      <div className="hi-row" key={label}>
        <span className="hi-k">{label}</span>
        <span style={{ display: "flex", gap: 20 }}>
          <span style={{ color: aColor, minWidth: 60 }}>{aVal ?? "—"}</span>
          <span style={{ color: bColor, minWidth: 60 }}>{bVal ?? "—"}</span>
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="section-head">
        <div>
          <h2>SCAN HISTORY</h2>
          <span className="small dim">Past scans saved to this browser. Compare, review, or delete.</span>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link to="/" className="btn btn-ghost btn-sm">▸ NEW SCAN</Link>
          {scans.length > 0 && (
            <>
              <button
                className={`btn btn-ghost btn-sm ${compareMode ? "" : ""}`}
                style={compareMode ? { borderColor: "var(--magenta)", color: "var(--magenta)" } : {}}
                onClick={() => { setCompareMode(!compareMode); setSelected([]); }}
              >
                {compareMode ? "EXIT COMPARE" : "\u21C4 COMPARE"}
              </button>
              <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={handleClearAll}>
                CLEAR ALL
              </button>
            </>
          )}
        </div>
      </div>

      {scans.length === 0 ? (
        <div className="empty mt">
          <span className="big">\uD83D\uDCCB</span>
          No saved scans yet. Run a scan and it will appear here automatically.
          <div className="mt">
            <Link to="/" className="btn btn-primary btn-sm">▸ RUN YOUR FIRST SCAN</Link>
          </div>
        </div>
      ) : (
        <>
          {/* ---- Compare Panel ---- */}
          {compareMode && selected.length === 2 && compareA && compareB && (
            <div className="console mt">
              <div className="console-title">
                <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
                <span>compare_session.exe — side by side</span>
              </div>
              <div className="console-body">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", marginBottom: 16, fontSize: 13 }}>
                  <div className="center" style={{ color: "var(--cyan)", wordBreak: "break-all" }}>{compareA.url}</div>
                  <div className="center dim">vs</div>
                  <div className="center" style={{ color: "var(--cyan)", wordBreak: "break-all" }}>{compareB.url}</div>
                </div>

                {renderCompareRow("Score", compareA.score, compareB.score, scoreColor)}
                {renderCompareRow("Date", formatDate(compareA.date), formatDate(compareB.date))}

                <div style={{ margin: "10px 0", borderTop: "1px dashed var(--line)" }} />

                {SEV_ORDER.map((sev) =>
                  renderCompareRow(
                    sev.toUpperCase(),
                    countSeverity(compareA.findings, sev),
                    countSeverity(compareB.findings, sev),
                    () => severityColor(sev)
                  )
                )}

                <div style={{ margin: "10px 0", borderTop: "1px dashed var(--line)" }} />

                {renderCompareRow("Headers", compareA.headers?.length, compareB.headers?.length)}
                {renderCompareRow("Endpoints", compareA.endpoints?.length, compareB.endpoints?.length)}
                {renderCompareRow("TLS Issues", compareA.tlsIssues?.length, compareB.tlsIssues?.length)}
                {renderCompareRow("Host", compareA.host, compareB.host)}
              </div>
            </div>
          )}

          {/* ---- Scan List ---- */}
          <div className="scan-table mt">
            {[...scans].reverse().map((scan) => {
              const isOpen = expanded[scan.id];
              const isSelected = selected.includes(scan.id);
              const sevCounts = {};
              (scan.findings || []).forEach((f) => {
                sevCounts[f.severity] = (sevCounts[f.severity] || 0) + 1;
              });

              return (
                <div key={scan.id} style={{ display: "flex", flexDirection: "column" }}>
                  <div
                    className="scan-row"
                    style={{
                      cursor: "pointer",
                      ...(isSelected ? { borderColor: "var(--magenta)", boxShadow: "0 0 8px rgba(255,45,149,0.3)" } : {}),
                    }}
                    onClick={() => {
                      if (compareMode) {
                        toggleSelect(scan.id);
                      } else {
                        toggleExpand(scan.id);
                      }
                    }}
                  >
                    <div className="sr-main">
                      {compareMode && (
                        <span
                          style={{
                            display: "inline-block",
                            width: 16,
                            height: 16,
                            border: "2px solid var(--magenta)",
                            background: isSelected ? "var(--magenta)" : "transparent",
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <span style={{ color: scoreColor(scan.score), fontSize: 22, minWidth: 32 }}>
                        {scoreEmoji(scan.score)}
                      </span>
                      <div>
                        <div className="sr-url" style={{ maxWidth: compareMode ? 280 : 400 }}>{scan.url}</div>
                        <div className="sr-date">{formatDate(scan.date)}</div>
                      </div>
                    </div>
                    <div className="sr-side">
                      {scan.host && <span className="sr-mode">{scan.host}</span>}
                      {scan.score != null && <b style={{ color: scoreColor(scan.score) }}>{scan.score}</b>}
                      <button
                        className="nav-pill"
                        style={{ cursor: "pointer", color: "var(--red)", borderColor: "transparent", padding: "4px 8px" }}
                        onClick={(e) => { e.stopPropagation(); handleDelete(scan.id); }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* ---- Expanded Details ---- */}
                  {isOpen && (
                    <div className="console" style={{ margin: "4px 0 8px", borderTop: "none" }}>
                      <div className="console-body">
                        <div className="stat-grid" style={{ marginTop: 0 }}>
                          {SEV_ORDER.map((sev) => (
                            <div key={sev} className={`stat ${sev}`}>
                              <b>{sevCounts[sev] ?? 0}</b>
                              <span>{sev}</span>
                            </div>
                          ))}
                        </div>

                        {scan.findings && scan.findings.length > 0 && (
                          <div style={{ marginTop: 16 }}>
                            <div className="small dim" style={{ letterSpacing: 2, marginBottom: 8 }}>FINDINGS ({scan.findings.length})</div>
                            {scan.findings.map((f, i) => (
                              <div key={i} className={`finding sev-${f.severity}`}>
                                <div className="finding-head" style={{ cursor: "default" }}>
                                  <span className="sev">{f.severity}</span>
                                  <div className="t">
                                    <h3>{f.title}</h3>
                                    <div className="meta">{f.category && <span className="cat">{f.category}</span>}{f.url}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {(!scan.findings || scan.findings.length === 0) && (
                          <div className="small dim">No findings recorded for this scan.</div>
                        )}

                        <div className="btn-row mt">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => { e.stopPropagation(); handleDelete(scan.id); }}
                          >
                            DELETE SCAN
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => { e.stopPropagation(); toggleExpand(scan.id); }}
                          >
                            COLLAPSE
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {compareMode && selected.length < 2 && (
            <div className="empty mt">
              <span className="big">{selected.length === 0 ? "\uD83D\uDC46" : "\uD83D\uDC46"}</span>
              {selected.length === 0 ? "Click a scan row to select the first one for comparison." : "Select one more scan to compare side-by-side."}
            </div>
          )}
        </>
      )}
    </>
  );
}

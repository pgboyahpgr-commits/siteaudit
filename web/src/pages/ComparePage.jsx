import { useState, useEffect, useRef } from "react";
import { api } from "../api.js";
import ScoreRing from "../components/ScoreRing.jsx";
import { scoreColor, SEV_ORDER } from "../theme.js";

const CELL = { padding: "6px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)", textAlign: "center" };
const SECTION = { padding: "12px 12px 6px", color: "#00d4ff", fontSize: 10, letterSpacing: 1, fontWeight: 700 };

function headerCheck(headers, name) {
  if (!headers) return null;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key ? headers[key] : null;
}

function tlsInfo(meta) {
  const t = meta?.tls || {};
  return { proto: t.protocol || t.tlsVersion || "—", cert: t.certExpiry || t.certExpires || "—", ciphers: t.weakCiphers || t.weakCipherSuites || [] };
}

function corsStatus(meta) {
  if (!meta?.cors) return "—";
  const c = meta.cors;
  if (c.wildcard || c.allowOrigin === "*") return "✗ Wildcard";
  if (c.misconfigured) return "✗ Misconfigured";
  if (c.enabled) return "✓ Enabled";
  return "—";
}

function hdrStatus(meta, name) {
  return headerCheck(meta?.headers, name) ? "✓ Present" : "✗ Missing";
}

function FindingsBars({ summary }) {
  const total = Object.values(summary || {}).reduce((a, b) => (a || 0) + (b || 0), 0);
  if (!total) return <span className="dim small">—</span>;
  return (
    <div style={{ display: "flex", gap: 3, height: 8, borderRadius: 4, overflow: "hidden", alignItems: "center" }}>
      {SEV_ORDER.map((s) => {
        const c = summary[s] || 0;
        const w = (c / total) * 100;
        if (!w) return null;
        return <div key={s} title={`${s}: ${c}`} style={{ width: `${w}%`, background: scoreColor(s === "critical" || s === "high" ? 30 : s === "medium" ? 60 : s === "low" ? 80 : 95), minWidth: 2, flexShrink: 0 }} />;
      })}
      <span className="dim small" style={{ marginLeft: 6, fontSize: 9, lineHeight: "8px" }}>{total}</span>
    </div>
  );
}

function FindingsCounts({ summary }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {SEV_ORDER.map((s) => (
        <span key={s} className="small dim" style={{ fontSize: 9 }}>
          <b style={{ color: scoreColor(s === "critical" ? 0 : s === "high" ? 30 : s === "medium" ? 60 : s === "low" ? 80 : 95) }}>{summary?.[s] || 0}</b> {s}
        </span>
      ))}
    </div>
  );
}

function pill(text, shared) {
  return (
    <span className="nav-pill" key={text} style={{ margin: "0 4px 4px 0", display: "inline-block", fontSize: 10, background: shared ? "rgba(51,255,161,0.12)" : "rgba(0,229,255,0.08)", border: shared ? "1px solid rgba(51,255,161,0.3)" : "1px solid rgba(0,229,255,0.2)" }}>
      {text}
    </span>
  );
}

function ProgressCol({ scan, label }) {
  const pct = scan ? (scan.status === "completed" || scan.status === "failed" ? 100 : Math.round((((scan.progress?.phaseIndex || 1) - 1) / 8) * 100)) : 0;
  return (
    <div className="console" style={{ flex: 1, minWidth: 280 }}>
      <div className="console-title">
        <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
        <span>{label} — {scan?.status || "pending"}</span>
      </div>
      <div className="console-body">
        <div className="dim small" style={{ marginBottom: 8 }}>{scan?.targetUrl || "Waiting..."}</div>
        <div className="progress-track">
          <div className="progress-label"><span>{scan?.progress?.phase || "queued"} · {scan?.progress?.message || ""}</span><span>{pct}%</span></div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${Math.max(4, pct)}%` }} /></div>
        </div>
        {scan && <div className="dim small mt" style={{ fontSize: 10 }}>pages: <b className="cyan">{scan.meta?.pagesCrawled ?? 0}</b> · js: <b className="cyan">{scan.meta?.jsFiles?.length ?? 0}</b> · endpoints: <b className="cyan">{scan.meta?.endpointCount ?? scan.meta?.endpoints?.length ?? 0}</b></div>}
        {scan?.status === "failed" && <div className="error-box mt">{scan.error || "Scan failed"}</div>}
      </div>
    </div>
  );
}

function rowColor(v) {
  if (v.startsWith("✓")) return "#33ffa1";
  if (v.startsWith("✗")) return "#ff4d5e";
  return "#7f92b8";
}

function TableRow({ label, v1, v2, better }) {
  return (
    <tr style={better ? { background: better === 1 ? "rgba(51,255,161,0.06)" : "rgba(51,255,161,0.06)" } : {}}>
      <td style={{ padding: "6px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{label}</td>
      <td style={{ ...CELL, color: rowColor(v1), background: better === 1 ? "rgba(51,255,161,0.06)" : "transparent" }}>{v1}</td>
      <td style={{ ...CELL, color: rowColor(v2), background: better === 2 ? "rgba(51,255,161,0.06)" : "transparent" }}>{v2}</td>
    </tr>
  );
}

function generateCompareImage(scan1, scan2, winner) {
  const canvas = document.createElement("canvas");
  canvas.width = 900; canvas.height = 500;
  const ctx = canvas.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 900, 500);
  g.addColorStop(0, "#0a0a0f"); g.addColorStop(1, "#12122a");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 900, 500);
  ctx.fillStyle = "#00d4ff"; ctx.font = "bold 30px sans-serif"; ctx.fillText("SITEAUDIT VS", 40, 55);
  ctx.fillStyle = "rgba(0,212,255,0.5)"; ctx.font = "12px sans-serif"; ctx.fillText("Side-by-Side Security Comparison", 40, 75);
  ctx.fillStyle = "#33ffa1"; ctx.font = "bold 56px sans-serif"; ctx.fillText(`${scan1.score || "--"}/100`, 60, 210);
  ctx.fillStyle = "#ffb020"; ctx.font = "bold 56px sans-serif"; ctx.fillText(`${scan2.score || "--"}/100`, 520, 210);
  ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "14px sans-serif"; ctx.fillText((scan1.targetUrl || "").slice(0, 40), 60, 240);
  ctx.fillText((scan2.targetUrl || "").slice(0, 40), 520, 240);
  if (winner) {
    ctx.fillStyle = winner === 1 ? "#33ffa1" : "#ffb020"; ctx.font = "bold 60px sans-serif";
    ctx.fillText("WINNER", 350, 140);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.font = "bold 40px sans-serif"; ctx.fillText("DRAW", 380, 140);
  }
  ctx.strokeStyle = "rgba(0,212,255,0.15)"; ctx.beginPath(); ctx.moveTo(450, 80); ctx.lineTo(450, 330); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.font = "11px sans-serif"; ctx.fillText("siteaudit-six.vercel.app", 40, 480);
  ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.font = "13px sans-serif";
  ctx.fillText(`${(scan1.findings || []).length} findings`, 60, 360);
  ctx.fillText(`${(scan2.findings || []).length} findings`, 520, 360);
  return canvas.toDataURL("image/png");
}

export default function ComparePage() {
  const [url1, setUrl1] = useState("");
  const [url2, setUrl2] = useState("");
  const [scan1, setScan1] = useState(null);
  const [scan2, setScan2] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shareImage, setShareImage] = useState(null);
  const timers = useRef({});

  useEffect(() => () => { clearTimeout(timers.current.t1); clearTimeout(timers.current.t2); }, []);

  function poll(scanId, setter, key) {
    api.getScan(scanId).then((s) => {
      setter(s);
      if (s.status === "queued" || s.status === "running") timers.current[key] = setTimeout(() => poll(scanId, setter, key), 1300);
    }).catch(() => { timers.current[key] = setTimeout(() => poll(scanId, setter, key), 3000); });
  }

  async function startCompare(e) {
    e.preventDefault(); setError("");
    let n1 = url1.trim(), n2 = url2.trim();
    if (!/^https?:\/\//i.test(n1)) n1 = "https://" + n1;
    if (!/^https?:\/\//i.test(n2)) n2 = "https://" + n2;
    if (!/^https?:\/\/[^\s]+\.[^\s]+/i.test(n1) || !/^https?:\/\/[^\s]+\.[^\s]+/i.test(n2)) {
      setError("Enter valid URLs for both sites (e.g. https://yoursite.com)"); return;
    }
    setBusy(true); setScan1(null); setScan2(null); setShareImage(null);
    try {
      const c = { agreed: true, statement: "I own these sites or have written permission to test them." };
      const [s1, s2] = await Promise.all([
        api.createScan({ url: n1, mode: "passive", crawlDepth: 25, consent: c }),
        api.createScan({ url: n2, mode: "passive", crawlDepth: 25, consent: c }),
      ]);
      poll(s1.scanId, setScan1, "t1"); poll(s2.scanId, setScan2, "t2");
      setBusy(false);
    } catch (err) { setError(err.message); setBusy(false); }
  }

  function reset() {
    clearTimeout(timers.current.t1); clearTimeout(timers.current.t2);
    setScan1(null); setScan2(null); setBusy(false); setError(""); setShareImage(null);
  }

  function exportImage() {
    if (!scan1 || !scan2) return;
    const w = scan1.score > scan2.score ? 1 : scan2.score > scan1.score ? 2 : 0;
    const u = generateCompareImage(scan1, scan2, w);
    setShareImage(u); window.open(u, "_blank", "noopener");
  }

  const showingResults = scan1?.status === "completed" && scan2?.status === "completed";
  const scanning = busy || (scan1 && scan1.status !== "completed" && scan1.status !== "failed") || (scan2 && scan2.status !== "completed" && scan2.status !== "failed");
  const scanFailed = scan1?.status === "failed" || scan2?.status === "failed";
  const winner = showingResults ? (scan1.score > scan2.score ? 1 : scan2.score > scan1.score ? 2 : 0) : null;

  const tech1 = (scan1?.meta?.tech || []).map((t) => `${t.name}${t.version ? " " + t.version : ""}`);
  const tech2 = (scan2?.meta?.tech || []).map((t) => `${t.name}${t.version ? " " + t.version : ""}`);
  const sharedTech = tech1.filter((t) => tech2.includes(t));
  const unique1 = tech1.filter((t) => !tech2.includes(t));
  const unique2 = tech2.filter((t) => !tech1.includes(t));

  const svcN1 = (scan1?.meta?.services || []).map((s) => s.name);
  const svcN2 = (scan2?.meta?.services || []).map((s) => s.name);
  const sharedSvcs = svcN1.filter((n) => svcN2.includes(n));

  function hval(meta, hdr) { return hdrStatus(meta, hdr); }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px" }}>
      {/* Input phase */}
      {!busy && !scan1 && !scan2 && (
        <form className="console" onSubmit={startCompare}>
          <div className="console-title">
            <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
            <span>vs_mode.exe — side-by-side comparison</span>
          </div>
          <div className="console-body">
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div className="field" style={{ flex: 1, minWidth: 240 }}>
                <div className="field-label"><span>Your Site</span><span className="hint">https://</span></div>
                <input className="url-input" value={url1} onChange={(e) => setUrl1(e.target.value)} placeholder="https://yoursite.com" spellCheck={false} autoComplete="off" autoFocus />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 240 }}>
                <div className="field-label"><span>Competitor</span><span className="hint">https://</span></div>
                <input className="url-input" value={url2} onChange={(e) => setUrl2(e.target.value)} placeholder="https://competitor.com" spellCheck={false} autoComplete="off" />
              </div>
            </div>
            <div className="mt" style={{ textAlign: "center" }}>
              <button className="btn btn-primary" type="submit" style={{ padding: "12px 40px", fontSize: 15 }}>COMPARE</button>
            </div>
            {error && <div className="error-box mt">{error}</div>}
          </div>
        </form>
      )}

      { busy && !scanning && (
        <div className="console mt" style={{ textAlign: "center", padding: 40 }}>
          <div className="loading"><span className="spinner" /> Initializing scans for both sites...</div>
        </div>
      )}

      {/* Scanning progress */}
      {scanning && !showingResults && (
        <>
          <div className="section-head"><h2>SCANNING BOTH SITES <span className="dim" style={{ fontSize: 13 }}>— live progress</span></h2></div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <ProgressCol scan={scan1} label="YOUR SITE" />
            <ProgressCol scan={scan2} label="COMPETITOR" />
          </div>
          {scanFailed && (
            <div className="empty mt"><span className="big">✕</span>One or both scans failed. Check the URLs and try again.
              <div className="mt"><button className="btn btn-ghost btn-sm" onClick={reset}>← Try Again</button></div>
            </div>
          )}
          <div className="btn-row mt"><button className="btn btn-ghost btn-sm" onClick={reset}>✕ Cancel</button></div>
        </>
      )}

      {/* Results */}
      {showingResults && (
        <>
          {winner ? (
            <div className="verify-banner" style={{ borderColor: winner === 1 ? "#33ffa1" : "#ffb020", textAlign: "center" }}>
              <div className="vb-left" style={{ justifyContent: "center", width: "100%" }}>
                <div className="vb-title" style={{ fontSize: 20, justifyContent: "center" }}>
                  <span style={{ color: winner === 1 ? "#33ffa1" : "#ffb020" }}>🏆</span> {winner === 1 ? "YOUR SITE" : "COMPETITOR"} WINS — <b style={{ color: winner === 1 ? "#33ffa1" : "#ffb020" }}>{winner === 1 ? scan1.score : scan2.score}/100</b> vs <b className="dim">{winner === 1 ? scan2.score : scan1.score}/100</b>
                </div>
              </div>
            </div>
          ) : (
            <div className="verify-banner" style={{ borderColor: "#ffb020", textAlign: "center" }}>
              <div className="vb-left" style={{ justifyContent: "center", width: "100%" }}>
                <div className="vb-title" style={{ fontSize: 18, justifyContent: "center" }}>⚖️ DRAW — Both scored <b style={{ color: "#ffb020" }}>{scan1.score}/100</b></div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "center", gap: 40, flexWrap: "wrap", marginTop: 24 }}>
            <div style={{ textAlign: "center" }}>
              <div className="dim small" style={{ marginBottom: 8 }}>YOUR SITE</div>
              <div className="dim small" style={{ marginBottom: 4, fontSize: 11 }}>{scan1.targetUrl}</div>
              <ScoreRing score={scan1.score} />
            </div>
            <div style={{ display: "flex", alignItems: "center", fontSize: 28 }} className="dim">VS</div>
            <div style={{ textAlign: "center" }}>
              <div className="dim small" style={{ marginBottom: 8 }}>COMPETITOR</div>
              <div className="dim small" style={{ marginBottom: 4, fontSize: 11 }}>{scan2.targetUrl}</div>
              <ScoreRing score={scan2.score} />
            </div>
          </div>

          <div className="console mt">
            <div className="console-title">
              <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
              <span>report_diff.exe — comparison results</span>
            </div>
            <div className="console-body">
              <div style={{ overflowX: "auto", width: "100%" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "1px solid rgba(0,212,255,0.1)", color: "#00d4ff", letterSpacing: 1, fontSize: 10 }}>METRIC</th>
                    <th style={{ ...CELL, color: winner === 1 ? "#33ffa1" : "#00d4ff", letterSpacing: 1, fontSize: 10, borderBottom: "1px solid rgba(0,212,255,0.1)" }}>YOUR SITE {winner === 1 ? "★" : ""}</th>
                    <th style={{ ...CELL, color: winner === 2 ? "#ffb020" : "#00d4ff", letterSpacing: 1, fontSize: 10, borderBottom: "1px solid rgba(0,212,255,0.1)" }}>COMPETITOR {winner === 2 ? "★" : ""}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colSpan={3} style={SECTION}>HEADERS & CORS</td></tr>
                  {["content-security-policy", "strict-transport-security", "x-frame-options"].map((h) => {
                    const v1 = hval(scan1?.meta, h), v2 = hval(scan2?.meta, h);
                    const better = (v1.startsWith("✓") && !v2.startsWith("✓")) ? 1 : (v2.startsWith("✓") && !v1.startsWith("✓")) ? 2 : 0;
                    return <TableRow key={h} label={h === "content-security-policy" ? "CSP" : h === "strict-transport-security" ? "HSTS" : "XFO"} v1={v1} v2={v2} better={better} />;
                  })}
                  {(() => { const v1 = corsStatus(scan1?.meta), v2 = corsStatus(scan2?.meta); const better = v1.startsWith("✓") && !v2.startsWith("✓") ? 1 : v2.startsWith("✓") && !v1.startsWith("✓") ? 2 : 0; return <TableRow label="CORS" v1={v1} v2={v2} better={better} />; })()}

                  <tr><td colSpan={3} style={SECTION}>TLS</td></tr>
                  {(() => { const t1 = tlsInfo(scan1?.meta), t2 = tlsInfo(scan2?.meta); const cb = t1.ciphers.length === 0 && t2.ciphers.length > 0 ? 1 : t2.ciphers.length === 0 && t1.ciphers.length > 0 ? 2 : 0; return <><TableRow label="Protocol" v1={t1.proto} v2={t2.proto} /><TableRow label="Cert Expiry" v1={t1.cert} v2={t2.cert} /><TableRow label="Weak Ciphers" v1={t1.ciphers.length ? t1.ciphers.join(", ") : "None"} v2={t2.ciphers.length ? t2.ciphers.join(", ") : "None"} better={cb} /></>; })()}

                  <tr><td colSpan={3} style={SECTION}>CRAWL STATS</td></tr>
                  {[["Pages Crawled", scan1?.meta?.pagesCrawled ?? "—", scan2?.meta?.pagesCrawled ?? "—"], ["Endpoints Found", scan1?.meta?.endpointCount ?? scan1?.meta?.endpoints?.length ?? "—", scan2?.meta?.endpointCount ?? scan2?.meta?.endpoints?.length ?? "—"], ["JS Files", scan1?.meta?.jsFiles?.length ?? "—", scan2?.meta?.jsFiles?.length ?? "—"]].map(([l, a, b]) => (
                    <tr key={l}><td style={{ padding: "6px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{l}</td><td style={CELL}><b className="cyan">{String(a)}</b></td><td style={CELL}><b className="cyan">{String(b)}</b></td></tr>
                  ))}

                  <tr><td colSpan={3} style={SECTION}>FINDINGS BREAKDOWN</td></tr>
                  <tr><td style={{ padding: "8px 12px" }}>By Severity</td><td style={{ padding: "8px 12px" }}><FindingsBars summary={scan1.findingsSummary} /></td><td style={{ padding: "8px 12px" }}><FindingsBars summary={scan2.findingsSummary} /></td></tr>
                  <tr><td style={{ padding: "6px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>Counts</td><td style={{ ...CELL }}><FindingsCounts summary={scan1.findingsSummary} /></td><td style={CELL}><FindingsCounts summary={scan2.findingsSummary} /></td></tr>

                  <tr><td colSpan={3} style={SECTION}>TECH STACK</td></tr>
                  <tr><td style={{ padding: "8px 12px", fontSize: 10 }}>Shared</td><td colSpan={2} style={{ padding: "8px 12px" }}>{sharedTech.length ? sharedTech.map((t) => pill(t, true)) : <span className="dim small">—</span>}</td></tr>
                  <tr><td style={{ padding: "6px 12px", fontSize: 10 }}>Your Site</td><td style={{ padding: "6px 12px" }}>{unique1.length ? unique1.map((t) => pill(t, false)) : <span className="dim small">—</span>}</td><td style={{ padding: "6px 12px" }}>{unique2.length ? unique2.map((t) => pill(t, false)) : <span className="dim small">—</span>}</td></tr>

                  <tr><td colSpan={3} style={SECTION}>THIRD-PARTY SERVICES</td></tr>
                  <tr><td style={{ padding: "8px 12px", fontSize: 10 }}>Total</td><td style={CELL}><b className="cyan">{svcN1.length}</b></td><td style={CELL}><b className="cyan">{svcN2.length}</b></td></tr>
                  <tr><td style={{ padding: "6px 12px", fontSize: 10 }}>Shared</td><td colSpan={2} style={{ padding: "6px 12px" }}>{sharedSvcs.length ? sharedSvcs.map((n) => pill(n, true)) : <span className="dim small">—</span>}</td></tr>
                </tbody>
              </table>
              </div>
            </div>
          </div>
            <button className="btn btn-ghost btn-sm" onClick={reset}>← New Comparison</button>
            <button className="btn btn-primary btn-sm" onClick={exportImage}>🖼️ Export as Image</button>

          {shareImage && (
            <div className="console mt">
              <div className="console-body">
                <img src={shareImage} alt="Comparison preview" style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(0,212,255,0.2)" }} />
                <div className="btn-row" style={{ marginTop: 10 }}>
                  <a className="btn btn-ghost btn-sm" href={shareImage} download="siteaudit-comparison.png" style={{ textDecoration: "none" }}>📥 Download Image</a>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

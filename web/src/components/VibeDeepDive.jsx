import { useCallback } from "react";

const DIMS = [
  { name: "Template Detection", short: "Template" },
  { name: "Placeholder Content", short: "Placeholder" },
  { name: "Scaffold Leftovers", short: "Scaffold" },
  { name: "Free Proxy Backend", short: "Proxy Backend" },
  { name: "Hardcoded Demo Data", short: "Demo Data" },
  { name: "Thin Content", short: "Thin" },
  { name: "Debug Code Exposed", short: "Debug Code" },
  { name: "Stock Assets", short: "Stock" },
];

const CX = 150, CY = 150, R = 120;

function octPoint(i, v, r) {
  const a = (Math.PI * 2 * i) / 8 - Math.PI / 2;
  return { x: CX + (v / 100) * r * Math.cos(a), y: CY + (v / 100) * r * Math.sin(a) };
}

function RadarChart({ signals }) {
  const map = {};
  if (signals) signals.forEach((s) => {
    const idx = DIMS.findIndex((d) => d.name === s.name);
    if (idx >= 0) map[idx] = s.weight ?? 50;
  });
  const vals = DIMS.map((_, i) => map[i] ?? 20);
  const pts = vals.map((v, i) => octPoint(i, v, R));
  const poly = pts.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg width="300" height="300" viewBox="0 0 300 300" style={{ maxWidth: "100%", height: "auto" }}>
      {[0.2, 0.4, 0.6, 0.8, 1.0].map((lvl, li) => (
        <polygon
          key={`g${li}`}
          points={DIMS.map((_, i) => { const pt = octPoint(i, 100 * lvl, R); return `${pt.x},${pt.y}`; }).join(" ")}
          fill="none" stroke="#2a3a6e" strokeWidth={li === 4 ? "1" : "0.7"}
          strokeDasharray={li === 0 || li === 4 ? "0" : "3 5"}
        />
      ))}
      {DIMS.map((_, i) => { const o = octPoint(i, 100, R); return <line key={`ax${i}`} x1={CX} y1={CY} x2={o.x} y2={o.y} stroke="#1c2b47" strokeWidth="0.7" />; })}
      <polygon points={poly} fill="rgba(56,225,255,0.12)" stroke="#38e1ff" strokeWidth="1.6" />
      {pts.map((p, i) => <circle key={`d${i}`} cx={p.x} cy={p.y} r="3" fill="#38e1ff" />)}
      {DIMS.map((d, i) => { const pt = octPoint(i, 100, R + 16); return <text key={`l${i}`} x={pt.x} y={pt.y} textAnchor="middle" dominantBaseline="middle" fill="#7f92b8" fontSize="8.5" fontFamily="monospace">{d.short}</text>; })}
    </svg>
  );
}

function scoreLabel(s) {
  if (s <= 20) return { text: "Production-Grade", color: "#33ffa1" };
  if (s <= 40) return { text: "Semi-Custom", color: "#ffb020" };
  if (s <= 65) return { text: "Template-ish", color: "#f59e0b" };
  return { text: "Vibe-Coded", color: "#ff4d5e" };
}

function VibeCertificate({ score, targetUrl, completedAt, scanId }) {
  const label = scoreLabel(score ?? 50);

  const download = useCallback(() => {
    const c = document.createElement("canvas");
    c.width = 600; c.height = 400;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#121418"; ctx.fillRect(0, 0, 600, 400);
    ctx.strokeStyle = "#2a3a6e"; ctx.lineWidth = 2; ctx.strokeRect(10, 10, 580, 380);
    ctx.strokeStyle = "#38e1ff"; ctx.setLineDash([6, 8]); ctx.lineWidth = 1; ctx.strokeRect(20, 20, 560, 360); ctx.setLineDash([]);
    ctx.fillStyle = "#33ffa1"; ctx.font = "bold 16px monospace"; ctx.textAlign = "center"; ctx.fillText("SITEAUDIT", 300, 55);
    ctx.fillStyle = "#f3f4f6"; ctx.font = "10px monospace"; ctx.fillText("TRUST CERTIFICATE", 300, 80);
    ctx.fillStyle = "#38e1ff"; ctx.font = "bold 64px monospace"; ctx.fillText(String(score ?? "--"), 300, 150);
    ctx.fillStyle = label.color; ctx.font = "bold 12px monospace"; ctx.fillText(label.text, 300, 178);
    ctx.fillStyle = "#9ca3af"; ctx.font = "10px monospace";
    ctx.fillText(`Date: ${completedAt ? new Date(completedAt).toLocaleDateString() : "—"}`, 300, 205);
    ctx.fillText(`URL: ${targetUrl || "—"}`, 300, 225);
    ctx.save(); ctx.translate(400, 310); ctx.rotate(-0.25);
    ctx.strokeStyle = "#33ffa1"; ctx.lineWidth = 1.5; ctx.strokeRect(-75, -18, 150, 36);
    ctx.fillStyle = "#33ffa1"; ctx.font = "bold 12px monospace"; ctx.fillText("VERIFIED BY SITEAUDIT", 0, 5); ctx.restore();
    ctx.fillStyle = "#6b7280"; ctx.font = "9px monospace"; ctx.fillText(`Scan ID: ${scanId || "—"}`, 300, 375);
    c.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `siteaudit-vibecert-${scanId || Date.now()}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    }, "image/png");
  }, [score, targetUrl, completedAt, scanId, label]);

  return (
    <div style={{ background: "var(--bg)", border: "2px solid #2a3a6e", padding: "18px 20px 14px", textAlign: "center", position: "relative" }}>
      <div style={{ fontSize: "13px", color: "var(--green)", fontWeight: 700, letterSpacing: "1px" }}>SITEAUDIT</div>
      <div style={{ fontSize: "9px", letterSpacing: "3px", color: "var(--dim)", marginBottom: 12 }}>TRUST CERTIFICATE</div>
      <div style={{ fontSize: "48px", fontWeight: 700, color: "var(--cyan)", lineHeight: 1 }}>{score ?? "--"}</div>
      <div style={{ fontSize: "11px", fontWeight: 700, color: label.color, letterSpacing: "1.5px", marginTop: 2, textTransform: "uppercase" }}>{label.text}</div>
      <div style={{ fontSize: "10px", color: "var(--dim)", marginTop: 10 }}>
        {completedAt ? new Date(completedAt).toLocaleDateString() : "—"} · {targetUrl || "—"}
      </div>
      <div style={{ position: "absolute", bottom: 12, right: 16, border: "1.5px solid var(--green)", color: "var(--green)", fontSize: "9px", padding: "3px 8px", transform: "rotate(-6deg)", fontWeight: 700, opacity: 0.85 }}>
        VERIFIED BY SITEAUDIT
      </div>
      <button onClick={download} className="btn btn-primary" style={{ marginTop: 16, fontSize: "10px", padding: "8px 12px" }}>
        DOWNLOAD AS PNG
      </button>
    </div>
  );
}

function guessIndustry(meta) {
  if (!meta) return "General";
  const s = JSON.stringify(meta.tech || meta.detectedTech || []).toLowerCase();
  if (/shopify|woocommerce|magento|bigcommerce/.test(s)) return "E-commerce";
  if (/wordpress|drupal|joomla|ghost/.test(s)) return "Content / Blogging";
  if (/react|vue|next|angular/.test(s)) return "SaaS / Web App";
  if (/laravel|django|rails|express/.test(s)) return "Web Application";
  return "General";
}

const AVG = { "E-commerce": 52, "Content / Blogging": 44, "SaaS / Web App": 31, "Web Application": 38, General: 35 };

function IndustryComparison({ avgScore, ourScore, industry }) {
  const bar = (label, score, pct, color) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--dim)", marginBottom: 2 }}>
        <span>{label}</span><span>{score}</span>
      </div>
      <div style={{ height: 12, border: "1px solid #2a3a6e", background: "rgba(0,0,0,0.3)", padding: 1 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, opacity: 0.8 }} />
      </div>
    </div>
  );
  return (
    <div className="mt">
      <div className="block">
        <div className="label">INDUSTRY COMPARISON</div>
        <p style={{ fontSize: "13px", marginBottom: 10 }}>
          Sites in the <strong style={{ color: "var(--cyan)" }}>{industry}</strong> niche average VibeScore{" "}
          <strong style={{ color: "var(--amber)" }}>{avgScore}</strong>. Yours:{" "}
          <strong style={{ color: "var(--green)" }}>{ourScore}</strong>.
        </p>
        {bar("Industry Avg", avgScore, Math.min(100, Math.max(3, avgScore)), "var(--amber)")}
        {bar("This Site", ourScore, Math.min(100, Math.max(3, ourScore)), scoreLabel(ourScore).color)}
      </div>
    </div>
  );
}

function barColor(w) {
  if (w >= 80) return "var(--red)";
  if (w >= 60) return "#f59e0b";
  if (w >= 35) return "var(--amber)";
  return "var(--cyan)";
}

function SignalBreakdown({ signals, vibeScore }) {
  if (!signals?.length) {
    return (
      <div className="block">
        <div className="label">SIGNAL BREAKDOWN</div>
        <p className="small dim">No vibe signals detected for this scan.</p>
      </div>
    );
  }
  return (
    <div className="block">
      <div className="label">SIGNAL BREAKDOWN</div>
      <p className="small dim" style={{ marginBottom: 10 }}>Each signal contributes to VibeScore {vibeScore ?? "—"}.</p>
      {signals.map((s, i) => {
        const w = s.weight ?? 30;
        const bc = barColor(w);
        return (
          <div key={i} style={{ marginBottom: 9, paddingBottom: 9, borderBottom: "1px solid #101a38" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ fontSize: "11.5px", color: "var(--amber)", fontWeight: 600 }}>{s.name}</span>
              <span style={{ fontSize: "10px", color: bc }}>weight: {w}%</span>
            </div>
            <div style={{ height: 7, background: "rgba(0,0,0,0.3)", border: "1px solid #1c2b47", marginBottom: 3 }}>
              <div style={{ height: "100%", width: `${Math.max(2, w)}%`, background: bc, transition: "width 0.6s" }} />
            </div>
            {s.detail && <div style={{ fontSize: "10.5px", color: "var(--dim)", marginTop: 1 }}>{s.detail}</div>}
            {s.evidence && <div style={{ fontSize: "10px", color: "#7f92b8", marginTop: 1, wordBreak: "break-all" }}>{s.evidence}</div>}
          </div>
        );
      })}
    </div>
  );
}

function Console({ title, children }) {
  return (
    <div className="console mt">
      <div className="console-title">
        <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
        <span>{title}</span>
      </div>
      <div className="console-body">{children}</div>
    </div>
  );
}

export default function VibeDeepDive({ scanId, ai, meta }) {
  const vibe = ai?.vibe;
  if (!vibe) {
    return (
      <div className="empty mt">
        <span className="big">{'\u2715'}</span>
        Vibe data is not available for this scan.
      </div>
    );
  }

  const vs = vibe.score ?? 50;
  const industry = guessIndustry(meta);
  const avgScore = AVG[industry] || 35;

  return (
    <>
      <Console title="vibe_deep_dive.exe — full vibe analysis">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "center" }}>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>DIMENSION RADAR</div>
            <RadarChart signals={vibe.signals} />
          </div>
          <VibeCertificate score={vs} targetUrl={meta?.targetUrl} completedAt={meta?.completedAt} scanId={scanId} />
        </div>
      </Console>

      <Console title="industry_benchmark.exe">
        <IndustryComparison avgScore={avgScore} ourScore={vs} industry={industry} />
      </Console>

      <Console title="signal_breakdown.exe — full signal analysis">
        <SignalBreakdown signals={vibe.signals} vibeScore={vs} />
      </Console>
    </>
  );
}

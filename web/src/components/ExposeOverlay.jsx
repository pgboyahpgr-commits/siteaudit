import { useMemo } from "react";

const SEV_COLORS = {
  critical: "#ef4444",
  high: "#f43f5e",
  medium: "#f59e0b",
  low: "#38bdf8",
  info: "#10b981",
};

export default function ExposeOverlay({ scanId, findings, targetUrl }) {
  const markers = useMemo(() => {
    if (!findings || !findings.length) return [];
    const grouped = {};
    for (const f of findings) {
      if (!grouped[f.severity]) grouped[f.severity] = [];
      grouped[f.severity].push(f);
    }

    const severityOrder = ["critical", "high", "medium", "low", "info"];
    const rows = severityOrder.filter((s) => grouped[s]);
    const all = [];

    for (const sev of rows) {
      const items = grouped[sev];
      const cols = Math.min(items.length, 5);
      for (let i = 0; i < items.length; i++) {
        const row = rows.indexOf(sev);
        const col = i % cols;
        all.push({
          ...items[i],
          severity: sev,
          x: 3 + col * (94 / cols),
          y: 10 + row * 16,
        });
      }
    }

    return all;
  }, [findings]);

  const imgUrl = useMemo(() => {
    if (!targetUrl) return null;
    try {
      const host = new URL(targetUrl.startsWith("http") ? targetUrl : "https://" + targetUrl).hostname;
      return `https://image.thum.io/get/1280/${host}`;
    } catch {
      return null;
    }
  }, [targetUrl]);

  if (!findings || !findings.length) return null;

  return (
    <div className="console mt">
      <div className="console-title">
        <span className="traffic">
          <span className="t g" />
          <span className="t a" />
          <span className="t r" />
        </span>
        <span>EXPOSURE MAP — overlay.exe</span>
      </div>
      <div className="console-body">
        <div className="exposure-container">
          {imgUrl ? (
            <img
              className="exposure-bg"
              src={imgUrl}
              alt="Site screenshot"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          ) : (
            <div className="exposure-bg-placeholder">
              <span style={{ fontSize: 40, opacity: 0.25 }}>🛡️</span>
              <div style={{ fontSize: 12, marginTop: 8, opacity: 0.5 }}>
                Screenshot unavailable
              </div>
            </div>
          )}
          <div className="exposure-overlay-layer">
            {markers.map((m, i) => (
              <div
                key={i}
                className={`exposure-marker sev-${m.severity}`}
                style={{ left: `${m.x}%`, top: `${m.y}%` }}
                title={m.title}
              >
                <div className="exposure-dot" style={{ background: SEV_COLORS[m.severity] }} />
                <div className="exposure-tooltip">
                  <span
                    className="exposure-tooltip-sev"
                    style={{ color: SEV_COLORS[m.severity] }}
                  >
                    {m.severity}
                  </span>
                  <span className="exposure-tooltip-title">{m.title}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="exposure-legend">
          {["critical", "high", "medium", "low", "info"].map((sev) => {
            const count = findings.filter((f) => f.severity === sev).length;
            if (!count) return null;
            return (
              <span key={sev} className="exposure-legend-item">
                <span
                  className="exposure-legend-dot"
                  style={{ background: SEV_COLORS[sev] }}
                />
                {sev} ({count})
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { useMemo } from "react";

const SEV_COLORS = {
  critical: "#ef4444",
  high: "#f43f5e",
  medium: "#f59e0b",
  low: "#38bdf8",
  info: "#10b981",
};

const SEV_RADIUS = {
  critical: 10,
  high: 8,
  medium: 6,
  low: 5,
  info: 4,
};

function seededPosition(index, total) {
  const seed = (index * 2654435761) % 1000;
  const x = ((seed % 91) / 100) * 88 + 6;
  const y = ((seed * 7919) % 73) / 100 * 78 + 10;
  return { x, y };
}

export default function ExposeOverlay({ scanId, findings, targetUrl }) {
  const totalFindings = findings?.length || 0;

  const markers = useMemo(() => {
    if (!findings || !findings.length) return [];

    const severityOrder = ["critical", "high", "medium", "low", "info"];
    const grouped = {};
    for (const f of findings) {
      if (!grouped[f.severity]) grouped[f.severity] = [];
      grouped[f.severity].push(f);
    }

    const all = [];
    let idx = 0;
    for (const sev of severityOrder) {
      const items = grouped[sev] || [];
      for (const item of items) {
        const pos = seededPosition(idx, findings.length);
        all.push({
          ...item,
          severity: sev,
          x: pos.x,
          y: pos.y,
          sevIdx: idx,
        });
        idx++;
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
        <span
          style={{
            marginLeft: "auto",
            background: "rgba(239,68,68,0.2)",
            border: "1px solid rgba(239,68,68,0.4)",
            color: "#f87171",
            fontSize: 10,
            padding: "2px 9px",
            borderRadius: 10,
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          {totalFindings} FINDINGS
        </span>
      </div>
      <div className="console-body" style={{ padding: 0 }}>
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 9",
            border: "1px solid var(--line-2)",
            overflow: "hidden",
            background: "var(--bg)",
          }}
        >
          {imgUrl ? (
            <img
              src={imgUrl}
              alt="Site screenshot"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "grid",
                placeItems: "center",
                background: "linear-gradient(135deg, #02040a, #0a1128)",
                color: "var(--dim)",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: 40, opacity: 0.25 }}>🛡️</span>
                <div style={{ fontSize: 12, marginTop: 8, opacity: 0.5 }}>
                  Screenshot unavailable
                </div>
              </div>
            </div>
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.3)",
            }}
          />
          {markers.map((m, i) => {
            const showLabel = i < 5;
            const r = SEV_RADIUS[m.severity] || 6;
            return (
              <div
                key={i}
                title={m.title}
                style={{
                  position: "absolute",
                  left: `${m.x}%`,
                  top: `${m.y}%`,
                  width: r * 2,
                  height: r * 2,
                  transform: "translate(-50%, -50%)",
                  zIndex: 2,
                }}
              >
                <div
                  style={{
                    width: r * 2,
                    height: r * 2,
                    borderRadius: "50%",
                    background: SEV_COLORS[m.severity],
                    boxShadow: `0 0 ${r + 4}px ${SEV_COLORS[m.severity]}, 0 0 ${r * 2 + 6}px ${SEV_COLORS[m.severity]}`,
                    animation: "exposure-pulse 2.2s ease-in-out infinite",
                    position: "absolute",
                    top: 0,
                    left: 0,
                  }}
                />
                {showLabel && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 4px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "rgba(2,4,10,0.92)",
                      border: "1px solid var(--line-2)",
                      padding: "2px 8px",
                      fontSize: 9,
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                      zIndex: 10,
                      maxWidth: 160,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: SEV_COLORS[m.severity],
                      fontWeight: 700,
                      letterSpacing: 0.5,
                    }}
                  >
                    {m.title.length > 24 ? m.title.slice(0, 22) + "..." : m.title}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", padding: "10px 14px", borderTop: "1px dashed var(--line)" }}>
          {["critical", "high", "medium", "low", "info"].map((sev) => {
            const count = findings.filter((f) => f.severity === sev).length;
            if (!count) return null;
            return (
              <span key={sev} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--dim)" }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: SEV_COLORS[sev],
                    boxShadow: `0 0 6px ${SEV_COLORS[sev]}`,
                  }}
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

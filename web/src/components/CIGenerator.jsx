import { useState } from "react";

export default function CIGenerator({ scan }) {
  const [copied, setCopied] = useState(false);

  const yml = `name: SiteAudit Security Scan
on:
  push:
    branches: [main, master]
  schedule:
    - cron: '0 6 * * 1'  # Every Monday at 6 AM

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - name: Run SiteAudit Scan
        run: |
          curl -X POST https://siteaudit-backend-k96o.onrender.com/api/scan \\
            -H "Content-Type: application/json" \\
            -d '{"url":"${scan.targetUrl}","mode":"active","crawlDepth":30,"consent":{"agreed":true,"statement":"CI automated scan"}}'`;

  const curlCommand = `curl -X POST https://siteaudit-backend-k96o.onrender.com/api/scan -H "Content-Type: application/json" -d '{"url":"${scan.targetUrl}","mode":"active","crawlDepth":30,"consent":{"agreed":true,"statement":"CI automated scan"}}'`;

  function copy() {
    navigator.clipboard.writeText(yml).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  function copyCurl() {
    navigator.clipboard.writeText(curlCommand).then(() => {
    }).catch(() => {});
  }

  return (
    <div className="console mt">
      <div className="console-title">
        <span className="traffic">
          <span className="t g" />
          <span className="t a" />
          <span className="t r" />
        </span>
        <span>CI INTEGRATION</span>
      </div>
      <div className="console-body">
        <p className="small dim" style={{ marginBottom: 16, lineHeight: 1.6 }}>
          Paste this in your GitHub repo so SiteAudit automatically scans your site on every push and every Monday morning.
        </p>

        <div style={{
          display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
          fontSize: 11, letterSpacing: 0.5, marginBottom: 10, fontFamily: "var(--mono)",
        }}>
          <span style={{ color: "var(--cyan)", fontWeight: 700 }}>your-repo/</span>
          <span style={{ color: "var(--dim)" }}>→</span>
          <span style={{ color: "var(--green)", fontWeight: 700 }}>.github/</span>
          <span style={{ color: "var(--dim)" }}>→</span>
          <span style={{ color: "var(--green)", fontWeight: 700 }}>workflows/</span>
          <span style={{ color: "var(--dim)" }}>→</span>
          <span style={{ color: "var(--text)", fontWeight: 700 }}>siteaudit.yml</span>
        </div>

        <pre style={{
          background: "var(--panel-2)",
          padding: "16px 20px",
          borderRadius: 6,
          fontSize: 12,
          lineHeight: 1.7,
          overflowX: "auto",
          whiteSpace: "pre-wrap",
          border: "1px solid var(--line)",
          fontFamily: "var(--mono)",
          maxHeight: 260,
          overflowY: "auto",
        }}>
          {yml}
        </pre>

        <button
          className={`btn btn-sm mt`}
          onClick={copy}
          style={{
            width: "100%",
            background: copied ? "var(--green)" : "var(--panel)",
            color: copied ? "var(--bg)" : "var(--green)",
            border: copied ? "1px solid var(--green)" : "1px solid var(--green)",
            fontWeight: 700,
            letterSpacing: 1.5,
            transition: "all 0.15s",
          }}
        >
          {copied ? "COPIED \u2713" : "COPY YML"}
        </button>

        <div style={{
          display: "flex", alignItems: "center", gap: 12, margin: "18px 0",
        }}>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          <span style={{ fontSize: 10, color: "var(--dim)", letterSpacing: 2 }}>OR</span>
          <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
        </div>

        <div className="small dim" style={{ marginBottom: 8 }}>One-off CI command (paste in any CI runner):</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            readOnly
            value={curlCommand}
            onClick={(e) => e.target.select()}
            style={{
              flex: 1, background: "var(--bg)", border: "1px solid var(--line-2)",
              color: "var(--cyan)", fontFamily: "var(--mono)", fontSize: 11,
              padding: "8px 10px", outline: "none", overflowX: "auto",
            }}
          />
          <button className="btn btn-ghost btn-sm" onClick={copyCurl} style={{ flexShrink: 0 }}>
            COPY
          </button>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 10, marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line)",
        }}>
          {[
            { n: "1", t: "Create folder", d: ".github/workflows" },
            { n: "2", t: "Create file", d: "siteaudit.yml" },
            { n: "3", t: "Paste YML", d: "Copy content above" },
            { n: "4", t: "Push & enjoy", d: "Scans on push + Monday" },
          ].map((s) => (
            <div key={s.n} style={{ textAlign: "center" }}>
              <div style={{
                width: 28, height: 28, margin: "0 auto 6px", borderRadius: "50%",
                background: "var(--green)", color: "var(--bg)", display: "grid",
                placeItems: "center", fontSize: 12, fontWeight: 800,
              }}>
                {s.n}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
                {s.t}
              </div>
              <div style={{ fontSize: 10, color: "var(--dim)" }}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

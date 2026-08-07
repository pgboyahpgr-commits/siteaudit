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

  function copy() {
    navigator.clipboard.writeText(yml).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
        }}>
          {yml}
        </pre>
        <div className="btn-row mt">
          <button className={`btn btn-ghost btn-sm`} onClick={copy}>
            {copied ? "COPIED!" : "COPY YML"}
          </button>
        </div>
        <p className="dim small mt" style={{ fontSize: 12, lineHeight: 1.5 }}>
          Drop this file in your repo's <code style={{ background: "var(--panel-3)", padding: "2px 6px", borderRadius: 3 }}>.github/workflows/</code> folder. SiteAudit will scan your site on every push.
        </p>
      </div>
    </div>
  );
}

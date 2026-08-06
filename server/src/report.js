import { computeScore } from "./scan/fixes.js";

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const SEV_COLOR = { critical: "#ff3860", high: "#ff9f1a", medium: "#ffd93d", low: "#3ddc97", info: "#59a2ff" };

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function findingsRows(scan) {
  const rows = [...(scan.findings || [])].sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9));
  return rows
    .map(
      (f) => `<tr>
        <td><span class="sev s-${f.severity}">${f.severity.toUpperCase()}</span></td>
        <td><b>${esc(f.title)}</b><div class="furl">${esc(f.url || "")}</div></td>
        <td class="fcat">${esc(f.category)}</td>
        <td class="fdesc">${esc(f.description)}</td>
        <td class="fev">${esc((f.evidence || "").slice(0, 180))}</td>
      </tr>`
    )
    .join("");
}

function severityTable(scan) {
  const c = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of scan.findings || []) if (c[f.severity] != null) c[f.severity]++;
  return Object.keys(c)
    .map(
      (k) => `<span class="chip"><span class="sev s-${k}">${k.toUpperCase()}</span> ${c[k]}</span>`
    )
    .join(" ");
}

export function renderReport(scan, origin) {
  const score = scan.score ?? computeScore(scan.findings);
  const hostInfo = scan.meta?.hostInfo;
  const ai = scan.ai;
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of scan.findings || []) if (counts[f.severity] != null) counts[f.severity]++;
  const total = scan.findings?.length || 0;

  const aiBlock = ai?.summary
    ? `<div class="box">
        <h3>AI RISK SUMMARY</h3>
        <p>${esc(ai.summary)}</p>
        ${ai.severityAssessment ? `<p class="dim">${esc(ai.severityAssessment)}</p>` : ""}
        ${ai.vibe?.assessment ? `<h3>VIBECHECK (${ai.vibe.score}/100)</h3><p class="dim">${esc(ai.vibe.assessment)}</p>` : ""}
      </div>`
    : "";

  const hostBlock = hostInfo
    ? `<div class="box">
        <h3>HOST &amp; TLS</h3>
        <table class="kv">
          <tr><td>IPv4</td><td>${hostInfo.ipv4.join(", ") || "—"}</td></tr>
          <tr><td>IPv6</td><td>${hostInfo.ipv6.join(", ") || "—"}</td></tr>
          <tr><td>NS</td><td>${hostInfo.ns.join(", ") || "—"}</td></tr>
          <tr><td>MX</td><td>${hostInfo.mx.map((m) => `${m.exchange} (${m.priority})`).join(", ") || "—"}</td></tr>
          <tr><td>Ports 80 / 443 / 22</td><td>${hostInfo.ports.http ? "open" : "closed"} / ${hostInfo.ports.https ? "open" : "closed"} / ${hostInfo.ports.ssh ? "open" : "closed"}</td></tr>
          <tr><td>TLS cert</td><td>${hostInfo.tls.subject || "—"} · ${hostInfo.tls.daysLeft != null ? hostInfo.tls.daysLeft + " days left" : ""}</td></tr>
          <tr><td>TLS protocol</td><td>${hostInfo.tls.protocol || "—"}</td></tr>
          <tr><td>Issuer</td><td>${hostInfo.tls.issuer || "—"}</td></tr>
        </table>
      </div>`
    : "";

  const endpointTable = (scan.meta?.endpoints?.length
    ? `<h3>ENDPOINTS (${scan.meta.endpoints.length})</h3>
       <table><tr><th>Status</th><th>URL</th><th>Type</th></tr>
       ${scan.meta.endpoints
         .map((e) => `<tr><td>${e.status}</td><td>${esc(e.url)}</td><td>${e.isApi ? "API" : esc(e.contentType || "")}</td></tr>`)
         .join("")}</table>`
    : "") + (scan.meta?.jsFiles?.length ? `<p class="dim">${scan.meta.jsFiles.length} JS files · ${scan.meta.pagesCrawled} pages · ${scan.meta.subdomains?.length || 0} subdomains</p>` : "");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SiteAudit Report — ${esc(scan.targetUrl)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { background:#070b14; color:#d6e2f4; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; margin:0; line-height:1.6; }
  .wrap { max-width:980px; margin:0 auto; padding:24px 20px 80px; }
  h1 { font-size:20px; color:#7dfcff; letter-spacing:1px; }
  h2 { font-size:16px; color:#ff5d8f; margin-top:28px; border-bottom:1px solid #1c2b4f; padding-bottom:6px; }
  h3 { font-size:13px; color:#7dfcff; margin:14px 0 6px; }
  .meta { color:#8fa2bf; font-size:12px; }
  .score { font-size:44px; color:#ff5d8f; font-weight:700; }
  .dim { color:#8fa2bf; font-size:12.5px; }
  .box { background:#0a1128; border:1px solid #1c2b4f; border-left:3px solid #7dfcff; padding:14px 16px; margin:12px 0; }
  .chip { margin-right:10px; font-size:12px; }
  .sev { font-size:10px; padding:2px 6px; border-radius:2px; color:#071; font-weight:700; }
  .s-critical{background:#ff3860}.s-high{background:#ff9f1a}.s-medium{background:#ffd93d}.s-low{background:#3ddc97}.s-info{background:#59a2ff}
  table { width:100%; border-collapse:collapse; font-size:12px; margin:8px 0; }
  th, td { text-align:left; padding:6px 8px; border-bottom:1px solid #16224a; vertical-align:top; }
  th { color:#7dfcff; }
  .fcat, .furl { color:#8fa2bf; font-size:11px; }
  .fdesc, .fev { max-width:340px; word-break:break-word; }
  .kv td:first-child { color:#7dfcff; width:130px; }
  .footer { margin-top:40px; font-size:11px; color:#5c6d8c; }
  .printbtn { position:fixed; right:16px; bottom:16px; background:#0a1128; color:#7dfcff; border:1px solid #1c2b4f; padding:10px 14px; font-family:inherit; cursor:pointer; }
</style>
</head>
<body>
<div class="wrap">
  <h1>▣ SITE AUDIT — SECURITY REPORT</h1>
  <div class="meta">${esc(scan.mode.toUpperCase())} · ${new Date(scan.completedAt || scan.createdAt).toISOString().slice(0, 19).replace("T", " ")} UTC · report ID ${esc(scan.reportId || scan.id)}</div>
  <p style="word-break:break-all">Target: <b>${esc(scan.targetUrl)}</b></p>
  <div class="box">
    <span class="score">${score}</span>
    <span class="dim">/ 100</span>
    <div>${severityTable(scan)} · ${total} findings</div>
  </div>
  ${aiBlock}
  ${hostBlock}
  <h2>FINDINGS (${total})</h2>
  <table>
    <tr><th>Severity</th><th>Finding</th><th>Category</th><th>Description</th><th>Evidence</th></tr>
    ${findingsRows(scan)}
  </table>
  <h2>REVERSE-ENGINEERED SURFACE</h2>
  ${endpointTable}
  <div class="footer">Generated by SiteAudit — AI-powered security, privacy &amp; trust agent. Report ID ${esc(scan.reportId || scan.id)} · ${origin}</div>
</div>
<button class="printbtn" onclick="window.print()">⭳ SAVE PDF</button>
</body>
</html>`;
}

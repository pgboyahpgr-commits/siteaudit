function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadJSON(scan) {
  const payload = {
    siteaudit: "report-v1",
    targetUrl: scan.targetUrl,
    mode: scan.mode,
    score: scan.score,
    generatedAt: scan.completedAt || new Date().toISOString(),
    findings: scan.findings,
  };
  download(`siteaudit-${scan.host}-${scan.completedAt?.slice(0, 10) || "report"}.json`, JSON.stringify(payload, null, 2), "application/json");
}

export function downloadCSV(scan) {
  const esc = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const head = "severity,category,title,url,evidence,fix\n";
  const rows = (scan.findings || [])
    .map((f) => [f.severity, f.category, f.title, f.url, f.evidence, f.fix].map(esc).join(","))
    .join("\n");
  download(`siteaudit-${scan.host}.csv`, head + rows, "text/csv");
}

export function downloadHTML(scan) {
  const sevColor = { critical: "#ff4d5e", high: "#ff2d95", medium: "#ffb020", low: "#38e1ff", info: "#7f92b8" };
  const findings = (scan.findings || [])
    .sort((a, b) => ["critical", "high", "medium", "low", "info"].indexOf(a.severity) - ["critical", "high", "medium", "low", "info"].indexOf(b.severity))
    .map(
      (f) => `
      <div class="f" style="border-left:4px solid ${sevColor[f.severity]}">
        <div class="fh">
          <span class="sev" style="color:${sevColor[f.severity]};border:1px solid ${sevColor[f.severity]}">${f.severity}</span>
          <div><h3>${esc(f.title)}</h3><div class="m">${esc(f.url || "")} · ${f.category}</div></div>
        </div>
        ${f.evidence ? `<div class="lbl">Evidence</div><pre>${esc(f.evidence)}</pre>` : ""}
        ${f.description ? `<div class="lbl">Description</div><p>${esc(f.description)}</p>` : ""}
        ${f.fix ? `<div class="lbl" style="color:${sevColor["critical"]}">How to fix</div><p style="background:rgba(51,255,161,.06);border:1px solid rgba(51,255,161,.3);padding:10px">${esc(f.fix)}</p>` : ""}
      </div>`
    )
    .join("\n");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>SiteAudit Report — ${esc(scan.host)}</title>
<style>
body{font-family:ui-monospace,Consolas,monospace;background:#04060c;color:#dce7f5;margin:0;padding:30px;line-height:1.6}
.wrap{max-width:860px;margin:0 auto}
h1{color:#33ffa1;font-size:26px}h1 span{color:#38e1ff}
.score{font-size:44px;color:#33ffa1;margin:10px 0}
.f{border:1px solid #1c2b47;background:#0b1120;margin:14px 0;padding:16px}
.fh{display:flex;gap:12px;align-items:flex-start}
.sev{font-size:11px;letter-spacing:1px;padding:3px 8px;text-transform:uppercase;font-weight:bold}
h3{margin:0;font-size:16px}
.m{font-size:12px;color:#7f92b8;word-break:break-all}
pre{background:#02040a;border:1px solid #1c2b47;padding:10px;color:#38e1ff;font-size:12px;white-space:pre-wrap;word-break:break-word}
.lbl{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#7f92b8;margin:12px 0 4px}
p{margin:0;font-size:13.5px}
a{color:#38e1ff}
</style></head><body><div class="wrap">
<h1>SITEAUDIT<span>//</span>SECURITY REPORT</h1>
<div class="m">Target: <b>${esc(scan.targetUrl)}</b> · Mode: ${scan.mode} · Generated: ${new Date().toISOString()}</div>
<div class="score">Score: ${scan.score ?? "—"} / 100</div>
${findings || "<p>No findings.</p>"}
</div></body></html>`;
  function esc(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  download(`siteaudit-${scan.host}-report.html`, html, "text/html");
}

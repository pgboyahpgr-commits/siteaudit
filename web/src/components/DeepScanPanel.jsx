import { useState } from "react";

function Section({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="console" style={{ marginBottom: 14 }}>
      <div className="console-title" style={{ cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <span className="traffic"><span className={`t ${open ? "g" : "r"}`} /></span>
        <span>{icon} {title}</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--dim)" }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && <div className="console-body">{children}</div>}
    </div>
  );
}

function MiniTable({ rows, cols }) {
  return (
    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
      <thead>
        <tr>{cols.map((c, i) => <th key={i} style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid var(--line)", color: "var(--dim)" }}>{c}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} style={{
                padding: "4px 8px",
                borderBottom: "1px solid var(--line)",
                color: j === 0 ? "#7dfcff" : "var(--fg)",
                fontSize: j === 0 ? 11 : 12,
                fontFamily: j > 1 ? "monospace" : "inherit",
                wordBreak: "break-all",
                maxWidth: j > 1 ? 300 : "none",
              }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Badge({ label, color = "#7dfcff" }) {
  return <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: color + "22", color, border: `1px solid ${color}33`, marginRight: 4 }}>{label}</span>;
}

export default function DeepScanPanel({ scan }) {
  const meta = scan?.meta || {};
  const dns = meta.dnsDeep;
  const supply = meta.supplyChain || [];
  const secTxt = meta.securityTxt;
  const waf = meta.waf || [];
  const cookieScore = meta.cookieScore;
  const jwts = meta.jwts || [];
  const epRisk = meta.endpointRisk || [];

  const hasData = !!(dns || supply.length > 0 || secTxt || waf.length > 0 || cookieScore || jwts.length > 0 || epRisk.length > 0);
  if (!hasData) return null;

  return (
    <div className="section mt-lg">
      <div className="section-head">
        <h2>DEEP SCAN <span className="small dim">15 forensic engines</span></h2>
        <span className="small dim">Email security, supply chain, WAF, cookies, endpoints — scored and audited.</span>
      </div>

      {/* ── Email Security ── */}
      {dns && (
        <Section title="Email Security (SPF / DKIM / DMARC / CAA)" icon="✉" defaultOpen={true}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div style={{ background: "var(--panel-2)", padding: 10, borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: "#7dfcff", marginBottom: 4 }}>SPF</div>
              <div style={{ fontSize: 13 }}>
                {dns.spf.present ? (
                  <><Badge label={dns.spf.mode || "present"} color={dns.spf.mode === "hardfail" ? "#33ffa1" : "#ffb020"} /> <span className="small dim">{dns.spf.raw?.slice(0, 80)}</span></>
                ) : <Badge label="MISSING" color="#ff3860" />}
              </div>
              {dns.spf.issues.map((i, n) => <div key={n} className="small dim" style={{ color: "#ff3860" }}>! {i}</div>)}
            </div>
            <div style={{ background: "var(--panel-2)", padding: 10, borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: "#7dfcff", marginBottom: 4 }}>DKIM</div>
              <div style={{ fontSize: 13 }}>
                {dns.dkim.present ? (
                  <><Badge label={`${dns.dkim.selectors.length} selector(s)`} color="#33ffa1" /> <span className="small dim">{dns.dkim.selectors.map(s => s.selector).join(", ")}</span></>
                ) : <Badge label="NOT FOUND" color="#ff3860" />}
              </div>
              {dns.dkim.issues.map((i, n) => <div key={n} className="small dim" style={{ color: "#ff3860" }}>! {i}</div>)}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: "var(--panel-2)", padding: 10, borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: "#7dfcff", marginBottom: 4 }}>DMARC</div>
              <div style={{ fontSize: 13 }}>
                {dns.dmarc.present ? (
                  <><Badge label={`p=${dns.dmarc.policy || "?"}`} color={dns.dmarc.policy === "reject" ? "#33ffa1" : dns.dmarc.policy === "quarantine" ? "#ffb020" : "#ff3860"} /> {dns.dmarc.pct != null && <Badge label={`${dns.dmarc.pct}%`} />}</>
                ) : <Badge label="MISSING" color="#ff3860" />}
              </div>
              {dns.dmarc.issues.map((i, n) => <div key={n} className="small dim" style={{ color: "#ffb020" }}>! {i}</div>)}
            </div>
            <div style={{ background: "var(--panel-2)", padding: 10, borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: "#7dfcff", marginBottom: 4 }}>CAA</div>
              <div style={{ fontSize: 13 }}>
                {dns.caa.present ? (
                  <><Badge label="present" color="#33ffa1" /> <span className="small dim">{dns.caa.records?.slice(0, 2).join(" · ")}</span></>
                ) : <Badge label="MISSING" color="#ff3860" />}
              </div>
              {dns.caa.issues.map((i, n) => <div key={n} className="small dim" style={{ color: "#ffb020" }}>! {i}</div>)}
            </div>
          </div>

          {meta.dnsFixes?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="small dim" style={{ marginBottom: 6 }}>Recommended DNS records:</div>
              {meta.dnsFixes.map((f, i) => (
                <div key={i} style={{ background: "var(--panel-2)", padding: "8px 10px", borderRadius: 4, marginBottom: 6, fontSize: 11 }}>
                  <span style={{ color: "#7dfcff" }}>{f.type}</span>{" "}
                  <code style={{ color: "#33ffa1", wordBreak: "break-all" }}>{f.name}</code>
                  <div className="small dim">{f.description}</div>
                  <pre style={{ margin: "4px 0 0", fontSize: 10, color: "var(--fg)", background: "var(--bg)", padding: "4px 6px", borderRadius: 3, overflow: "auto" }}>{f.value}</pre>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── DNS Records ── */}
      {dns?.allRecords && (
        <Section title="DNS Record Dump" icon="📡">
          <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 8 }}>
            Full DNS enumeration for {scan?.host}
          </div>
          {dns.allRecords.A?.length > 0 && <div className="small" style={{ marginBottom: 4 }}><span style={{ color: "#7dfcff" }}>A (IPv4):</span> {dns.allRecords.A.join(", ")}</div>}
          {dns.allRecords.AAAA?.length > 0 && <div className="small" style={{ marginBottom: 4 }}><span style={{ color: "#7dfcff" }}>AAAA (IPv6):</span> {dns.allRecords.AAAA.join(", ")}</div>}
          {dns.allRecords.MX?.length > 0 && <div className="small" style={{ marginBottom: 4 }}><span style={{ color: "#7dfcff" }}>MX:</span> {dns.allRecords.MX.map(r => `${r.exchange} (${r.priority})`).join(", ")}</div>}
          {dns.allRecords.NS?.length > 0 && <div className="small" style={{ marginBottom: 4 }}><span style={{ color: "#7dfcff" }}>NS:</span> {dns.allRecords.NS.join(", ")}</div>}
          {dns.allRecords.CNAME?.length > 0 && <div className="small" style={{ marginBottom: 4 }}><span style={{ color: "#7dfcff" }}>CNAME:</span> {dns.allRecords.CNAME.join(", ")}</div>}
          {dns.allRecords.SOA && <div className="small" style={{ marginBottom: 4 }}><span style={{ color: "#7dfcff" }}>SOA:</span> {dns.allRecords.SOA.nsname} (serial: {dns.allRecords.SOA.serial})</div>}
          {dns.allRecords.CAA?.length > 0 && <div className="small" style={{ marginBottom: 4 }}><span style={{ color: "#7dfcff" }}>CAA:</span> {dns.allRecords.CAA.map(r => `${r.tag}="${r.value}"`).join(", ")}</div>}
          {dns.allRecords.TXT?.length > 0 && (
            <div className="small" style={{ marginTop: 8 }}>
              <span style={{ color: "#7dfcff" }}>TXT ({dns.allRecords.TXT.length}):</span>
              {dns.allRecords.TXT.slice(0, 10).map((t, i) => (
                <div key={i} style={{ fontSize: 10, marginLeft: 10, color: "var(--dim)", wordBreak: "break-all", marginTop: 2 }}>{t.slice(0, 200)}</div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── JS Supply Chain ── */}
      {supply.filter(s => s.lib).length > 0 && (
        <Section title="JS Supply Chain Audit" icon="📦">
          <MiniTable
            cols={["Library", "Version", "Source", "CVEs", "SRI"]}
            rows={supply.filter(s => s.lib).map(s => [
              s.lib,
              s.version || "?",
              (s.src || "").slice(-60),
              s.cves.length ? <span style={{ color: "#ff3860" }}>{s.cves.length} vuln(s)</span> : <span style={{ color: "#33ffa1" }}>0</span>,
              s.sri ? <code style={{ fontSize: 9, color: "#33ffa1" }}>{s.sri.slice(0, 30)}...</code> : s.src.startsWith("http") ? <span style={{ color: "#ffb020" }}>missing</span> : "—"
            ])}
          />
        </Section>
      )}

      {/* ── Security.txt ── */}
      {secTxt && (
        <Section title="security.txt (RFC 9116)" icon="🔐">
          {secTxt.present ? (
            <>
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                Score: <Badge label={`${secTxt.score}/100`} color={secTxt.score >= 70 ? "#33ffa1" : "#ffb020"} />
              </div>
              {Object.entries(RFC9116_KEYS).map(([key, label]) => (
                <div key={key} className="small" style={{ marginBottom: 3 }}>
                  <span style={{ color: "#7dfcff" }}>{label}:</span>{" "}
                  <code>{secTxt.fields[key] || <span style={{ color: "#ff3860" }}>missing</span>}</code>
                </div>
              ))}
              {secTxt.issues.map((i, n) => <div key={n} className="small dim" style={{ color: "#ffb020", marginTop: 4 }}>! {i}</div>)}
            </>
          ) : (
            <div className="small dim" style={{ color: "#ffb020" }}>security.txt not published — add to /.well-known/security.txt</div>
          )}
          <pre style={{ marginTop: 8, fontSize: 10, color: "var(--dim)", background: "var(--bg)", padding: 8, borderRadius: 4, maxHeight: 200, overflow: "auto" }}>{secTxt.raw || "No content"}</pre>
        </Section>
      )}

      {/* ── WAF Detection ── */}
      {waf.length > 0 && (
        <Section title="WAF & CDN Detection" icon="🛡">
          {waf.map((w, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ color: "#7dfcff", fontSize: 13 }}>{w.name}</span>
              <Badge label={`${w.confidence} confidence`} color={w.confidence === "high" ? "#33ffa1" : "#ffb020"} />
              <span className="small dim">{w.signalCount}/{w.totalSignals} signals matched</span>
            </div>
          ))}
        </Section>
      )}

      {/* ── Cookie Scoring ── */}
      {cookieScore && cookieScore.totalCookies > 0 && (
        <Section title={`Cookie Security Score: ${cookieScore.overallScore}/100`} icon="🍪">
          <MiniTable
            cols={["Cookie", "Flags", "Issues", "Score"]}
            rows={cookieScore.cookies.map(c => [
              c.name,
              <span style={{ fontSize: 10 }}>
                {c.attributes.secure ? <Badge label="Secure" color="#33ffa1" /> : <Badge label="!Secure" color="#ff3860" />}
                {c.attributes.httpOnly ? <Badge label="HttpOnly" color="#33ffa1" /> : <Badge label="!HttpOnly" color="#ff3860" />}
                {c.attributes.sameSite ? <Badge label={`SameSite=${c.attributes.sameSite}`} color={c.attributes.sameSite === "none" && !c.attributes.secure ? "#ff3860" : "#33ffa1"} /> : <Badge label="!SameSite" color="#ff3860" />}
                {c.attributes.hostPrefix && <Badge label="__Host-" color="#a855f7" />}
                {c.attributes.securePrefix && <Badge label="__Secure-" color="#a855f7" />}
                {c.attributes.partitioned && <Badge label="CHIPS" color="#a855f7" />}
              </span>,
              c.issues.join(" · "),
              <span style={{ color: c.score >= 80 ? "#33ffa1" : c.score >= 50 ? "#ffb020" : "#ff3860", fontWeight: 600 }}>{c.score}</span>
            ])}
          />
        </Section>
      )}

      {/* ── JWT Analysis ── */}
      {jwts.length > 0 && (
        <Section title={`JWT Analysis (${jwts.length} found)`} icon="🔑">
          {jwts.map((j, i) => (
            <div key={i} style={{ marginBottom: 10, padding: "8px 10px", background: "var(--panel-2)", borderRadius: 6 }}>
              <div className="small">
                <Badge label={j.valid ? "valid" : "⚠"} color={j.valid ? "#33ffa1" : "#ff3860"} />
                <code style={{ fontSize: 10, marginLeft: 6 }}>{j.jwt}</code>
                <span className="small dim" style={{ marginLeft: 6 }}>{j.source}</span>
              </div>
              {j.issues.map((iss, n) => (
                <div key={n} style={{ fontSize: 11, marginTop: 3, color: iss.severity === "critical" ? "#ff3860" : iss.severity === "high" ? "#ffb020" : iss.severity === "medium" ? "#ffd93d" : "var(--dim)" }}>
                  [{iss.severity}] {iss.msg}
                </div>
              ))}
            </div>
          ))}
        </Section>
      )}

      {/* ── Endpoint Risk ── */}
      {epRisk.filter(e => e.risk !== "safe").length > 0 && (
        <Section title="Endpoint Risk Matrix" icon="🎯">
          <MiniTable
            cols={["Risk", "Path", "Patterns", "Status"]}
            rows={epRisk.filter(e => e.risk !== "safe").slice(0, 20).map(e => [
              <Badge label={e.risk.toUpperCase()} color={e.risk === "critical" ? "#ff3860" : e.risk === "high" ? "#ffb020" : e.risk === "medium" ? "#ffd93d" : "#3ddc97"} />,
              <code style={{ fontSize: 11 }}>{e.path}</code>,
              e.matchedPatterns.map((p, i) => <div key={i} className="small dim">{p.label}</div>),
              e.status
            ])}
          />
        </Section>
      )}
    </div>
  );
}

const RFC9116_KEYS = {
  contact: "Contact",
  expires: "Expires",
  encryption: "Encryption key",
  canonical: "Canonical URL",
  policy: "Policy URL",
  hiring: "Hiring page",
  acknowledgments: "Acknowledgments",
  preferredLanguages: "Languages",
};

import { useState, useEffect } from "react";
import { api } from "../api.js";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try { return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); } catch { return dateStr; }
}

function TlsHealthBar({ daysLeft }) {
  if (daysLeft == null) return null;
  const pct = Math.max(0, Math.min(100, (daysLeft / 90) * 100));
  const color = daysLeft < 0 ? "var(--red)" : daysLeft < 30 ? "#f59e0b" : "var(--green)";
  const label = daysLeft < 0 ? "EXPIRED" : daysLeft < 30 ? `${daysLeft}d left` : `${daysLeft} days`;
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ height: 4, background: "var(--panel-2)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.5s ease" }} />
      </div>
      <span style={{ fontSize: 10, color }}>{label}</span>
    </div>
  );
}

export default function HostInfoPanel({ scanId }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let stop = false;
    api
      .getHostInfo(scanId)
      .then((d) => !stop && setData(d))
      .catch((e) => !stop && setErr(e.message));
    return () => { stop = true; };
  }, [scanId]);

  if (err) {
    return (
      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>HOST INFO</span>
        </div>
        <div className="console-body small dim">{err}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>HOST INFO — resolving...</span>
        </div>
        <div className="console-body small dim">fetching DNS · TLS · open ports</div>
      </div>
    );
  }

  const Row = ({ k, v, ok, sub }) => (
    <div className="hi-row">
      <span className="hi-k">{k}</span>
      <div style={{ textAlign: "right" }}>
        <span className={`hi-v ${ok == null ? "" : ok ? "hi-ok" : "hi-bad"}`}>{v || "—"}</span>
        {sub && <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );

  const tls = data.tls || {};
  const openPorts = Object.entries(data.ports || {}).filter(([, v]) => v).length;
  const totalPorts = Object.keys(data.ports || {}).length;

  return (
    <div className="console mt">
      <div className="console-title">
        <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
        <span>HOST INFO — {data.host}</span>
        <span className="dim" style={{ fontSize: 11 }}>score {data.score}/100 · {openPorts}/{totalPorts} ports</span>
      </div>
      <div className="console-body">
        <div className="small dim" style={{ marginBottom: 10, letterSpacing: 1, textTransform: "uppercase" }}>DNS Records</div>
        <Row k="IPv4" v={data.ipv4?.join(", ") || "—"} />
        <Row k="IPv6" v={data.ipv6?.join(", ") || "—"} />
        <Row k="NS" v={data.ns?.join(", ") || "—"} />
        <Row k="MX" v={data.mx?.map((m) => `${m.exchange} (${m.priority})`).join(", ") || "—"} />
        <Row k="TXT" v={data.txt?.slice(0, 3).join(" · ") || "—"} />

        <div className="small dim" style={{ margin: "14px 0 10px", letterSpacing: 1, textTransform: "uppercase" }}>Open Ports</div>
        <Row k="80 (HTTP)" v={data.ports.http ? "OPEN" : "closed"} ok={!data.ports.http} />
        <Row k="443 (HTTPS)" v={data.ports.https ? "OPEN" : "closed"} ok={data.ports.https} />
        <Row k="22 (SSH)" v={data.ports.ssh ? "OPEN" : "closed"} ok={!data.ports.ssh} />
        <Row k="8080 (HTTP-Alt)" v={data.ports["http-alt"] ? "OPEN" : "closed"} ok={!data.ports["http-alt"]} />
        <Row k="8443 (HTTPS-Alt)" v={data.ports["https-alt"] ? "OPEN" : "closed"} ok={!data.ports["https-alt"]} />
        {data.ports.mysql ? <Row k="3306 (MySQL)" v="OPEN ⚠" ok={false} /> : null}
        {data.ports.postgres ? <Row k="5432 (Postgres)" v="OPEN ⚠" ok={false} /> : null}
        {data.ports.mongodb ? <Row k="27017 (MongoDB)" v="OPEN ⚠" ok={false} /> : null}
        {data.ports.redis ? <Row k="6379 (Redis)" v="OPEN ⚠" ok={false} /> : null}
        {data.ports.ftp ? <Row k="21 (FTP)" v="OPEN ⚠" ok={false} /> : null}
        {data.ports.smtp ? <Row k="25 (SMTP)" v="OPEN ⚠" ok={false} /> : null}

        <div className="small dim" style={{ margin: "14px 0 10px", letterSpacing: 1, textTransform: "uppercase" }}>
          TLS Certificate {tls.reachable ? `· ${tls.protocol || "?"}` : "· unreachable"}
        </div>
        {tls.reachable ? (
          <>
            <Row k="Issued to" v={tls.subject || "—"} />
            <Row k="Issued by" v={tls.issuer || "—"} />
            <Row
              k="Valid"
              v={`${formatDate(tls.validFrom)} → ${formatDate(tls.validTo)}`}
              ok={tls.daysLeft >= 30}
              sub={<TlsHealthBar daysLeft={tls.daysLeft} />}
            />
            {tls.sans?.length > 0 && (
              <Row k="SANs" v={`${tls.sans.length} domains`} sub={tls.sans.slice(0, 5).join(", ") + (tls.sans.length > 5 ? ` +${tls.sans.length - 5} more` : "")} />
            )}
          </>
        ) : (
          <div className="small dim" style={{ padding: "8px 0" }}>No TLS certificate detected on port 443</div>
        )}
        {tls.issues?.length > 0 && (
          <div className="error-box mt" style={{ marginTop: 10 }}>{tls.issues.join(" ")}</div>
        )}
      </div>
    </div>
  );
}
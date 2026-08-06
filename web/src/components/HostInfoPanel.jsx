import { useState, useEffect } from "react";
import { api } from "../api.js";

export default function HostInfoPanel({ scanId }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let stop = false;
    api
      .getHostInfo(scanId)
      .then((d) => !stop && setData(d))
      .catch((e) => !stop && setErr(e.message));
    return () => {
      stop = true;
    };
  }, [scanId]);

  if (err) {
    return (
      <div className="console mt">
        <div className="console-title">
          <span className="traffic">
            <span className="t g" />
            <span className="t a" />
            <span className="t r" />
          </span>
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
          <span className="traffic">
            <span className="t g" />
            <span className="t a" />
            <span className="t r" />
          </span>
          <span>HOST INFO — resolving...</span>
        </div>
        <div className="console-body small dim">fetching DNS · TLS · open ports</div>
      </div>
    );
  }

  const Row = ({ k, v, ok }) => (
    <div className="hi-row">
      <span className="hi-k">{k}</span>
      <span className={`hi-v ${ok == null ? "" : ok ? "hi-ok" : "hi-bad"}`}>{v || "—"}</span>
    </div>
  );

  return (
    <div className="console mt">
      <div className="console-title">
        <span className="traffic">
          <span className="t g" />
          <span className="t a" />
          <span className="t r" />
        </span>
        <span>
          HOST INFO — {data.host} <span className="dim">· dns · tls · ports</span>
        </span>
        <span className="dim">score {data.score}/100</span>
      </div>
      <div className="console-body">
        <Row k="IPv4" v={data.ipv4.join(", ")} />
        <Row k="IPv6" v={data.ipv6.join(", ")} />
        <Row k="NS" v={data.ns.join(", ")} />
        <Row k="MX" v={data.mx.map((m) => `${m.exchange} (${m.priority})`).join(", ")} />
        <Row k="TXT" v={data.txt.slice(0, 4).join(" · ")} />
        <Row k="Port 80 (HTTP)" v={data.ports.http ? "OPEN" : "closed"} ok={!data.ports.http} />
        <Row k="Port 443 (HTTPS)" v={data.ports.https ? "OPEN" : "closed"} ok={data.ports.https} />
        <Row k="Port 22 (SSH)" v={data.ports.ssh ? "OPEN" : "closed"} ok={!data.ports.ssh} />
        <Row k="Port 8080 (HTTP-Alt)" v={data.ports["http-alt"] ? "OPEN" : "closed"} ok={!data.ports["http-alt"]} />
        <Row k="Port 8443 (HTTPS-Alt)" v={data.ports["https-alt"] ? "OPEN" : "closed"} ok={!data.ports["https-alt"]} />
        {data.ports.mysql ? <Row k="Port 3306 (MySQL)" v="OPEN" ok={false} /> : null}
        {data.ports.postgres ? <Row k="Port 5432 (Postgres)" v="OPEN" ok={false} /> : null}
        {data.ports.mongodb ? <Row k="Port 27017 (MongoDB)" v="OPEN" ok={false} /> : null}
        {data.ports.redis ? <Row k="Port 6379 (Redis)" v="OPEN" ok={false} /> : null}
        {data.ports.ftp ? <Row k="Port 21 (FTP)" v="OPEN" ok={false} /> : null}
        {data.ports.smtp ? <Row k="Port 25 (SMTP)" v="OPEN" ok={false} /> : null}
        <Row k="TLS" v={data.tls.reachable ? `TLS ${data.tls.protocol}` : "not reachable"} ok={data.tls.reachable} />
        <Row k="Certificate" v={data.tls.subject} ok={data.tls.daysLeft >= 0} />
        <Row k="Expires" v={data.tls.daysLeft != null ? `${data.tls.daysLeft} days` : "—"} ok={data.tls.daysLeft >= 30} />
        <Row k="Issuer" v={data.tls.issuer} />
        {data.tls.issues?.length > 0 && <div className="error-box mt">{data.tls.issues.join(" ")}</div>}
      </div>
    </div>
  );
}

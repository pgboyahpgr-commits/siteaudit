import dns from "node:dns/promises";
import tls from "node:tls";
import net from "node:net";
import { createHash } from "node:crypto";

function digest(str) {
  return createHash("sha256").update(str).digest("hex").slice(0, 12);
}

async function portOpen(host, port, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port, timeout: timeoutMs });
    const done = (ok) => {
      sock.removeAllListeners();
      sock.destroy();
      resolve(ok);
    };
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
  });
}

async function sslInfo(host) {
  const info = { reachable: false, issues: [], subject: null, issuer: null, validFrom: null, validTo: null, daysLeft: null, versions: [], protocol: null };
  const socket = tls.connect({ host, port: 443, servername: host, timeout: 6000, rejectUnauthorized: false });
  await new Promise((resolve) => {
    socket.once("secureConnect", resolve);
    socket.once("timeout", resolve);
    socket.once("error", resolve);
  });
  const cert = socket.getPeerCertificate();
  if (cert && Object.keys(cert).length > 0) {
    info.reachable = true;
    info.subject = cert.subject?.CN || null;
    info.issuer = cert.issuer?.CN || null;
    info.validFrom = cert.valid_from || null;
    info.validTo = cert.valid_to || null;
    info.protocol = socket.getProtocol?.() || null;
    if (cert.valid_to) {
      const days = Math.round((new Date(cert.valid_to) - Date.now()) / 86400000);
      info.daysLeft = days;
      if (days < 0) info.issues.push("Certificate has EXPIRED.");
      else if (days < 30) info.issues.push(`Certificate expires in ${days} days — renew soon.`);
    }
    const sans = cert.subjectaltname || "";
    info.sans = sans.split(",").map((s) => s.trim()).filter(Boolean);
  } else {
    info.issues.push("No TLS certificate presented on port 443 (or connection blocked).");
  }
  socket.destroy();
  return info;
}

export async function collectHostInfo(host) {
  const info = { host, fetchedAt: new Date().toISOString(), ipv4: [], ipv6: [], mx: [], txt: [], ns: [], ports: {}, tls: null };

  try {
    const a = await dns.resolve4(host);
    info.ipv4 = a.slice(0, 5);
  } catch {
    /* no A records */
  }
  try {
    const aaaa = await dns.resolve6(host);
    info.ipv6 = aaaa.slice(0, 5);
  } catch {
    /* no AAAA records */
  }
  try {
    const mx = await dns.resolveMx(host);
    info.mx = mx.sort((x, y) => x.priority - y.priority).slice(0, 5);
  } catch {
    /* no MX */
  }
  try {
    const txt = await dns.resolveTxt(host);
    info.txt = txt.map((r) => r.join("")).slice(0, 10);
  } catch {
    /* no TXT */
  }
  try {
    const ns = await dns.resolveNs(host);
    info.ns = ns.slice(0, 5);
  } catch {
    /* no NS */
  }

  const primaryIp = info.ipv4[0] || info.ipv6[0] || host;
  info.ports = {
    http: await portOpen(primaryIp, 80),
    https: await portOpen(primaryIp, 443),
    ssh: await portOpen(primaryIp, 22),
  };
  info.tls = await sslInfo(host);

  const score = sslInfoScore(info);
  return { ...info, score, id: digest(host + info.fetchedAt) };
}

function sslInfoScore(info) {
  let score = 100;
  if (!info.tls.reachable) return 0;
  if (info.tls.daysLeft == null || info.tls.daysLeft < 0) score -= 60;
  else if (info.tls.daysLeft < 30) score -= 25;
  if (!/TLSv1\.3|TLSv1\.2/.test(info.tls.protocol || "")) score -= 15;
  if (info.ports.http) score -= 5;
  return Math.max(score, 0);
}

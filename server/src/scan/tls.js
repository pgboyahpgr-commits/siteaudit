import { connect } from "node:tls";
import { normalizeUrl } from "./http.js";

export function checkTls(targetUrl, { timeout = 10000 } = {}) {
  return new Promise((resolve) => {
    const u = normalizeUrl(targetUrl);
    if (!u || u.protocol !== "https:") {
      return resolve({ https: false, note: "Target is not served over HTTPS." });
    }
    const socket = connect({
      host: u.hostname,
      port: 443,
      servername: u.hostname,
      timeout,
      rejectUnauthorized: false,
    });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ https: true, note: "TLS handshake timed out." });
    }, timeout);

    socket.on("secureConnect", () => {
      const cert = socket.getPeerCertificate();
      const proto = socket.getProtocol();
      clearTimeout(timer);
      const now = Date.now();
      const result = {
        https: true,
        protocol: proto,
        hostname: u.hostname,
        certIssuer: cert?.issuer?.O || "",
        certSubject: cert?.subject?.CN || "",
        notBefore: cert?.valid_from || "",
        notAfter: cert?.valid_to || "",
        expired: cert?.valid_to ? new Date(cert.valid_to).getTime() < now : false,
        notYetValid: cert?.valid_from ? new Date(cert.valid_from).getTime() > now : false,
        selfSigned: cert?.issuer?.CN === cert?.subject?.CN,
        daysRemaining: cert?.valid_to
          ? Math.floor((new Date(cert.valid_to).getTime() - now) / 86400000)
          : null,
        weakProtocol: /TLSv1[01]/.test(proto || ""),
      };
      socket.destroy();
      resolve(result);
    });

    socket.on("error", (err) => {
      clearTimeout(timer);
      resolve({ https: true, error: err.message });
    });
    socket.on("timeout", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ https: true, note: "TLS handshake timed out." });
    });
  });
}

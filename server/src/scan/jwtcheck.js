export function checkJwts(allContent, sourceUrl) {
  const jwtRe = /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
  const found = [];

  for (const s of allContent) {
    jwtRe.lastIndex = 0;
    let match;
    while ((match = jwtRe.exec(s.content))) {
      const jwt = match[0];
      const decoded = decodeJwt(jwt);
      if (!decoded) continue;

      const issues = [];

      // Check alg
      if (decoded.header?.alg === "none") {
        issues.push({ severity: "critical", msg: "alg:none — JWT accepts unsigned tokens (critical vulnerability)" });
      }
      if (!decoded.header?.alg || !/^(HS256|HS384|HS512|RS256|RS384|RS512|ES256|ES384|ES512|PS256|PS384|PS512)$/.test(decoded.header.alg)) {
        if (decoded.header?.alg) issues.push({ severity: "high", msg: `Weak/uncommon algorithm: ${decoded.header.alg}` });
      }

      // Check exp
      if (decoded.payload?.exp) {
        const expDate = new Date(decoded.payload.exp * 1000);
        if (expDate < new Date()) issues.push({ severity: "medium", msg: `Token expired at ${expDate.toISOString()}` });
        else {
          const daysLeft = Math.ceil((expDate - Date.now()) / 86400000);
          if (daysLeft > 365) issues.push({ severity: "low", msg: `Token expires in >1 year (${daysLeft}d) — use shorter lifetimes` });
        }
      } else {
        issues.push({ severity: "medium", msg: "No expiration (exp) claim — token never expires" });
      }

      // Check audience / issuer
      if (!decoded.payload?.aud) issues.push({ severity: "low", msg: "No audience (aud) claim — token may be accepted anywhere" });
      if (!decoded.payload?.iss) issues.push({ severity: "low", msg: "No issuer (iss) claim — can't verify token source" });

      // Check sensitive claims
      if (decoded.payload?.sub && /^\d+$/.test(String(decoded.payload.sub))) {
        issues.push({ severity: "info", msg: "Sequential numeric subject (sub) — may enable user enumeration" });
      }

      found.push({
        jwt: jwt.slice(0, 60) + "...",
        source: s.source || sourceUrl,
        header: decoded.header,
        payload: decoded.payload ? maskSensitivePayload(decoded.payload) : null,
        issues,
        valid: issues.filter(i => i.severity === "critical" || i.severity === "high").length === 0,
      });

      if (found.length >= 5) break;
    }
    if (found.length >= 5) break;
  }

  return found;
}

function decodeJwt(jwt) {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return { header, payload };
  } catch {
    return null;
  }
}

function maskSensitivePayload(payload) {
  const masked = { ...payload };
  for (const key of ["email", "sub", "name", "iat", "exp", "iss", "aud", "jti"]) {
    if (masked[key] !== undefined && typeof masked[key] === "string" && masked[key].length > 4) {
      masked[key] = masked[key].slice(0, 3) + "***";
    }
  }
  return masked;
}

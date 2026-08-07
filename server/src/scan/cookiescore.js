export function scoreCookies(cookieStrings) {
  const results = [];
  let totalScore = 100;

  for (const raw of cookieStrings) {
    const name = (raw.split(";")[0] || "").split("=")[0].trim();
    if (!name) continue;

    const flags = raw.toLowerCase();
    const cookie = { name, issues: [], score: 100, attributes: {} };

    // Check Secure
    if (/;\s*secure\b/i.test(raw)) cookie.attributes.secure = true;
    else { cookie.issues.push("Missing Secure flag — can be sent over HTTP"); cookie.score -= 25; }

    // Check HttpOnly
    if (/;\s*httponly\b/i.test(flags)) cookie.attributes.httpOnly = true;
    else { cookie.issues.push("Missing HttpOnly flag — readable by JavaScript (XSS risk)"); cookie.score -= 20; }

    // Check SameSite
    const sameSite = flags.match(/;\s*samesite\s*=\s*(\w+)/i);
    if (sameSite) {
      cookie.attributes.sameSite = sameSite[1].toLowerCase();
      if (cookie.attributes.sameSite === "none") {
        if (!cookie.attributes.secure) {
          cookie.issues.push("SameSite=None requires Secure flag — browsers will reject");
          cookie.score -= 30;
        }
      }
    } else {
      cookie.issues.push("Missing SameSite flag — vulnerable to CSRF");
      cookie.score -= 15;
    }

    // Check __Host- prefix (strongest cookie protection)
    if (name.startsWith("__Host-")) {
      cookie.attributes.hostPrefix = true;
      if (!cookie.attributes.secure) cookie.issues.push("__Host- prefixed cookie requires Secure flag");
      if (raw.includes("Domain=") || raw.includes("domain=")) cookie.issues.push("__Host- prefixed cookie must NOT have Domain attribute");
      if (raw.includes("Path=") && !raw.includes("Path=/")) cookie.issues.push("__Host- prefixed cookie must have Path=/");
      if (!raw.includes("Path=/")) cookie.issues.push("__Host- prefixed cookie should set Path=/");
    } else if (name.startsWith("__Secure-")) {
      cookie.attributes.securePrefix = true;
      if (!cookie.attributes.secure) cookie.issues.push("__Secure- prefixed cookie requires Secure flag");
    }

    // Check Partitioned attribute (CHIPS)
    if (/;\s*partitioned\b/i.test(flags)) {
      cookie.attributes.partitioned = true;
      if (!cookie.attributes.secure) cookie.issues.push("Partitioned cookie requires Secure flag");
      if (cookie.attributes.sameSite !== "none") cookie.issues.push("Partitioned cookie requires SameSite=None");
    }

    // Session cookies vs persistent
    if (/;\s*max-age\s*=/i.test(flags) || /;\s*expires\s*=/i.test(flags)) {
      cookie.attributes.persistent = true;
      const maxAge = flags.match(/;\s*max-age\s*=\s*(\d+)/i);
      if (maxAge && parseInt(maxAge[1]) > 86400 * 30) {
        cookie.issues.push("Persistent cookie with long expiry (>30 days) — consider shorter lifetime");
      }
    }

    // Path scope
    const pathMatch = raw.match(/;\s*path\s*=\s*([^;\s]+)/i);
    if (pathMatch) {
      cookie.attributes.path = pathMatch[1];
      if (cookie.attributes.path === "/") cookie.issues.push("Path=/ means cookie sent on every request — narrow path if possible");
    }

    cookie.score = Math.max(0, cookie.score);
    totalScore = Math.min(totalScore, cookie.score);
    results.push(cookie);
  }

  return { cookies: results, overallScore: results.length ? Math.round(results.reduce((s, c) => s + c.score, 0) / results.length) : 0, totalCookies: results.length };
}

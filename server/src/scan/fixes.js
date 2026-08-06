export const FIX_RULES = {
  header: {
    fix: "Add the missing security headers. See the missing-header list in this finding for the exact header + value to add. On Vercel use `vercel.json`, on Netlify `netlify.toml`, or configure your web server.",
    refs: ["https://owasp.org/www-project-secure-headers/", "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers"],
  },
  tls: {
    fix: "Enforce TLS 1.2+ only, disable TLS 1.0/1.1, and keep your certificate valid and not self-signed for public sites. Add a permanent 301 redirect from HTTP to HTTPS.",
    refs: ["https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html", "https://ssl-config.mozilla.org/"],
  },
  secret: {
    fix: "Immediately rotate/revoke the exposed key, remove it from source and any public bundle, move secrets to environment variables or a secret manager, and add secret-scanning to CI (gitleaks, trufflehog). Check git history for the same secret.",
    refs: ["https://owasp.org/www-project-top-ten/", "https://docs.github.com/en/code-security/secret-scanning"],
  },
  exposure: {
    fix: "Remove the exposed file immediately if it is a backup/config/credential. Block these paths at the web-server layer (deny .git, .env, *.bak, *.sql, *.log). Enable directory indexing rules and keep backups off the public web root.",
    refs: ["https://owasp.org/www-project-web-security-testing-guide/", "https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html"],
  },
  cve: {
    fix: "Upgrade the affected component to the patched version and apply the vendor advisory. If a patch is unavailable, mitigate with WAF rules or remove the component until patched.",
    refs: ["https://nvd.nist.gov/vuln/search", "https://cve.mitre.org/"],
  },
  misconfig: {
    fix: "Disable directory listing, remove default/sample pages, turn off debug/verbose errors in production, and restrict admin & dev paths with authentication.",
    refs: ["https://owasp.org/www-project-web-security-testing-guide/", "https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html"],
  },
  endpoint: {
    fix: "Protect this endpoint with authentication/authorization, validate its inputs, and remove it entirely if it is not needed in production.",
    refs: ["https://owasp.org/www-project-top-ten/", "https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html"],
  },
  injection: {
    fix: "Use parameterized queries / prepared statements everywhere, apply output encoding, validate and sanitize all user input, and keep injection payloads out of production code.",
    refs: ["https://owasp.org/www-project-top-ten/", "https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html"],
  },
  info: {
    fix: "Informational only. Reduce info leakage where practical: hide server banners, remove version strings and emails from public HTML, and stop exposing stack traces.",
    refs: ["https://owasp.org/www-project-web-security-testing-guide/"],
  },
};

export function getFix(category, ctx = {}) {
  const rule = FIX_RULES[category] || FIX_RULES.info;
  let fix = rule.fix;
  for (const [k, v] of Object.entries(ctx)) {
    if (v != null) fix = fix.replaceAll(`{${k}}`, String(v));
  }
  return { fix, references: rule.refs };
}

export const SEVERITY_WEIGHTS = {
  critical: 25,
  high: 12,
  medium: 5,
  low: 2,
  info: 0.5,
};

export function computeScore(findings) {
  const penalty = findings.reduce((sum, f) => sum + (SEVERITY_WEIGHTS[f.severity] || 0), 0);
  return Math.max(0, Math.min(100, Math.round((100 - penalty) * 10) / 10));
}

export function severityLabel(s) {
  return String(s).toUpperCase();
}

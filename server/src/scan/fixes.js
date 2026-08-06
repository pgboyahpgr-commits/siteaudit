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
  cors: {
    fix: "Set Access-Control-Allow-Origin to a specific trusted origin instead of `*`. Never use `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true`. Configure: `Access-Control-Allow-Origin: https://yoursite.com`, `Access-Control-Allow-Credentials: true` (only if needed), `Access-Control-Allow-Methods: GET, POST`, `Access-Control-Allow-Headers: Content-Type`.",
    refs: ["https://owasp.org/www-project-web-security-testing-guide/", "https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS"],
  },
  "mixed-content": {
    fix: "Ensure all resources (scripts, styles, images, fonts, iframes) are loaded over HTTPS. Add `Content-Security-Policy: upgrade-insecure-requests` header to auto-upgrade HTTP links. Also add `Strict-Transport-Security: max-age=31536000; includeSubDomains`.",
    refs: ["https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content", "https://owasp.org/www-project-secure-headers/"],
  },
  "cookie-secure": {
    fix: "Add the `Secure` flag to the Set-Cookie header so the cookie is only sent over HTTPS: `Set-Cookie: name=value; Secure; HttpOnly; SameSite=Lax`. This prevents man-in-the-middle attacks from stealing the cookie over plain HTTP.",
    refs: ["https://owasp.org/www-community/controls/SecureCookieAttribute", "https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies"],
  },
  "cookie-httponly": {
    fix: "Add the `HttpOnly` flag to the Set-Cookie header to prevent JavaScript from accessing the cookie: `Set-Cookie: name=value; HttpOnly; Secure; SameSite=Lax`. This blocks XSS attacks from stealing cookies via `document.cookie`.",
    refs: ["https://owasp.org/www-community/HttpOnly", "https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html"],
  },
  "cookie-samesite": {
    fix: "Add the `SameSite` attribute to the Set-Cookie header to prevent CSRF attacks: `Set-Cookie: name=value; SameSite=Lax; HttpOnly; Secure`. Use `SameSite=Strict` for maximum protection, or `SameSite=Lax` to allow top-level navigations.",
    refs: ["https://owasp.org/www-community/SameSite", "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite"],
  },
  "source-map": {
    fix: "Remove `.js.map` files from your production deployment or restrict access at the web server/CDN level. For Nginx: `location ~ \.map$ { deny all; }`. For Vercel/Netlify: add `.map` to your ignore/build-exclude patterns.",
    refs: ["https://owasp.org/www-project-web-security-testing-guide/", "https://web.dev/articles/source-maps"],
  },
  "directory-listing": {
    fix: "Disable directory listing in your web server config. Nginx: `autoindex off;`. Apache: `Options -Indexes`. IIS: disable directory browsing. Also block common paths (/.git, /.env, /backup) at the server layer.",
    refs: ["https://owasp.org/www-project-web-security-testing-guide/", "https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html"],
  },
  "email-exposure": {
    fix: "Remove raw email addresses from public HTML/JS. Use a contact form with CAPTCHA instead, or obfuscate emails with entities/JS encoding. Server-side: avoid exposing email in API responses and error messages.",
    refs: ["https://owasp.org/www-project-web-security-testing-guide/", "https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html"],
  },
  "open-redirect": {
    fix: "Validate redirect URLs against a whitelist of allowed destinations. Never pass user-supplied URLs directly into a Location header. Use a token-based redirect system or validate that the target URL is relative or matches an allowed domain.",
    refs: ["https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html", "https://owasp.org/www-project-top-ten/"],
  },
  "info-leak": {
    fix: "Remove server version banners: Nginx: `server_tokens off;`. Apache: `ServerTokens Prod; ServerSignature Off`. Hide stack traces with generic error pages. Strip internal IPs and paths from output.",
    refs: ["https://owasp.org/www-project-web-security-testing-guide/", "https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html"],
  },
  "http-method": {
    fix: "Restrict allowed HTTP methods at the server level. Nginx: `limit_except GET POST HEAD { deny all; }`. Apache: `<LimitExcept GET POST HEAD> Deny from all </LimitExcept>`. Remove support for TRACE, PUT, DELETE, PATCH, CONNECT if not needed.",
    refs: ["https://owasp.org/www-project-web-security-testing-guide/", "https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html"],
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

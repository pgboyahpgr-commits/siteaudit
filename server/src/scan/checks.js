import { httpGet, normalizeUrl } from "./http.js";

export const REQUIRED_HEADERS = [
  {
    name: "Content-Security-Policy",
    reason: "Prevents XSS and data injection attacks",
    fix: "Add a Content-Security-Policy header: `default-src 'self'; script-src 'self'; object-src 'none'` (or use a CSP generator).",
  },
  {
    name: "Strict-Transport-Security",
    reason: "Forces HTTPS and prevents protocol downgrade",
    fix: "Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` to your HTTPS responses.",
  },
  {
    name: "X-Frame-Options",
    reason: "Prevents clickjacking",
    fix: "Add `X-Frame-Options: DENY` (or SAMEORIGIN if you embed the site in frames).",
  },
  {
    name: "X-Content-Type-Options",
    reason: "Prevents MIME-sniffing attacks",
    fix: "Add `X-Content-Type-Options: nosniff`.",
  },
  {
    name: "Referrer-Policy",
    reason: "Controls what URL info is leaked to other sites",
    fix: "Add `Referrer-Policy: strict-origin-when-cross-origin`.",
  },
  {
    name: "Permissions-Policy",
    reason: "Restricts browser features (camera, mic, geolocation)",
    fix: "Add `Permissions-Policy: geolocation=(), microphone=(), camera=()`.",
  },
];

export const ADVANCED_HEADERS = [
  {
    name: "Cross-Origin-Opener-Policy",
    reason: "Isolates browsing context groups against cross-origin window attacks (Spectre-era protections)",
    fix: "Add `Cross-Origin-Opener-Policy: same-origin`.",
  },
  {
    name: "Cross-Origin-Resource-Policy",
    reason: "Stops other sites from embedding your resources without permission",
    fix: "Add `Cross-Origin-Resource-Policy: same-origin` (or same-site if you must share).",
  },
  {
    name: "Origin-Agent-Cluster",
    reason: "Requests site isolation for cross-origin frames",
    fix: "Add `Origin-Agent-Cluster: ?1`.",
  },
];

export function analyzeCsp(cspValue) {
  const v = String(cspValue || "").toLowerCase();
  const problems = [];
  if (!v) return null;
  if (/unsafe-inline/.test(v)) problems.push("'unsafe-inline' weakens script/style restrictions and enables XSS");
  if (/unsafe-eval/.test(v)) problems.push("'unsafe-eval' allows eval() and similar sinks");
  if (/^(\*|default-src \*)/.test(v.replace(/\s+/g, " "))) problems.push("wildcard default-src allows everything");
  if (problems.length) {
    return {
      severity: "medium",
      note: problems.join("; ") + ". Tighten the policy to `default-src 'self'; script-src 'self'; object-src 'none'`.",
    };
  }
  return { severity: "info", note: "CSP is present and reasonably strict. Good." };
}

export async function checkHttpMethods(baseUrl) {
  const base = normalizeUrl(baseUrl);
  if (!base) return null;
  const res = await httpGet(base.href, { timeout: 10000, method: "OPTIONS" });
  if (!res.ok) return null;
  const allow = res.headers?.get?.("allow") || res.headers?.get?.("access-control-allow-methods") || "";
  if (!allow) return null;
  const methods = allow.split(",").map((m) => m.trim().toUpperCase());
  const risky = methods.filter((m) => ["PUT", "DELETE", "PATCH", "TRACE", "CONNECT"].includes(m));
  if (risky.length) {
    return { severity: "medium", methods: methods.join(", "), risky };
  }
  return null;
}

export async function enumerateSubdomains(host) {
  try {
    const res = await fetch(`https://crt.sh/?q=${encodeURIComponent(`%25.${host}`)}&output=json`, { headers: { accept: "application/json" } });
    if (!res.ok) return [];
    const data = await res.json();
    const names = new Set();
    for (const row of data) {
      for (const name of String(row?.name_value || "").split(/\r?\n/)) {
        const n = String(name).trim().toLowerCase();
        if (n && n.endsWith(host) && !n.includes("*")) names.add(n);
      }
    }
    names.delete(host);
    return [...names].slice(0, 25);
  } catch {
    return [];
  }
}

export function analyzeCacheControl(path, cacheControl, status) {
  if (!cacheControl || status === 0 || status === 404) return null;
  const cc = String(cacheControl).toLowerCase();
  const sensitive = /(auth|token|session|account|user|profile|admin|private|internal|logout|login|billing|payment|cart|checkout|api)/i.test(path);
  if (!sensitive) return null;
  if (/\bno-store\b|\bno-cache\b|\bprivate\b/.test(cc)) return null;
  if (/\bpublic\b/.test(cc) || cc.includes("max-age")) {
    return { severity: "medium", note: `Sensitive path ${path} is cacheable (${cc}). Shared caches could replay it to other users.` };
  }
  return null;
}

const OPEN_REDIRECT_RE = /(?:location|redirect|return|next|target|dest|callback|continue|goto|url)\s*[:=]\s*["']?(\/\/(?:[^"'\s]+)|\/[^\s"'<>]{1,80}|https?:\/\/(?!\1)[^"'\s<>]+)/gi;

export function scanOpenRedirects(content, source) {
  const hits = [];
  OPEN_REDIRECT_RE.lastIndex = 0;
  let m;
  while ((m = OPEN_REDIRECT_RE.exec(content))) {
    if (m[1] && m[1].length > 1) hits.push(m[1].slice(0, 90));
  }
  return hits.slice(0, 8);
}

export const EXPOSED_PATHS = [
  { path: "/.git/HEAD", label: "Git repository exposed (.git)", check: "ref:" },
  { path: "/.git/config", label: "Git config exposed", check: "[core]" },
  { path: "/.git/objects", label: "Git objects exposed", check: "" },
  { path: "/.gitignore", label: ".gitignore exposed", check: "" },
  { path: "/.env", label: "Environment file exposed (.env)", check: "=" },
  { path: "/.env.local", label: "Local env file exposed", check: "=" },
  { path: "/.env.production", label: "Production env file exposed", check: "=" },
  { path: "/.htaccess", label: "Apache .htaccess exposed", check: "" },
  { path: "/.htpasswd", label: "Apache .htpasswd exposed", check: ":" },
  { path: "/.well-known/security.txt", label: "Security contact file", check: "" },
  { path: "/.DS_Store", label: "macOS .DS_Store exposed", check: "" },
  { path: "/.npmrc", label: "npm config exposed", check: "" },
  { path: "/.dockerenv", label: "Docker environment marker", check: "" },
  { path: "/.ssh/id_rsa", label: "SSH private key exposed", check: "-----BEGIN" },
  { path: "/.ssh/authorized_keys", label: "SSH authorized keys exposed", check: "ssh-" },
  { path: "/wp-config.php", label: "WordPress config exposed", check: "DB_" },
  { path: "/wp-config.php.bak", label: "WordPress config backup", check: "DB_" },
  { path: "/wp-config.php.save", label: "WordPress config backup", check: "DB_" },
  { path: "/wp-config.php~", label: "WordPress config backup", check: "DB_" },
  { path: "/config.php.bak", label: "Config backup file", check: "" },
  { path: "/config.php.old", label: "Config backup file", check: "" },
  { path: "/config.json", label: "Config file exposed", check: "" },
  { path: "/settings.php", label: "Settings file exposed", check: "" },
  { path: "/database.yml", label: "Rails database config exposed", check: "" },
  { path: "/db.php", label: "Database config exposed", check: "" },
  { path: "/backup.zip", label: "Backup archive exposed", check: "" },
  { path: "/backup.tar.gz", label: "Backup archive exposed", check: "" },
  { path: "/backup.sql", label: "Database dump exposed", check: "" },
  { path: "/db.sql", label: "Database dump exposed", check: "" },
  { path: "/dump.sql", label: "Database dump exposed", check: "" },
  { path: "/database.sql", label: "Database dump exposed", check: "" },
  { path: "/data.sql", label: "Database dump exposed", check: "" },
  { path: "/phpinfo.php", label: "PHP info page exposed", check: "phpinfo()" },
  { path: "/phpinfo", label: "PHP info page exposed", check: "phpinfo" },
  { path: "/info.php", label: "PHP info page exposed", check: "phpinfo" },
  { path: "/test.php", label: "Test script exposed", check: "" },
  { path: "/shell.php", label: "PHP shell exposed", check: "" },
  { path: "/server-status", label: "Apache server-status exposed", check: "" },
  { path: "/server-info", label: "Apache server-info exposed", check: "" },
  { path: "/nginx-status", label: "Nginx status exposed", check: "" },
  { path: "/actuator", label: "Spring actuator exposed", check: "" },
  { path: "/actuator/env", label: "Spring actuator env (secrets!)", check: "" },
  { path: "/actuator/health", label: "Spring actuator health", check: "" },
  { path: "/actuator/mappings", label: "Spring actuator mappings", check: "" },
  { path: "/health", label: "Health endpoint exposed", check: "" },
  { path: "/metrics", label: "Metrics endpoint exposed", check: "" },
  { path: "/debug", label: "Debug page exposed", check: "" },
  { path: "/console", label: "Console page exposed", check: "" },
  { path: "/jenkins", label: "Jenkins exposed", check: "" },
  { path: "/phpmyadmin", label: "phpMyAdmin exposed", check: "" },
  { path: "/adminer", label: "Adminer DB exposed", check: "" },
  { path: "/pgadmin", label: "pgAdmin exposed", check: "" },
  { path: "/grafana", label: "Grafana exposed", check: "" },
  { path: "/kibana", label: "Kibana exposed", check: "" },
  { path: "/elastic", label: "Elasticsearch exposed", check: "" },
  { path: "/redis", label: "Redis exposed", check: "" },
  { path: "/swagger.json", label: "Swagger/OpenAPI spec exposed", check: "openapi" },
  { path: "/swagger-ui", label: "Swagger UI exposed", check: "" },
  { path: "/swagger", label: "Swagger UI exposed", check: "" },
  { path: "/api-docs", label: "API docs exposed", check: "" },
  { path: "/openapi.json", label: "OpenAPI spec exposed", check: "openapi" },
  { path: "/redoc", label: "API docs (ReDoc) exposed", check: "" },
  { path: "/graphql", label: "GraphQL endpoint exposed", check: "" },
  { path: "/graphiql", label: "GraphiQL console exposed", check: "" },
  { path: "/api", label: "API root exposed", check: "" },
  { path: "/api/", label: "API root exposed", check: "" },
  { path: "/v1", label: "API v1 exposed", check: "" },
  { path: "/v2", label: "API v2 exposed", check: "" },
  { path: "/package.json", label: "package.json exposed", check: "" },
  { path: "/package-lock.json", label: "package-lock.json exposed", check: "" },
  { path: "/yarn.lock", label: "yarn.lock exposed", check: "" },
  { path: "/composer.json", label: "Composer manifest exposed", check: "" },
  { path: "/go.mod", label: "Go module manifest exposed", check: "" },
  { path: "/admin", label: "Admin panel", check: "" },
  { path: "/admin/", label: "Admin panel", check: "" },
  { path: "/login", label: "Login page", check: "" },
  { path: "/wp-admin", label: "WordPress admin", check: "" },
  { path: "/wp-login.php", label: "WordPress login", check: "" },
  { path: "/user", label: "User area", check: "" },
  { path: "/dashboard", label: "Dashboard", check: "" },
  { path: "/dev", label: "Dev area exposed", check: "" },
  { path: "/test", label: "Test area exposed", check: "" },
  { path: "/staging", label: "Staging area exposed", check: "" },
  { path: "/tmp", label: "Temp dir exposed", check: "" },
  { path: "/temp", label: "Temp dir exposed", check: "" },
  { path: "/logs", label: "Log dir exposed", check: "" },
  { path: "/error", label: "Error page", check: "" },
  { path: "/errors", label: "Error pages", check: "" },
  { path: "/uploads/", label: "Uploads dir", check: "" },
  { path: "/files/", label: "Files dir", check: "" },
  { path: "/images/", label: "Images dir", check: "" },
  { path: "/source", label: "Source dir exposed", check: "" },
  { path: "/src", label: "Source dir exposed", check: "" },
  { path: "/.github", label: "GitHub metadata exposed", check: "" },
  { path: "/.circleci", label: "CI config exposed", check: "" },
  { path: "/Dockerfile", label: "Dockerfile exposed", check: "FROM" },
  { path: "/.dockerignore", label: "Dockerignore exposed", check: "" },
];

export const DIRECTORY_PATHS = [
  "/", "/uploads/", "/images/", "/img/", "/assets/", "/static/", "/media/",
  "/files/", "/downloads/", "/backup/", "/admin/", "/css/", "/js/", "/data/",
];

const DIR_LISTING_RE = /(<title>Index of|Directory listing|Listing of|Parent Directory|\[DIR\]|<-+ &lt;DIR|Index of \/)/i;

export async function checkDirectoryListing(baseUrl) {
  const base = normalizeUrl(baseUrl);
  if (!base) return [];
  const findings = [];
  for (const path of DIRECTORY_PATHS) {
    const url = new URL(path, base.origin).href;
    const res = await httpGet(url, { timeout: 9000 });
    if (res.ok && DIR_LISTING_RE.test(res.text || "")) {
      const body = (res.text || "").slice(0, 400);
      findings.push({
        path,
        url,
        label: "Directory listing enabled",
        preview: body.slice(0, 160),
        sampleFiles: [...body.matchAll(/href="([^"]+)"/g)].slice(0, 8).map((m) => m[1]),
      });
    }
  }
  return findings;
}

export async function fetchRobots(baseUrl) {
  const base = normalizeUrl(baseUrl);
  if (!base) return null;
  const res = await httpGet(new URL("/robots.txt", base.origin).href, { timeout: 9000 });
  if (!res.ok) return null;
  const lines = (res.text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const disallowed = [];
  const sitemaps = [];
  for (const line of lines) {
    const m = /^Disallow:\s*(\S+)/i.exec(line);
    if (m) disallowed.push(m[1]);
    const s = /^Sitemap:\s*(\S+)/i.exec(line);
    if (s) sitemaps.push(s[1]);
  }
  return { content: (res.text || "").slice(0, 2000), disallowed, sitemaps, status: res.status };
}

export async function checkSourceMaps(jsFiles) {
  const results = [];
  for (const js of jsFiles) {
    const mapUrl = js.endsWith(".js") ? js + ".map" : null;
    if (!mapUrl) continue;
    const res = await httpGet(mapUrl, { timeout: 9000 });
    if (res.ok) {
      results.push({ url: mapUrl, status: res.status, size: (res.text || "").length });
    }
  }
  return results;
}

export function analyzeCookies(setCookieValues) {
  const issues = [];
  for (const raw of setCookieValues) {
    const cookieName = (raw.split(";")[0] || "").split("=")[0].trim();
    if (!cookieName) continue;
    const flags = raw.toLowerCase();
    if (!/secure/i.test(flags)) issues.push({ name: cookieName, issue: "missing Secure flag" });
    if (!/httponly/i.test(flags)) issues.push({ name: cookieName, issue: "missing HttpOnly flag" });
    if (!/samesite/i.test(flags)) issues.push({ name: cookieName, issue: "missing SameSite flag" });
  }
  const unique = new Map();
  for (const i of issues) {
    const key = `${i.name}|${i.issue}`;
    if (!unique.has(key)) unique.set(key, i);
  }
  return [...unique.values()].slice(0, 25);
}

export function analyzeCors(headers) {
  const acao = headers?.["access-control-allow-origin"];
  const acac = headers?.["access-control-allow-credentials"];
  if (acao === "*") {
    return { severity: "medium", note: "Access-Control-Allow-Origin: * allows any site to read responses." };
  }
  if (acao && String(acac).toLowerCase() === "true") {
    return { severity: "high", note: `ACAO reflects origin (${acao}) WITH credentials allowed — a CORS misconfiguration.` };
  }
  if (acao && acao !== "*") {
    return { severity: "low", note: `ACAO is set to a specific origin (${acao}); confirm it is intentional.` };
  }
  return null;
}

const STACK_TRACE_RE = /(at\s+[\w$]+.*\(.*:\d+:\d+\)|Traceback \(most recent call last\)|Error:\s*at\s+|com\.[a-z]+\.[a-z]+Exception|System\.Runtime|TypeError:\s|ReferenceError:|Stack trace)/i;
const INTERNAL_IP_RE = /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g;

export function scanInfoLeaks(content, source) {
  const out = [];
  const trace = content.match(STACK_TRACE_RE);
  if (trace) {
    out.push({
      kind: "stack-trace",
      snippet: trace[0].slice(0, 200),
      source,
    });
  }
  const ips = new Set(content.match(INTERNAL_IP_RE) || []);
  for (const ip of [...ips].slice(0, 5)) {
    out.push({ kind: "internal-ip", snippet: ip, source });
  }
  return out;
}

const SECRET_PATTERNS = [
  { name: "AWS Access Key", re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g, sev: "critical" },
  { name: "Private Key (RSA/EC/OPENSSH)", re: /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g, sev: "critical" },
  { name: "Stripe Live Key", re: /\b(sk|pk)_live_[0-9a-zA-Z]{20,}\b/g, sev: "critical" },
  { name: "OpenAI API Key", re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, sev: "critical" },
  { name: "GitHub Token", re: /\bgh[pousr]_[0-9A-Za-z]{36,}\b/g, sev: "critical" },
  { name: "Slack Webhook", re: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9\/]{10,}/g, sev: "high" },
  { name: "Google API Key", re: /\bAIza[0-9A-Za-z\-_]{35}\b/g, sev: "high" },
  { name: "JWT (unsigned check needed)", re: /\beyJ[A-Za-z0-9-_]{10,}\.eyJ[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]{10,}\b/g, sev: "high" },
  { name: "MongoDB URI", re: /mongodb(\+srv)?:\/\/[^\s"'<>]+/g, sev: "critical" },
  { name: "PostgreSQL URI", re: /postgres(ql)?:\/\/[^\s"'<>]+/g, sev: "critical" },
  { name: "MySQL URI", re: /mysql:\/\/[^\s"'<>]+/g, sev: "critical" },
  { name: "Redis URI", re: /redis:\/\/[^\s"'<>]+/g, sev: "critical" },
  { name: "Twilio Key", re: /\bSK[0-9a-fA-F]{32}\b/g, sev: "high" },
  { name: "SendGrid Key", re: /\bSG\.[0-9A-Za-z\-_]{20,}\.([0-9A-Za-z\-_]{40,})\b/g, sev: "high" },
  { name: "Heroku API Key", re: /\b(?:heroku|api_key)[=:"']\s*[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}/g, sev: "high" },
  { name: "npm Access Token", re: /\bnpm_[0-9a-zA-Z]{36}\b/g, sev: "high" },
  { name: "Firebase Config", re: /apiKey["']?\s*[:=]\s*["'][A-Za-z0-9_-]{30,}["']/g, sev: "low" },
  { name: "Generic hardcoded password", re: /\b(password|passwd|pwd|secret|token|api[_-]?key)["']?\s*[:=]\s*["'][^"'<>]{6,}["']/gi, sev: "low" },
];

export function scanSecrets(content, source) {
  const found = [];
  for (const { name, re, sev } of SECRET_PATTERNS) {
    re.lastIndex = 0;
    const hits = content.match(re);
    if (hits && hits.length) {
      found.push({
        name,
        severity: sev,
        count: hits.length,
        snippet: hits[0].slice(0, 100),
        source,
      });
    }
  }
  return found;
}

const SKIPPABLE_BODY_RE = /(login|signin|sign-in|log in|404|not found|error|captcha|human verification)/i;

export async function checkExposedPaths(baseUrl, { onResult } = {}) {
  const base = normalizeUrl(baseUrl);
  if (!base) return [];
  const results = [];
  const origin = base.origin;
  const soft404 = await detectSoft404(base);
  let done = 0;
  const checkOne = async (item) => {
    const url = new URL(item.path, origin).href;
    const res = await httpGet(url, { timeout: 7000 });
    done++;
    onResult?.({ index: done, total: EXPOSED_PATHS.length, path: item.path, status: res.status });
    if (!res.ok || res.status === 404 || res.status === 0) return;
    if (soft404 && (res.status === 200 || res.status === 301)) {
      const body = (res.text || "").slice(0, 500).toLowerCase();
      if (soft404.status === res.status && SKIPPABLE_BODY_RE.test(body)) return;
    }
    const bodyPreview = (res.text || "").slice(0, 400).trim();
    results.push({
      path: item.path,
      url,
      status: res.status,
      label: item.label,
      match: item.check && bodyPreview.includes(item.check) ? `matched "${item.check}"` : null,
      preview: bodyPreview.slice(0, 160),
    });
  };
  const poolSize = 8;
  let idx = 0;
  const workers = Array.from({ length: poolSize }, async () => {
    while (idx < EXPOSED_PATHS.length) {
      const item = EXPOSED_PATHS[idx++];
      try {
        await checkOne(item);
      } catch {
        /* keep going */
      }
    }
  });
  await Promise.all(workers);
  return results;
}

async function detectSoft404(base) {
  const url = new URL(`/___siteaudit_nonexistent_${Date.now()}___`, base.origin).href;
  const res = await httpGet(url, { timeout: 8000 });
  return res.ok ? { status: res.status, body: (res.text || "").slice(0, 500) } : null;
}

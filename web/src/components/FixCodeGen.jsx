import { useState } from "react";

const PLATFORMS = ["Vercel", "Nginx", "Apache", "Express.js", "Cloudflare", "Netlify"];

function detectHeader(finding) {
  const t = (finding.title || "").toLowerCase();
  if (t.includes("content-security-policy") || t.includes("csp")) return "CSP";
  if (t.includes("strict-transport-security") || t.includes("hsts")) return "HSTS";
  if (t.includes("x-frame-options") || t.includes("xfo") || t.includes("clickjacking")) return "XFO";
  if (t.includes("x-content-type-options") || t.includes("nosniff")) return "XCTO";
  if (t.includes("referrer-policy")) return "Referrer";
  if (t.includes("permissions-policy")) return "Permissions";
  if (t.includes("cross-origin") || t.includes("cors")) return "CORS";
  if (t.includes("cookie")) return "Cookie";
  return "CSP";
}

function headerName(hdr) {
  const map = {
    CSP: "Content-Security-Policy",
    HSTS: "Strict-Transport-Security",
    XFO: "X-Frame-Options",
    XCTO: "X-Content-Type-Options",
    Referrer: "Referrer-Policy",
    Permissions: "Permissions-Policy",
  };
  return map[hdr] || "Content-Security-Policy";
}

function headerValue(hdr) {
  const map = {
    CSP:
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    HSTS: "max-age=31536000; includeSubDomains; preload",
    XFO: "DENY",
    XCTO: "nosniff",
    Referrer: "strict-origin-when-cross-origin",
    Permissions: "geolocation=(), microphone=(), camera=()",
  };
  return map[hdr] || "default-src 'self'";
}

function getOrigin(finding) {
  try {
    return new URL(finding.url).origin;
  } catch {
    return "https://example.com";
  }
}

function generateCode(platform, finding) {
  const cat = (finding.category || "").toLowerCase();
  const hdr = detectHeader(finding);
  const hn = headerName(hdr);
  const hv = headerValue(hdr);
  const origin = getOrigin(finding);

  // ---- Vercel ----
  if (platform === "Vercel") {
    if (cat === "header") {
      return JSON.stringify(
        {
          headers: [
            {
              source: "/(.*)",
              headers: [{ key: hn, value: hv }],
            },
          ],
        },
        null,
        2
      );
    }
    if (cat === "cors") {
      return JSON.stringify(
        {
          headers: [
            {
              source: "/api/(.*)",
              headers: [
                {
                  key: "Access-Control-Allow-Origin",
                  value: origin,
                },
                {
                  key: "Access-Control-Allow-Methods",
                  value: "GET, POST, PUT, DELETE, OPTIONS",
                },
                {
                  key: "Access-Control-Allow-Headers",
                  value: "Content-Type, Authorization",
                },
              ],
            },
          ],
        },
        null,
        2
      );
    }
    if (cat === "exposure") {
      return JSON.stringify(
        {
          redirects: [
            {
              source: "/.git/(.*)",
              destination: "/404",
              statusCode: 410,
            },
            {
              source: "/.env",
              destination: "/404",
              statusCode: 410,
            },
            {
              source: "/(backup|wp-admin|admin)/(.*)",
              destination: "/404",
              statusCode: 410,
            },
          ],
        },
        null,
        2
      );
    }
    if (cat === "misconfig") {
      return JSON.stringify(
        {
          headers: [
            {
              source: "/(.*)",
              headers: [
                { key: "X-Frame-Options", value: "DENY" },
                { key: "X-Content-Type-Options", value: "nosniff" },
                {
                  key: "Referrer-Policy",
                  value: "strict-origin-when-cross-origin",
                },
              ],
            },
          ],
        },
        null,
        2
      );
    }
    if (cat === "cve") return `# vercel.json ignores outdated deps — update in package.json instead:\nnpm update`;
    if (cat === "tls")
      return `# Vercel auto-provisions TLS. Run:\nvercel certs add ${finding.url || "example.com"}`;
    if (cat === "secret")
      return `vercel env rm MY_SECRET_KEY\nvercel env add MY_SECRET_KEY\n# Then redeploy:\nvercel --prod`;
    if (cat === "cookie")
      return `# Vercel cannot set cookie flags server-side.\n# Use a Next.js middleware or Express backend response headers:\nres.setHeader("Set-Cookie", "session=...; HttpOnly; Secure; SameSite=Strict");`;
    return `# vercel.json\necho "See Vercel docs for ${cat}"`;
  }

  // ---- Nginx ----
  if (platform === "Nginx") {
    if (cat === "header") {
      const directives = [];
      if (hdr === "CSP")
        directives.push(
          `add_header Content-Security-Policy "${hv}";`
        );
      else if (hdr === "HSTS")
        directives.push(
          `add_header Strict-Transport-Security "${hv}" always;`
        );
      else if (hdr === "XFO")
        directives.push(
          'add_header X-Frame-Options "DENY" always;'
        );
      else if (hdr === "XCTO")
        directives.push(
          'add_header X-Content-Type-Options "nosniff" always;'
        );
      else if (hdr === "Referrer")
        directives.push(
          'add_header Referrer-Policy "strict-origin-when-cross-origin" always;'
        );
      else if (hdr === "Permissions")
        directives.push(
          'add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;'
        );
      return (
        directives.join("\n") +
        "\n\n# Place inside server { } block"
      );
    }
    if (cat === "cors") {
      return [
        "location /api/ {",
        '    if ($request_method = OPTIONS) {',
        "        add_header Access-Control-Allow-Origin " +
          JSON.stringify(origin) +
          ";",
        '        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";',
        '        add_header Access-Control-Allow-Headers "Content-Type, Authorization";',
        "        add_header Access-Control-Max-Age 86400;",
        "        return 204;",
        "    }",
        "    add_header Access-Control-Allow-Origin " +
          JSON.stringify(origin) +
          " always;",
        "    add_header Access-Control-Allow-Credentials true;",
        "}",
      ].join("\n");
    }
    if (cat === "exposure") {
      return [
        "# Block exposed paths — place inside server { } block",
        "location ~* /\\.(git|env|htaccess|svn|DS_Store) {",
        "    deny all;",
        "    return 403;",
        "}",
        "location ~* /(backup|wp-admin|admin|config)\\/ {",
        "    deny all;",
        "    return 403;",
        "}",
        "location = /phpinfo.php { deny all; }",
        "location = /server-status { deny all; }",
      ].join("\n");
    }
    if (cat === "misconfig") {
      return [
        "# Security hardening — add inside server { } block",
        'server_tokens off;',
        'add_header X-Frame-Options "DENY" always;',
        'add_header X-Content-Type-Options "nosniff" always;',
        'add_header Referrer-Policy "strict-origin-when-cross-origin" always;',
        "ssl_protocols TLSv1.2 TLSv1.3;",
        'ssl_ciphers HIGH:!aNULL:!MD5;',
        "ssl_prefer_server_ciphers on;",
      ].join("\n");
    }
    if (cat === "cve") {
      return "# Update the vulnerable package\nsudo apt update && sudo apt upgrade nginx\n# Or for a specific version:\nsudo apt install nginx=1.26.2-1~$(lsb_release -cs)";
    }
    if (cat === "tls") {
      return [
        "# Renew SSL cert with certbot",
        "certbot renew --nginx",
        "# Or configure stronger TLS:",
        "ssl_protocols TLSv1.2 TLSv1.3;",
        'ssl_ciphers HIGH:!aNULL:!MD5;',
        "ssl_prefer_server_ciphers on;",
        "ssl_session_cache shared:SSL:10m;",
        "ssl_session_timeout 10m;",
      ].join("\n");
    }
    if (cat === "cookie") {
      return [
        "# Set cookie flags for all cookies",
        'proxy_cookie_flags ~ secure samesite=strict httponly;',
        "",
        "# Or for specific cookies:",
        'proxy_cookie_flags session_cookie secure samesite=strict httponly;',
      ].join("\n");
    }
    if (cat === "secret") {
      return [
        "# Rotate secrets — regenerate and update config",
        "# 1. Generate new secret:",
        "openssl rand -hex 32",
        "# 2. Update nginx config or .env with the new value",
        "# 3. Reload nginx:",
        "nginx -t && nginx -s reload",
        "# 4. Revoke old API keys / credentials",
      ].join("\n");
    }
    return `# Place inside server { } block\necho "See Nginx docs for ${cat}"`;
  }

  // ---- Apache ----
  if (platform === "Apache") {
    if (cat === "header") {
      return `Header always set ${hn} "${hv}"\n\n# Place in .htaccess or <VirtualHost> block`;
    }
    if (cat === "cors") {
      return [
        "Header set Access-Control-Allow-Origin " +
          JSON.stringify(origin),
        'Header set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"',
        'Header set Access-Control-Allow-Headers "Content-Type, Authorization"',
      ].join("\n");
    }
    if (cat === "exposure") {
      return [
        "# Block exposed paths — .htaccess",
        "RedirectMatch 403 /\\.(git|env|htaccess|svn|DS_Store)",
        "RedirectMatch 403 /(backup|wp-admin|admin|config)/",
        "RedirectMatch 403 /phpinfo\\.php",
        "RedirectMatch 403 /server-status",
      ].join("\n");
    }
    if (cat === "misconfig") {
      return [
        "# Security hardening — .htaccess",
        'ServerSignature Off',
        'Header always set X-Frame-Options "DENY"',
        'Header always set X-Content-Type-Options "nosniff"',
        'Header always set Referrer-Policy "strict-origin-when-cross-origin"',
        "Options -Indexes",
        '<FilesMatch "\\.(env|git|json|lock|md|yml|yaml)$">',
        "  Require all denied",
        "</FilesMatch>",
      ].join("\n");
    }
    if (cat === "cve") {
      return "# Update vulnerable Apache packages\nsudo apt update && sudo apt upgrade apache2";
    }
    if (cat === "tls") {
      return [
        "# Apache TLS config — in <VirtualHost *:443>",
        "SSLEngine on",
        "SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1",
        "SSLCipherSuite HIGH:!aNULL:!MD5",
        "SSLHonorCipherOrder on",
        "SSLCertificateFile /etc/ssl/certs/your-cert.crt",
        "SSLCertificateKeyFile /etc/ssl/private/your-key.key",
        "",
        "# Renew with certbot:",
        "certbot renew --apache",
      ].join("\n");
    }
    if (cat === "cookie") {
      return [
        "# Set cookie flags — in .htaccess",
        "Header edit Set-Cookie ^(.*)$ $1;HttpOnly;Secure;SameSite=Strict",
        "# Or in apache2.conf:",
        'Header always edit Set-Cookie (.*) "$1;HttpOnly;Secure;SameSite=Strict"',
      ].join("\n");
    }
    if (cat === "secret") {
      return [
        "# Rotate secrets",
        "openssl rand -hex 32  # new secret",
        "# Update .htaccess or .env, then reload:",
        "systemctl reload apache2",
      ].join("\n");
    }
    return `# .htaccess or VirtualHost\necho "See Apache docs for ${cat}"`;
  }

  // ---- Express.js ----
  if (platform === "Express.js") {
    if (cat === "header") {
      return [
        "const helmet = require('helmet');",
        "",
        "app.use(helmet({",
        "  contentSecurityPolicy: {",
        "    directives: {",
        "      defaultSrc: [\"'self'\"],",
        "      scriptSrc: [\"'self'\"],",
        "      styleSrc: [\"'self'\", \"'unsafe-inline'\"],",
        "      imgSrc: [\"'self'\", 'data:'],",
        "      fontSrc: [\"'self'\"],",
        "      connectSrc: [\"'self'\"],",
        "      frameAncestors: [\"'none'\"],",
        "      baseUri: [\"'self'\"],",
        "      formAction: [\"'self'\"],",
        "    },",
        "  },",
        "  hsts: {",
        "    maxAge: 31536000,",
        "    includeSubDomains: true,",
        "    preload: true,",
        "  },",
        "  frameguard: { action: 'deny' },",
        "  noSniff: true,",
        "  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },",
        "}));",
      ].join("\n");
    }
    if (cat === "cors") {
      return [
        "const cors = require('cors');",
        "",
        "app.use(cors({",
        `  origin: "${origin}",`,
        '  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],',
        '  allowedHeaders: ["Content-Type", "Authorization"],',
        "  credentials: true,",
        "  maxAge: 86400,",
        "}));",
      ].join("\n");
    }
    if (cat === "exposure") {
      return [
        "// Block exposed paths — Express.js middleware",
        "const blocked = [",
        "  '/.git', '/.env', '/.htaccess', '/.svn', '/.DS_Store',",
        "  '/backup', '/wp-admin', '/admin', '/config',",
        "  '/phpinfo.php', '/server-status',",
        "];",
        "app.use((req, res, next) => {",
        "  if (blocked.some(p => req.path.toLowerCase().startsWith(p))) {",
        "    return res.status(404).send('Not Found');",
        "  }",
        "  next();",
        "});",
      ].join("\n");
    }
    if (cat === "misconfig") {
      return [
        "// Express.js security hardening",
        "const helmet = require('helmet');",
        "const cors = require('cors');",
        "",
        'app.disable("x-powered-by");',
        "app.use(helmet());",
        `app.use(cors({ origin: "${origin}" }));`,
        "",
        "// Rate limiting",
        "const rateLimit = require('express-rate-limit');",
        "app.use(rateLimit({",
        "  windowMs: 15 * 60 * 1000,",
        "  max: 100,",
        "}));",
      ].join("\n");
    }
    if (cat === "cve") {
      return "# Run in project directory:\nnpm audit fix --force\n# Or update specific packages:\nnpm update <package-name>";
    }
    if (cat === "tls") {
      return [
        "// Use HTTPS in Express",
        "const https = require('https');",
        "const fs = require('fs');",
        "",
        "const options = {",
        "  key: fs.readFileSync('/path/to/privkey.pem'),",
        "  cert: fs.readFileSync('/path/to/cert.pem'),",
        "  minVersion: 'TLSv1.2',",
        "};",
        "",
        "https.createServer(options, app).listen(443);",
        "",
        "// Redirect HTTP to HTTPS",
        'app.use((req, res, next) => {',
        '  if (!req.secure) return res.redirect("https://" + req.headers.host + req.url);',
        "  next();",
        "});",
      ].join("\n");
    }
    if (cat === "cookie") {
      return [
        "// Secure cookie config with express-session",
        "const session = require('express-session');",
        "",
        "app.use(session({",
        "  secret: process.env.SESSION_SECRET,",
        "  resave: false,",
        "  saveUninitialized: false,",
        "  cookie: {",
        "    httpOnly: true,",
        "    secure: true,",
        "    sameSite: 'strict',",
        "    maxAge: 24 * 60 * 60 * 1000, // 24h",
        "  },",
        "}));",
      ].join("\n");
    }
    if (cat === "secret") {
      return [
        "# Rotate environment secrets",
        "# 1. Generate new secret:",
        "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
        "# 2. Update .env file with new values",
        "# 3. Restart the server:",
        "pm2 restart app  # or your process manager",
        '# 4. Delete old secrets from .env and commit the change',
      ].join("\n");
    }
    return `# Express.js\n// See Express docs for ${cat}`;
  }

  // ---- Cloudflare Workers ----
  if (platform === "Cloudflare") {
    if (cat === "header" || cat === "misconfig") {
      return [
        "// Cloudflare Worker — add security headers",
        "export default {",
        "  async fetch(request, env, ctx) {",
        "    const response = await fetch(request);",
        "    const headers = new Headers(response.headers);",
        "",
        `    headers.set("${hn}", "${hv}");`,
        "",
        "    return new Response(response.body, {",
        "      status: response.status,",
        "      statusText: response.statusText,",
        "      headers,",
        "    });",
        "  },",
        "};",
      ].join("\n");
    }
    if (cat === "cors") {
      return [
        "// Cloudflare Worker — CORS handler",
        "export default {",
        "  async fetch(request) {",
        "    if (request.method === 'OPTIONS') {",
        "      return new Response(null, {",
        "        status: 204,",
        "        headers: {",
        `          'Access-Control-Allow-Origin': '${origin}',`,
        "          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',",
        "          'Access-Control-Allow-Headers': 'Content-Type, Authorization',",
        "          'Access-Control-Max-Age': '86400',",
        "        },",
        "      });",
        "    }",
        "    const response = await fetch(request);",
        "    const headers = new Headers(response.headers);",
        `    headers.set('Access-Control-Allow-Origin', '${origin}');`,
        "    return new Response(response.body, { ...response, headers });",
        "  },",
        "};",
      ].join("\n");
    }
    if (cat === "exposure") {
      return [
        "// Cloudflare Worker — block exposed paths",
        "const BLOCKED = [",
        "  '/.git', '/.env', '/.htaccess', '/.svn',",
        "  '/backup', '/wp-admin', '/admin', '/config',",
        "];",
        "export default {",
        "  async fetch(request) {",
        "    const url = new URL(request.url);",
        "    if (BLOCKED.some(p => url.pathname.toLowerCase().startsWith(p))) {",
        "      return new Response('Not Found', { status: 404 });",
        "    }",
        "    return fetch(request);",
        "  },",
        "};",
      ].join("\n");
    }
    if (cat === "tls")
      return "# Cloudflare handles TLS automatically with Universal SSL.\n# Set 'Full (strict)' in SSL/TLS > Overview.";
    if (cat === "cve")
      return "# Cloudflare Workers — update wrangler & rerun:\nnpm update wrangler\nwrangler publish";
    if (cat === "secret")
      return "# Rotate Worker secrets:\nwrangler secret delete MY_SECRET\nwrangler secret put MY_SECRET\nwrangler publish";
    if (cat === "cookie")
      return [
        "// Cloudflare Worker — set cookie flags",
        "const response = await fetch(request);",
        "const headers = new Headers(response.headers);",
        "headers.set(",
        "  'Set-Cookie',",
        "  'session=...; HttpOnly; Secure; SameSite=Strict; Path=/'",
        ");",
      ].join("\n");
    return `// Cloudflare Worker\necho "See Cloudflare docs for ${cat}"`;
  }

  // ---- Netlify ----
  if (platform === "Netlify") {
    if (cat === "header") {
      return [
        "[[headers]]",
        '  for = "/*"',
        "  [headers.values]",
        `    ${hn} = "${hv}"`,
      ].join("\n");
    }
    if (cat === "cors") {
      return [
        "[[headers]]",
        '  for = "/api/*"',
        "  [headers.values]",
        `    Access-Control-Allow-Origin = "${origin}"`,
        '    Access-Control-Allow-Methods = "GET, POST, PUT, DELETE, OPTIONS"',
        '    Access-Control-Allow-Headers = "Content-Type, Authorization"',
        "",
        "[[headers]]",
        '  for = "/api/*"',
        '  conditions = {Method = "OPTIONS"}',
        "  [headers.values]",
        "    Access-Control-Max-Age = \"86400\"",
      ].join("\n");
    }
    if (cat === "exposure") {
      return [
        "# netlify.toml — block exposed paths",
        "[[redirects]]",
        '  from = "/.git/*"',
        '  to = "/404.html"',
        "  status = 404",
        "",
        "[[redirects]]",
        '  from = "/.env"',
        '  to = "/404.html"',
        "  status = 404",
        "",
        "[[redirects]]",
        '  from = "/backup/*"',
        '  to = "/404.html"',
        "  status = 404",
      ].join("\n");
    }
    if (cat === "misconfig") {
      return [
        "# netlify.toml — security hardening",
        "[[headers]]",
        '  for = "/*"',
        "  [headers.values]",
        '    X-Frame-Options = "DENY"',
        '    X-Content-Type-Options = "nosniff"',
        '    Referrer-Policy = "strict-origin-when-cross-origin"',
        '    Strict-Transport-Security = "max-age=31536000; includeSubDomains"',
      ].join("\n");
    }
    if (cat === "cve")
      return "# Netlify — update deps and redeploy:\nnpm update\nnpm run build\n# Commit and push to trigger Netlify deploy";
    if (cat === "tls")
      return "# Netlify auto-provisions TLS certificates.\n# Ensure HTTPS is enabled in Netlify dashboard > Domain Settings.";
    if (cat === "secret")
      return "# Rotate secrets in Netlify:\n# 1. Delete old env var:\nnetlify env:unset MY_SECRET\n# 2. Add new:\nnetlify env:set MY_SECRET <new-value>\n# 3. Trigger redeploy";
    if (cat === "cookie")
      return "# netlify.toml — set cookie flags via edge handler\n# Use Netlify Edge Functions to modify Set-Cookie headers.";
    return `# netlify.toml\necho "See Netlify docs for ${cat}"`;
  }

  return `# ${platform}\n// No template for category: ${cat}`;
}

const tabStyle = {
  background: "rgba(0,229,255,0.06)",
  border: "1px solid rgba(0,229,255,0.18)",
  color: "var(--dim)",
  padding: "4px 10px",
  fontSize: 11,
  cursor: "pointer",
  borderRadius: 4,
  fontFamily: "var(--mono)",
  letterSpacing: 0.5,
  transition: "all 0.15s",
};

const tabActiveStyle = {
  ...tabStyle,
  background: "rgba(0,229,255,0.16)",
  borderColor: "var(--cyan)",
  color: "var(--cyan)",
};

const codeBlockStyle = {
  background: "var(--bg)",
  border: "1px solid var(--line)",
  borderRadius: 4,
  padding: 12,
  fontSize: 11.5,
  fontFamily: "var(--mono)",
  color: "var(--cyan)",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  maxHeight: 300,
  overflowY: "auto",
  lineHeight: 1.7,
  marginTop: 10,
};

const copyStyle = {
  fontSize: 10.5,
  padding: "3px 10px",
  background: "none",
  border: "1px solid var(--cyan)",
  color: "var(--cyan)",
  borderRadius: 4,
  cursor: "pointer",
  fontFamily: "var(--mono)",
  letterSpacing: 1,
  transition: "all 0.15s",
};

const copiedStyle = {
  ...copyStyle,
  background: "rgba(51,255,161,0.12)",
  borderColor: "var(--green)",
  color: "var(--green)",
};

export default function FixCodeGen({ finding }) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState(null);
  const [copied, setCopied] = useState(false);
  const [hoveredTab, setHoveredTab] = useState(null);

  function handleSelect(p) {
    setPlatform(p);
    setCopied(false);
  }

  async function handleCopy() {
    const code = generateCode(platform, finding);
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = code;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="block tools" style={{ marginTop: 2 }}>
      <div className="label">COPY FIX CODE</div>

      {!open ? (
        <button
          className="btn btn-ghost btn-xs"
          onClick={() => setOpen(true)}
          style={{ fontSize: 10.5, letterSpacing: 1 }}
        >
          ▼ SHOW PLATFORM-SPECIFIC CODE
        </button>
      ) : (
        <>
          <div
            className="btn-row"
            style={{ gap: 6, flexWrap: "wrap", marginBottom: 4 }}
          >
            {PLATFORMS.map((p) => {
              const active = platform === p || (!platform && p === "Vercel");
              const hover = hoveredTab === p;
              const bg = active
                ? "rgba(0,229,255,0.16)"
                : hover
                ? "rgba(0,229,255,0.1)"
                : "rgba(0,229,255,0.06)";
              const bc = active ? "var(--cyan)" : hover ? "rgba(0,229,255,0.4)" : "rgba(0,229,255,0.18)";
              const cl = active ? "var(--cyan)" : hover ? "var(--text)" : "var(--dim)";
              return (
                <button
                  key={p}
                  onClick={() => handleSelect(p)}
                  onMouseEnter={() => setHoveredTab(p)}
                  onMouseLeave={() => setHoveredTab(null)}
                  style={{
                    ...tabStyle,
                    background: bg,
                    borderColor: bc,
                    color: cl,
                  }}
                >
                  {p}
                </button>
              );
            })}
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => {
                setOpen(false);
                setPlatform(null);
                setCopied(false);
              }}
              style={{ color: "var(--dim)", fontSize: 10 }}
            >
              ▲ HIDE
            </button>
          </div>

          <div style={{ position: "relative" }}>
            <pre style={codeBlockStyle}>
              {generateCode(platform || "Vercel", finding)}
            </pre>
            <button
              onClick={handleCopy}
              style={copied ? copiedStyle : copyStyle}
              onMouseEnter={(e) => {
                if (!copied) {
                  e.currentTarget.style.background = "rgba(0,229,255,0.1)";
                }
              }}
              onMouseLeave={(e) => {
                if (!copied) {
                  e.currentTarget.style.background = "none";
                }
              }}
            >
              {copied ? "COPIED!" : "COPY"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

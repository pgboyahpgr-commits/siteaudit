import { useState, useMemo } from "react";

const PLATFORMS = [
  { key: "Vercel", color: "#f0f0f0", bg: "rgba(240,240,240,0.1)" },
  { key: "Nginx", color: "#00d632", bg: "rgba(0,214,50,0.1)" },
  { key: "Apache", color: "#ffb020", bg: "rgba(255,176,32,0.1)" },
  { key: "Express.js", color: "#7dfcff", bg: "rgba(125,252,255,0.1)" },
  { key: "Cloudflare", color: "#f6821f", bg: "rgba(246,130,31,0.1)" },
  { key: "Netlify", color: "#38bdf8", bg: "rgba(56,189,248,0.1)" },
];

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

  if (platform === "Vercel") {
    if (cat === "header") {
      return JSON.stringify({
        headers: [{ source: "/(.*)", headers: [{ key: hn, value: hv }] }],
      }, null, 2);
    }
    if (cat === "cors") {
      return JSON.stringify({
        headers: [{
          source: "/api/(.*)",
          headers: [
            { key: "Access-Control-Allow-Origin", value: origin },
            { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
            { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
          ],
        }],
      }, null, 2);
    }
    if (cat === "exposure") {
      return JSON.stringify({
        redirects: [
          { source: "/.git/(.*)", destination: "/404", statusCode: 410 },
          { source: "/.env", destination: "/404", statusCode: 410 },
          { source: "/(backup|wp-admin|admin)/(.*)", destination: "/404", statusCode: 410 },
        ],
      }, null, 2);
    }
    if (cat === "misconfig") {
      return JSON.stringify({
        headers: [{
          source: "/(.*)",
          headers: [
            { key: "X-Frame-Options", value: "DENY" },
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          ],
        }],
      }, null, 2);
    }
    if (cat === "cve") return "# vercel.json ignores deps — update in package.json:\nnpm update";
    if (cat === "tls") return "# Vercel auto-provisions TLS.\nvercel certs add example.com";
    if (cat === "secret") return "vercel env rm MY_SECRET_KEY\nvercel env add MY_SECRET_KEY\nvercel --prod";
    if (cat === "cookie") return "# Use Next.js middleware or backend:\nres.setHeader('Set-Cookie', 'session=...; HttpOnly; Secure; SameSite=Strict');";
    return `# vercel.json — see Vercel docs for ${cat}`;
  }

  if (platform === "Nginx") {
    if (cat === "header") {
      const d = [];
      if (hdr === "CSP") d.push(`add_header Content-Security-Policy "${hv}";`);
      else if (hdr === "HSTS") d.push(`add_header Strict-Transport-Security "${hv}" always;`);
      else if (hdr === "XFO") d.push('add_header X-Frame-Options "DENY" always;');
      else if (hdr === "XCTO") d.push('add_header X-Content-Type-Options "nosniff" always;');
      else if (hdr === "Referrer") d.push('add_header Referrer-Policy "strict-origin-when-cross-origin" always;');
      else if (hdr === "Permissions") d.push('add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;');
      return d.join("\n") + "\n\n# Place inside server { } block";
    }
    if (cat === "cors") {
      return [
        "location /api/ {",
        "    if ($request_method = OPTIONS) {",
        `        add_header Access-Control-Allow-Origin "${origin}";`,
        '        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";',
        '        add_header Access-Control-Allow-Headers "Content-Type, Authorization";',
        "        add_header Access-Control-Max-Age 86400;",
        "        return 204;",
        "    }",
        `    add_header Access-Control-Allow-Origin "${origin}" always;`,
        "    add_header Access-Control-Allow-Credentials true;",
        "}",
      ].join("\n");
    }
    if (cat === "exposure") {
      return [
        "# Block exposed paths — server { } block",
        "location ~* /\\.(git|env|htaccess|svn|DS_Store) {",
        "    deny all;",
        "    return 403;",
        "}",
        "location ~* /(backup|wp-admin|admin|config)/ {",
        "    deny all;",
        "    return 403;",
        "}",
        "location = /phpinfo.php { deny all; }",
        "location = /server-status { deny all; }",
      ].join("\n");
    }
    if (cat === "misconfig") {
      return [
        "# Security hardening — server { }",
        "server_tokens off;",
        'add_header X-Frame-Options "DENY" always;',
        'add_header X-Content-Type-Options "nosniff" always;',
        'add_header Referrer-Policy "strict-origin-when-cross-origin" always;',
        "ssl_protocols TLSv1.2 TLSv1.3;",
        'ssl_ciphers HIGH:!aNULL:!MD5;',
        "ssl_prefer_server_ciphers on;",
      ].join("\n");
    }
    if (cat === "cve") return "# Update Nginx:\nsudo apt update && sudo apt upgrade nginx";
    if (cat === "tls") return "certbot renew --nginx\nssl_protocols TLSv1.2 TLSv1.3;\nssl_ciphers HIGH:!aNULL:!MD5;\nssl_prefer_server_ciphers on;";
    if (cat === "cookie") return 'proxy_cookie_flags ~ secure samesite=strict httponly;';
    if (cat === "secret") return "# Rotate secret:\nopenssl rand -hex 32\nnginx -t && nginx -s reload";
    return `# Nginx — see docs for ${cat}`;
  }

  if (platform === "Apache") {
    if (cat === "header") return `Header always set ${hn} "${hv}"\n\n# Place in .htaccess or <VirtualHost> block`;
    if (cat === "cors") return `Header set Access-Control-Allow-Origin "${origin}"\nHeader set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"\nHeader set Access-Control-Allow-Headers "Content-Type, Authorization"`;
    if (cat === "exposure") return "RedirectMatch 403 /\\.(git|env|htaccess|svn|DS_Store)\nRedirectMatch 403 /(backup|wp-admin|admin|config)/\nRedirectMatch 403 /phpinfo\\.php\nRedirectMatch 403 /server-status\n\n# .htaccess";
    if (cat === "misconfig") return "ServerSignature Off\nHeader always set X-Frame-Options \"DENY\"\nHeader always set X-Content-Type-Options \"nosniff\"\nHeader always set Referrer-Policy \"strict-origin-when-cross-origin\"\nOptions -Indexes\n\n# .htaccess";
    if (cat === "cve") return "# Update Apache:\nsudo apt update && sudo apt upgrade apache2";
    if (cat === "tls") return "SSLEngine on\nSSLProtocol all -SSLv3 -TLSv1 -TLSv1.1\nSSLCipherSuite HIGH:!aNULL:!MD5\nSSLHonorCipherOrder on\n\n# VirtualHost *:443";
    if (cat === "cookie") return "Header edit Set-Cookie ^(.*)$ $1;HttpOnly;Secure;SameSite=Strict\n\n# .htaccess";
    if (cat === "secret") return "# Rotate:\nopenssl rand -hex 32\nsystemctl reload apache2";
    return `# .htaccess or VirtualHost — see docs for ${cat}`;
  }

  if (platform === "Express.js") {
    if (cat === "header") {
      return [
        "const helmet = require('helmet');",
        "",
        "app.use(helmet({",
        "  contentSecurityPolicy: {",
        "    directives: {",
        '      defaultSrc: ["\'self\'"],',
        '      scriptSrc: ["\'self\'"],',
        '      styleSrc: ["\'self\'", "\'unsafe-inline\'"],',
        '      imgSrc: ["\'self\'", "data:"],',
        '      fontSrc: ["\'self\'"],',
        '      connectSrc: ["\'self\'"],',
        '      frameAncestors: ["\'none\'"],',
        '      baseUri: ["\'self\'"],',
        '      formAction: ["\'self\'"],',
        "    },",
        "  },",
        "  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },",
        "  frameguard: { action: 'deny' },",
        "  noSniff: true,",
        "  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },",
        "}));",
      ].join("\n");
    }
    if (cat === "cors") {
      return [
        "const cors = require('cors');",
        `app.use(cors({ origin: "${origin}", methods: ["GET","POST","PUT","DELETE","OPTIONS"], allowedHeaders: ["Content-Type","Authorization"], credentials: true }));`,
      ].join("\n");
    }
    if (cat === "exposure") {
      return [
        "const blocked = ['/.git','/.env','/.htaccess','/.svn','/backup','/wp-admin','/admin'];\napp.use((req, res, next) => {\n  if (blocked.some(p => req.path.toLowerCase().startsWith(p)))\n    return res.status(404).send('Not Found');\n  next();\n});",
      ].join("\n");
    }
    if (cat === "misconfig") {
      return [
        'app.disable("x-powered-by");',
        "app.use(require('helmet')());",
        "app.use(require('cors')());",
        "app.use(require('express-rate-limit')({ windowMs: 15*60*1000, max: 100 }));",
      ].join("\n");
    }
    if (cat === "cve") return "npm audit fix --force";
    if (cat === "tls") return [
      "const https = require('https'), fs = require('fs');",
      "https.createServer({",
      "  key: fs.readFileSync('/path/to/key.pem'),",
      "  cert: fs.readFileSync('/path/to/cert.pem'),",
      "  minVersion: 'TLSv1.2',",
      "}, app).listen(443);",
    ].join("\n");
    if (cat === "cookie") return "app.use(session({\n  cookie: { httpOnly: true, secure: true, sameSite: 'strict', maxAge: 24*60*60*1000 }\n}));";
    if (cat === "secret") return "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"\n# Update .env, restart: pm2 restart app";
    return `// Express.js — see docs for ${cat}`;
  }

  if (platform === "Cloudflare") {
    if (cat === "header" || cat === "misconfig") {
      return [
        "export default { async fetch(request, env, ctx) {",
        "  const response = await fetch(request);",
        "  const headers = new Headers(response.headers);",
        `  headers.set("${hn}", "${hv}");`,
        "  return new Response(response.body, { ...response, headers });",
        "} };",
      ].join("\n");
    }
    if (cat === "cors") {
      return [
        "export default { async fetch(request) {",
        "  if (request.method === 'OPTIONS') return new Response(null, {",
        "    status: 204,",
        `    headers: { 'Access-Control-Allow-Origin': '${origin}',`,
        "      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',",
        "      'Access-Control-Allow-Headers': 'Content-Type,Authorization' }",
        "  });",
        "  const response = await fetch(request);",
        "  const headers = new Headers(response.headers);",
        `  headers.set('Access-Control-Allow-Origin', '${origin}');`,
        "  return new Response(response.body, { ...response, headers });",
        "} };",
      ].join("\n");
    }
    if (cat === "exposure") {
      return [
        "const BLOCKED = ['/.git','/.env','/.htaccess','/backup','/wp-admin','/admin'];\nexport default { async fetch(request) {\n  const url = new URL(request.url);\n  if (BLOCKED.some(p => url.pathname.startsWith(p)))\n    return new Response('Not Found', { status: 404 });\n  return fetch(request);\n} };",
      ].join("\n");
    }
    if (cat === "tls") return "# Use 'Full (strict)' in SSL/TLS > Overview.\n# Cloudflare handles TLS automatically.";
    if (cat === "cve") return "npm update wrangler\nwrangler publish";
    if (cat === "secret") return "wrangler secret delete MY_SECRET\nwrangler secret put MY_SECRET\nwrangler publish";
    if (cat === "cookie") return "headers.set('Set-Cookie', 'session=...; HttpOnly; Secure; SameSite=Strict; Path=/');";
    return `// Cloudflare Worker — see docs for ${cat}`;
  }

  if (platform === "Netlify") {
    if (cat === "header") return `[[headers]]\n  for = "/*"\n  [headers.values]\n    ${hn} = "${hv}"`;
    if (cat === "cors") return `[[headers]]\n  for = "/api/*"\n  [headers.values]\n    Access-Control-Allow-Origin = "${origin}"\n    Access-Control-Allow-Methods = "GET, POST, PUT, DELETE, OPTIONS"\n    Access-Control-Allow-Headers = "Content-Type, Authorization"`;
    if (cat === "exposure") return `[[redirects]]\n  from = "/.git/*"\n  to = "/404.html"\n  status = 404\n[[redirects]]\n  from = "/.env"\n  to = "/404.html"\n  status = 404`;
    if (cat === "misconfig") return `[[headers]]\n  for = "/*"\n  [headers.values]\n    X-Frame-Options = "DENY"\n    X-Content-Type-Options = "nosniff"\n    Referrer-Policy = "strict-origin-when-cross-origin"`;
    if (cat === "cve") return "npm update\nnpm run build\n# Push to deploy";
    if (cat === "tls") return "# Netlify auto-provisions TLS.\n# Enable HTTPS in Domain Settings.";
    if (cat === "secret") return "netlify env:unset MY_SECRET\nnetlify env:set MY_SECRET <value>\n# Redeploy";
    if (cat === "cookie") return "# Use Netlify Edge Functions to modify Set-Cookie headers.";
    return `# netlify.toml — see docs for ${cat}`;
  }

  return `# ${platform} — no template for ${cat}`;
}

function highlightSyntax(code) {
  const lines = code.split("\n");
  return lines.map((line, i) => {
    if (/^\s*#/.test(line) || /^\s*\/\//.test(line)) {
      return <div key={i} style={{ color: "#7f92b8" }}>{line}</div>;
    }
    let parts = [];
    const keyColor = "#33ffa1", valColor = "#38bdf8", strColor = "#f59e0b";
    const regex = /("[^"]*"|'[^']*'|\b(?:key|value|name|source|destination|statusCode|headers|redirects|header|action|directives|defaultSrc|scriptSrc|styleSrc|imgSrc|fontSrc|connectSrc|frameAncestors|baseUri|formAction|hsts|maxAge|includeSubDomains|preload|frameguard|noSniff|referrerPolicy|policy|methods|allowedHeaders|credentials|maxAge|origin|number|headers|to|for|from|blocked|BLOCKED|cookie|httpOnly|secure|sameSite|windowMs|max)\b)/g;
    let last = 0, m;
    while ((m = regex.exec(line)) !== null) {
      if (m.index > last) parts.push(<span key={`t${i}-${last}`} style={{ color: "#c6d2e4" }}>{line.slice(last, m.index)}</span>);
      const val = m[0];
      const c = val.startsWith('"') || val.startsWith("'") ? strColor : keyColor;
      parts.push(<span key={`m${i}-${m.index}`} style={{ color: c }}>{val}</span>);
      last = m.index + m[0].length;
    }
    if (last < line.length) parts.push(<span key={`r${i}-${last}`} style={{ color: "#c6d2e4" }}>{line.slice(last)}</span>);
    if (parts.length === 0) parts.push(<span key={`w${i}`} style={{ color: "#c6d2e4" }}>{line}</span>);
    return <div key={i}>{parts}</div>;
  });
}

const copyBtnBase = {
  padding: "6px 14px",
  fontSize: 10,
  fontFamily: "var(--mono)",
  letterSpacing: 1.5,
  fontWeight: 700,
  border: "1px solid",
  borderRadius: 4,
  cursor: "pointer",
  transition: "all 0.15s",
  background: "none",
};

export default function FixCodeGen({ finding }) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState(null);
  const [copied, setCopied] = useState(false);

  const currentPlatform = platform || "Vercel";
  const code = useMemo(() => generateCode(currentPlatform, finding), [currentPlatform, finding]);

  function handleSelect(p) {
    setPlatform(p);
    setCopied(false);
  }

  async function handleCopy() {
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
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
            {PLATFORMS.map((p) => {
              const active = currentPlatform === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => handleSelect(p.key)}
                  style={{
                    padding: "5px 11px",
                    fontSize: 10.5,
                    fontFamily: "var(--mono)",
                    letterSpacing: 0.5,
                    cursor: "pointer",
                    borderRadius: 4,
                    border: active ? `1px solid ${p.color}` : "1px solid var(--line)",
                    background: active ? p.bg : "transparent",
                    color: active ? p.color : "var(--dim)",
                    fontWeight: active ? 700 : 400,
                    transition: "all 0.15s",
                  }}
                >
                  {p.key}
                </button>
              );
            })}
            <button
              style={{
                padding: "5px 10px",
                fontSize: 10,
                fontFamily: "var(--mono)",
                color: "var(--dim)",
                background: "none",
                border: "1px solid var(--line)",
                borderRadius: 4,
                cursor: "pointer",
              }}
              onClick={() => { setOpen(false); setPlatform(null); setCopied(false); }}
            >
              ▲ HIDE
            </button>
          </div>

          <div style={{ position: "relative" }}>
            <pre
              style={{
                background: "var(--bg)",
                border: "1px solid var(--line)",
                borderRadius: 4,
                padding: 12,
                fontSize: 11.5,
                fontFamily: "var(--mono)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: 260,
                overflowY: "auto",
                lineHeight: 1.65,
                margin: 0,
              }}
            >
              {highlightSyntax(code)}
            </pre>
            <button
              onClick={handleCopy}
              style={{
                ...copyBtnBase,
                position: "absolute",
                top: 8,
                right: 8,
                color: copied ? "var(--green)" : "var(--cyan)",
                borderColor: copied ? "var(--green)" : "var(--cyan)",
                background: copied ? "rgba(51,255,161,0.15)" : "rgba(0,0,0,0.5)",
                boxShadow: copied ? "0 0 12px rgba(51,255,161,0.3)" : "none",
              }}
            >
              {copied ? "✓ COPIED" : "📋 COPY"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

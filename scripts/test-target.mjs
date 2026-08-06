import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";

const PORT = Number(process.env.PORT || 5099);

function verifyToken() {
  if (existsSync(new URL("./verify-token.txt", import.meta.url))) {
    return readFileSync(new URL("./verify-token.txt", import.meta.url), "utf8").trim();
  }
  return "SA__TEST_TOKEN__";
}

const home = `<!doctype html><html><head>
<meta name="generator" content="WordPress 5.2.4">
<title>Test Target</title>
<link rel="icon" href="/vite.svg">
<script src="https://cdn.tailwindcss.com"></script>
<script src="/app.js"></script>
</head><body>
<h1>Welcome</h1>
<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
<img src="http://localhost:5099/logo.png" alt="logo">
<a href="/about">About</a>
<a href="/blog">Blog</a>
<a href="#">Home</a>
<a href="#">Features</a>
<a href="/admin">Admin</a>
<a href="/api/users">API</a>
<form action="/search" method="POST">
  <input name="q"><button>Search</button>
</form>
<!-- TODO: replace placeholder content -->
<!-- generated with claude.ai -->
<!-- internal dev box: 192.168.1.14:3000 -->
</body></html>`;

const appJs = `
const API = "/api/v1/users";
fetch("/graphql", { method: "POST" });
const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";
const stripe = "sk_" + "live_51Hxample00000000000000000000000000000000";
const openai = "sk-proj-AbC1234567890AbC1234567890AbC1234567890AbC123456789";
function load() { axios.get("/internal/stats"); }
function loginGo() { window.location = "/login?next=" + getParam("return"); }
document.cookie = "token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.x0x0x0x0x0x0x0x0x0x0x0x0x0";
`;

const appJsMap = `{"version":3,"sources":["src/app.ts"],"names":[],"mappings":"AAAA,IAAM...","sourcesContent":["const AWS_KEY = \"AKIAIOSFODNN7EXAMPLE\";\\nconst stripe = \"sk_" + "live_51Hxample00000000000000000000000000000000\";"]}`;

const page = (t) => `<!doctype html><html><head><title>${t}</title></head><body><h1>${t}</h1></body></html>`;

const robots = `User-agent: *
Disallow: /admin
Disallow: /backup
Disallow: /api
Sitemap: /sitemap.xml
`;

const sitemap = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>http://localhost:5099/</loc></url>
<url><loc>http://localhost:5099/about</loc></url>
<url><loc>http://localhost:5099/blog</loc></url>
</urlset>`;

const uploadsListing = `<html><head><title>Index of /uploads</title></head><body>
<h1>Index of /uploads</h1>
<a href="backup.zip">backup.zip</a>
<a href="db.sql">db.sql</a>
<a href="secret-token.txt">secret-token.txt</a>
</body></html>`;

const routes = {
  "/": {
    body: home,
    headers: {
      "set-cookie": "session=abc123; Path=/",
      "x-powered-by": "Express",
      "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; object-src 'none'",
    },
  },
  "/about": { body: page("About") },
  "/blog": { body: page("Blog") },
  "/admin": { body: page("Admin Panel"), headers: { "www-authenticate": "Basic" } },
  "/api/users": {
    body: JSON.stringify([{ id: 1, name: "alice", email: "admin@test.local" }]),
    headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=3600" },
  },
  "/api/v1/users": { body: JSON.stringify({ count: 1 }) },
  "/internal/stats": { body: JSON.stringify({ cpu: 42, db: "mongodb://admin:secret123@10.0.0.5:27017/prod" }) },
  "/app.js": { body: appJs, type: "application/javascript" },
  "/app.js.map": { body: appJsMap, type: "application/json" },
  "/.env": { body: "DB_PASSWORD=supersecret\nAPI_KEY=sk_" + "test_abcdefghijklmnopqrstuvwxyz12345678\n" },
  "/backup.sql": { body: "-- mysql dump\nINSERT INTO users VALUES (1,'admin','password123');\n" },
  "/phpinfo.php": { body: "phpinfo() output here" },
  "/graphql": { body: JSON.stringify({ data: { __schema: {} } }) },
  "/server-status": { body: "Apache Server Status at port 80", status: 200 },
  "/robots.txt": { body: robots, type: "text/plain" },
  "/sitemap.xml": { body: sitemap, type: "application/xml" },
  "/uploads/": { body: uploadsListing },
  "/error": { body: "Error: TypeError at foo (server.js:42:10)\n    at /var/www/site/lib/handler.js:12:9", status: 500 },
};

const server = createServer((req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (path === "/.well-known/siteaudit-verify.txt") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end(verifyToken());
    return;
  }
  if (req.method === "OPTIONS") {
    res.writeHead(200, { allow: "GET, HEAD, POST, PUT, DELETE, OPTIONS", "content-type": "text/plain" });
    res.end("OPTIONS, GET, HEAD, POST, PUT, DELETE");
    return;
  }
  const route = routes[path];
  if (!route) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not Found");
    return;
  }
  const headers = {
    "content-type": route.type || "text/html",
    ...(route.headers || {}),
  };
  res.writeHead(route.status || 200, headers);
  res.end(route.body);
});

server.listen(PORT, () => console.log(`[test-target] vulnerable demo on http://localhost:${PORT}`));

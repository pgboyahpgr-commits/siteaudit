import { crawl } from "./crawl.js";
import { fingerprintFromPage } from "./fingerprint.js";
import { checkTls } from "./tls.js";
import { httpGet } from "./http.js";
import {
  REQUIRED_HEADERS,
  ADVANCED_HEADERS,
  analyzeCsp,
  checkExposedPaths,
  checkDirectoryListing,
  checkSourceMaps,
  checkHttpMethods,
  enumerateSubdomains,
  fetchRobots,
  analyzeCookies,
  analyzeCors,
  analyzeCacheControl,
  scanSecrets,
  scanInfoLeaks,
  scanOpenRedirects,
} from "./checks.js";
import { lookupCves } from "./cve.js";
import { getFix, computeScore } from "./fixes.js";
import { collectHostInfo } from "./hostinfo.js";
import { checkDnsDeep, generateDnsFixes } from "./dnsdeep.js";
import { auditJsSupplyChain } from "./supplychain.js";
import { parseSecurityTxt } from "./securitytxt.js";
import { fingerprintWaf, generateWafFix } from "./waf.js";
import { scoreCookies } from "./cookiescore.js";
import { checkJwts } from "./jwtcheck.js";
import { scoreEndpointRisk } from "./endpointrisk.js";
import { checkSubdomainTakeover, checkCorsExploitImpact, detectRateLimiting } from "./advanced.js";

let findSeq = 0;
const newFindingId = () => `fn_${(++findSeq).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function finding({ severity, category, title, url, evidence, description, cveId = null, phase, tool }) {
  const { fix, references } = getFix(category, { url, cveId });
  return {
    id: newFindingId(),
    severity,
    category,
    title,
    url: url || null,
    evidence: (evidence || "").toString().slice(0, 1400),
    description,
    cveId,
    fix,
    references,
    phase,
    tool,
  };
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const ENDPOINT_RE = /["'`](\/(?:api\/|v\d+\/|graphql|admin|wp-|dashboard|internal|private|users|auth|login|upload|static|public|health|metrics))[a-zA-Z0-9_\-/{}?=&.${}]*["'`]|["'`](?:fetch|axios|\.get|\.post|\.put|\.delete|\.patch)\s*\(\s*["'`]([^"'`)\s]+)/g;
const FORM_RE = /<form[^>]*>([\s\S]*?)<\/form>/gi;
const HIDDEN_TOKEN_RE = /<input[^>]+type=["']hidden["'][^>]+name=["'][^"']*(csrf|token|_token|nonce|authenticity)[^"']*["']/i;
const FORM_METHOD_RE = /<form[^>]+method=["'](post|put|delete|patch)["']/i;
const MIXED_RE = /(?:src|href)="(http:\/\/[^"']+)"/gi;

export async function runScan(scan, onProgress = () => {}) {
  const targetUrl = scan.targetUrl;
  const findings = [];
  const meta = { tech: [], services: [], pagesCrawled: 0, jsFiles: [], endpoints: [], endpointCount: 0, cookies: [], robots: null, crawls: [], subdomains: [], dnsDeep: null, dnsFixes: [], supplyChain: [], securityTxt: null, waf: [], cookieScore: null, jwts: [], endpointRisk: [], subdomainTakeover: [], corsImpact: null, rateLimit: null };

  // ---- Phase 1: Discovery ----
  onProgress(1, "Discovery", "Crawling pages and collecting source code...");
  let crawlResult = null;
  try {
    const crawlMax = scan.crawlDepth || 50;
    crawlResult = await crawl(targetUrl, {
      maxPages: crawlMax,
      pacingMs: scan.pacingMs || 80,
      onProgress: (p) => {
        onProgress(1, "Discovery", `Crawled ${p.crawled}/${crawlMax} · ${p.remaining} queued · ${p.discovered} discovered`);
      },
    });
    meta.pagesCrawled = crawlResult.pages.length;
    meta.jsFiles = crawlResult.jsFiles;
    if (!crawlResult.pages.length) {
      findings.push(
        finding({
          severity: "high",
          category: "misconfig",
          title: "Target unreachable or returned no content",
          url: targetUrl,
          evidence: "No pages could be fetched.",
          description: "The crawler could not retrieve any page. The site may be down, blocking bots, or the URL is wrong.",
          phase: "discovery",
          tool: "crawler",
        })
      );
      return await finish();
    }
  } catch (err) {
    findings.push(
      finding({
        severity: "high",
        category: "misconfig",
        title: "Discovery failed",
        url: targetUrl,
        evidence: err.message,
        description: `The discovery phase errored: ${err.message}`,
        phase: "discovery",
        tool: "crawler",
      })
    );
    return await finish();
  }

  const home = crawlResult.pages.find((p) => p.url === crawlResult.baseUrl) || crawlResult.pages[0];
  const allPages = crawlResult.pages;

  meta.pageData = allPages.slice(0, 30).map(p => ({
    url: p.url,
    status: p.status,
    htmlSnippet: (p.html || "").slice(0, 15000),
    title: p.title,
    generator: p.generator,
    headers: p.headers ? Object.fromEntries(Object.entries(p.headers).slice(0, 15)) : {},
  }));
  meta.externalResources = {
    scripts: [...new Set(allPages.flatMap(p => {
      const matches = (p.html || "").match(/<script[^>]+src=["']([^"']+)["']/gi) || [];
      return matches.map(m => (m.match(/src=["']([^"']+)["']/i) || [])[1]).filter(Boolean);
    }))].slice(0, 50),
    styles: [...new Set(allPages.flatMap(p => {
      const matches = (p.html || "").match(/<link[^>]+href=["']([^"']+\.css[^"']*)["']/gi) || [];
      return matches.map(m => (m.match(/href=["']([^"']+)["']/i) || [])[1]).filter(Boolean);
    }))].slice(0, 50),
    images: [...new Set(allPages.flatMap(p => {
      const matches = (p.html || "").match(/<img[^>]+src=["']([^"']+)["']/gi) || [];
      return matches.map(m => (m.match(/src=["']([^"']+)["']/i) || [])[1]).filter(Boolean);
    }))].slice(0, 50),
    links: [...new Set(allPages.flatMap(p => {
      const matches = (p.html || "").match(/<a[^>]+href=["'](https?:\/\/[^"']+)["']/gi) || [];
      return matches.map(m => (m.match(/href=["']([^"']+)["']/i) || [])[1]).filter(Boolean);
    }))].slice(0, 100),
  };

  // ---- robots.txt ----
  try {
    const robots = await fetchRobots(targetUrl);
    if (robots) {
      meta.robots = robots;
      if (robots.disallowed.length) {
        findings.push(
          finding({
            severity: "info",
            category: "info",
            title: `${robots.disallowed.length} paths disallowed in robots.txt`,
            url: new URL("/robots.txt", new URL(targetUrl).origin).href,
            evidence: robots.disallowed.slice(0, 12).join("\n"),
            description: "robots.txt lists paths the owner wants hidden. These are prime attack surface - verify each is actually protected.",
            phase: "discovery",
            tool: "robots",
          })
        );
        for (const d of robots.disallowed.slice(0, 6)) {
          if (d === "/" || d === "/*") continue;
          const res = await httpGet(new URL(d, new URL(targetUrl).origin).href, { timeout: 7000 });
          if (res.ok && res.status !== 404) {
            findings.push(
              finding({
                severity: "medium",
                category: "endpoint",
                title: `robots.txt-disallowed path is publicly reachable: ${d}`,
                url: new URL(d, new URL(targetUrl).origin).href,
                evidence: `HTTP ${res.status} · ${(res.text || "").slice(0, 80)}`,
                description: "A path you tried to hide with robots.txt returns content. robots.txt is not access control.",
                phase: "discovery",
                tool: "robots",
              })
            );
          }
        }
      }
    }
  } catch {
    /* non-fatal */
  }

  // ---- Phase 2: Fingerprint ----
  onProgress(2, "Fingerprint", "Detecting technologies and versions...");
  try {
    const fp = fingerprintFromPage(home);
    meta.tech = fp.tech;
    meta.services = fp.services;
    if (fp.services.length) {
      const byCategory = {};
      for (const s of fp.services) {
        if (!byCategory[s.category]) byCategory[s.category] = [];
        byCategory[s.category].push(s.name);
      }
      for (const [cat, names] of Object.entries(byCategory)) {
        findings.push(
          finding({
            severity: "info",
            category: "info",
            title: `${cat} detected: ${names.join(", ")}`,
            url: home.url,
            evidence: names.join("\n"),
            description: `${names.length} third-party ${cat.toLowerCase()} service(s) found on this page. Each represents a trust boundary and potential supply-chain attack surface.`,
            phase: "fingerprint",
            tool: "html",
          })
        );
      }
    }
    if (home.headers?.["server"] && !/cloudflare|vercel|netlify/i.test(home.headers["server"])) {
      findings.push(
        finding({
          severity: "info",
          category: "info",
          title: `Server banner exposed: ${home.headers["server"]}`,
          url: home.url,
          evidence: `Server: ${home.headers["server"]}`,
          description: "The web server reveals its identity, helping attackers narrow down known exploits.",
          phase: "fingerprint",
          tool: "headers",
        })
      );
    }
    if (home.generator) {
      findings.push(
        finding({
          severity: "info",
          category: "info",
          title: `CMS/framework identified: ${home.generator}`,
          url: home.url,
          evidence: `<meta generator="${home.generator}">`,
          description: "The site advertises its generator, which can be used to target known vulnerabilities.",
          phase: "fingerprint",
          tool: "html",
        })
      );
    }
  } catch {
    /* non-fatal */
  }

  // ---- Subdomain enumeration (certificate transparency) ----
  onProgress(2, "Fingerprint", "Enumerating subdomains via certificate transparency...");
  try {
    const subdomains = await enumerateSubdomains(new URL(targetUrl).hostname);
    if (subdomains.length) {
      meta.subdomains = subdomains;
      findings.push(
        finding({
          severity: "info",
          category: "info",
          title: `${subdomains.length} subdomains found via certificate transparency`,
          url: targetUrl,
          evidence: subdomains.slice(0, 15).join("\n"),
          description: "crt.sh (Certificate Transparency logs) reveals all subdomains ever issued a certificate. Each is potential attack surface — audit them.",
          phase: "fingerprint",
          tool: "crt.sh",
        })
      );
    }
  } catch {
    /* non-fatal */
  }

  // ---- Phase 3: Headers, cookies, CORS ----
  onProgress(3, "Headers", "Auditing security headers, cookies & CORS...");
  try {
    const missing = REQUIRED_HEADERS.filter((h) => !home.headers?.[h.name.toLowerCase()]);
    for (const h of missing) {
      findings.push(
        finding({
          severity: h.name === "Content-Security-Policy" || h.name === "Strict-Transport-Security" ? "medium" : "low",
          category: "header",
          title: `Missing ${h.name} header`,
          url: home.url,
          evidence: `${h.name} not present in response headers.`,
          description: h.reason + ".",
          phase: "headers",
          tool: "headers",
        })
      );
    }

    const missingAdv = ADVANCED_HEADERS.filter((h) => !home.headers?.[h.name.toLowerCase()]);
    for (const h of missingAdv) {
      findings.push(
        finding({
          severity: "low",
          category: "header",
          title: `Missing ${h.name} header`,
          url: home.url,
          evidence: `${h.name} not present in response headers.`,
          description: h.reason + ".",
          phase: "headers",
          tool: "headers",
        })
      );
    }

    const cspValue = home.headers?.["content-security-policy"];
    if (cspValue) {
      const csp = analyzeCsp(cspValue);
      if (csp && csp.severity !== "info") {
        findings.push(
          finding({
            severity: csp.severity,
            category: "header",
            title: "Weak Content-Security-Policy configuration",
            url: home.url,
            evidence: cspValue.slice(0, 220),
            description: csp.note,
            phase: "headers",
            tool: "headers",
          })
        );
      }
    }

    const methods = await checkHttpMethods(targetUrl);
    if (methods) {
      findings.push(
        finding({
          severity: methods.severity,
          category: "misconfig",
          title: `Uncommon HTTP methods allowed: ${methods.methods}`,
          url: home.url,
          evidence: `Allow: ${methods.methods}`,
          description: `The server advertises ${methods.risky.join(", ")}. If enabled on real resources these can modify data or leak state. Disable unused methods.`,
          phase: "headers",
          tool: "http",
        })
      );
    }

    const cors = analyzeCors(home.headers);
    if (cors) {
      findings.push(
        finding({
          severity: cors.severity,
          category: "misconfig",
          title: "CORS misconfiguration detected",
          url: home.url,
          evidence: `Access-Control-Allow-Origin: ${home.headers?.["access-control-allow-origin"] || "(none)"} · credentials: ${home.headers?.["access-control-allow-credentials"] || "(none)"}`,
          description: cors.note,
          phase: "headers",
          tool: "headers",
        })
      );
    }

    const setCookies = allPages.flatMap((p) => {
      const h = p.headers || {};
      const raw = h["set-cookie"];
      if (!raw) return [];
      return Array.isArray(raw) ? raw : [raw];
    });
    meta.cookies = setCookies;
    const cookieIssues = analyzeCookies(setCookies);
    for (const c of cookieIssues.slice(0, 10)) {
      findings.push(
        finding({
          severity: "low",
          category: "misconfig",
          title: `Cookie "${c.name}" is ${c.issue}`,
          url: home.url,
          evidence: `Set-Cookie: ${c.name}=... (${c.issue})`,
          description: `The ${c.name} cookie is ${c.issue}. ${
            c.issue.includes("Secure")
              ? "It can be sent over plain HTTP and intercepted."
              : c.issue.includes("HttpOnly")
                ? "It is readable by JavaScript, so it can be stolen via XSS."
                : "It may be sent on cross-site requests, enabling CSRF."
          }`,
          phase: "headers",
          tool: "cookies",
        })
      );
    }

    // HTTPS redirect check
    if (home.url.startsWith("https://")) {
      try {
        const httpRes = await httpGet(home.url.replace(/^https:/, "http:"), { timeout: 9000 });
        if (httpRes.ok && httpRes.finalUrl?.startsWith("http://")) {
          findings.push(
            finding({
              severity: "medium",
              category: "tls",
              title: "HTTP is not redirected to HTTPS",
              url: home.url.replace(/^https:/, "http:"),
              evidence: `HTTP request returned ${httpRes.status} without an HTTPS redirect.`,
              description: "The site is reachable over plain HTTP, exposing traffic to interception. Add a permanent 301 redirect to HTTPS.",
              phase: "headers",
              tool: "http",
            })
          );
        }
      } catch {
        /* non-fatal */
      }
    }
  } catch {
    /* non-fatal */
  }

  // ---- Phase 4: TLS ----
  onProgress(4, "TLS", "Handshake & certificate analysis...");
  try {
    const tls = await checkTls(targetUrl);
    if (tls.error) {
      findings.push(
        finding({
          severity: "medium",
          category: "tls",
          title: "TLS handshake problem",
          url: targetUrl,
          evidence: tls.error,
          description: "The TLS handshake failed or reported an error. Check your certificate chain and cipher config.",
          phase: "tls",
          tool: "tls",
        })
      );
    } else if (tls.https) {
      if (tls.expired) {
        findings.push(
          finding({
            severity: "critical",
            category: "tls",
            title: "TLS certificate expired",
            url: targetUrl,
            evidence: `Not after: ${tls.notAfter}`,
            description: "The certificate is expired. Browsers will block the site and users see a security warning.",
            phase: "tls",
            tool: "tls",
          })
        );
      }
      if (tls.notYetValid) {
        findings.push(
          finding({
            severity: "high",
            category: "tls",
            title: "TLS certificate not yet valid",
            url: targetUrl,
            evidence: `Not before: ${tls.notBefore}`,
            description: "The certificate start date is in the future. Clock skew or a misissued cert.",
            phase: "tls",
            tool: "tls",
          })
        );
      }
      if (tls.selfSigned) {
        findings.push(
          finding({
            severity: "high",
            category: "tls",
            title: "Self-signed TLS certificate",
            url: targetUrl,
            evidence: `Issuer: ${tls.certIssuer}`,
            description: "A self-signed certificate means clients cannot validate your identity. Use a free CA (Let's Encrypt).",
            phase: "tls",
            tool: "tls",
          })
        );
      }
      if (tls.weakProtocol) {
        findings.push(
          finding({
            severity: "medium",
            category: "tls",
            title: `Legacy protocol in use: ${tls.protocol}`,
            url: targetUrl,
            evidence: `Negotiated ${tls.protocol}`,
            description: "TLS 1.0/1.1 are deprecated and vulnerable to protocol downgrade attacks.",
            phase: "tls",
            tool: "tls",
          })
        );
      }
      if (tls.daysRemaining != null && tls.daysRemaining < 30 && tls.daysRemaining >= 0) {
        findings.push(
          finding({
            severity: "low",
            category: "tls",
            title: `Certificate expires soon (${tls.daysRemaining} days)`,
            url: targetUrl,
            evidence: `Not after: ${tls.notAfter}`,
            description: "The certificate is near expiry. Set up auto-renewal.",
            phase: "tls",
            tool: "tls",
          })
        );
      }
    }
  } catch {
    /* non-fatal */
  }

  // ---- Phase 5: Enumeration ----
  onProgress(5, "Enumeration", "Probing exposed paths, dir listings & source maps...");
  try {
    const exposed = await checkExposedPaths(targetUrl);
    for (const e of exposed) {
      const criticalish = /\.git|\.env|\.sql|\.bak|backup|\.log|\.ssh|id_rsa|htpasswd/.test(e.path);
      const sens = /config|package|phpinfo|server-status|server-info|actuator|swagger|graphql|adminer|phpmyadmin|health|metrics|source|\.map|jenkins|grafana|kibana|elastic|redis/.test(e.path);
      findings.push(
        finding({
          severity: criticalish ? "critical" : sens ? "medium" : "info",
          category: "exposure",
          title: e.label,
          url: e.url,
          evidence: `HTTP ${e.status}${e.match ? ` · ${e.match}` : ""}${e.preview ? ` · "${e.preview.slice(0, 110)}"` : ""}`,
          description: `A request to ${e.path} returned HTTP ${e.status}. This path should not be publicly accessible.`,
          phase: "enumeration",
          tool: "prober",
        })
      );
    }

    const securityTxt = exposed.find((e) => e.path === "/.well-known/security.txt");
    if (!securityTxt) {
      findings.push(
        finding({
          severity: "info",
          category: "exposure",
          title: "security.txt is not published",
          url: new URL("/.well-known/security.txt", new URL(targetUrl).origin).href,
          evidence: "GET /.well-known/security.txt did not return content.",
          description: "security.txt (RFC 9116) tells security researchers how to reach you. Publishing it improves disclosure response.",
          phase: "enumeration",
          tool: "prober",
        })
      );
    }

    const dirListings = await checkDirectoryListing(targetUrl);
    for (const d of dirListings) {
      findings.push(
        finding({
          severity: "medium",
          category: "exposure",
          title: d.label + " at " + d.path,
          url: d.url,
          evidence: d.preview,
          description: "Directory browsing is enabled; attackers can list and download files. Disable autoindex.",
          phase: "enumeration",
          tool: "prober",
        })
      );
    }

    const maps = await checkSourceMaps(meta.jsFiles);
    for (const m of maps) {
      findings.push(
        finding({
          severity: "high",
          category: "exposure",
          title: "JavaScript source map exposed",
          url: m.url,
          evidence: `HTTP ${m.status} · ${m.size} bytes`,
          description: "Source maps (.map) expose your original source code (before minification) to anyone. Remove them in production.",
          phase: "enumeration",
          tool: "prober",
        })
      );
    }
  } catch {
    /* non-fatal */
  }

  meta.quickScanDone = true;

  // ---- Build source corpus (pages + JS) once, reused by endpoints + source phases ----
  const sources = allPages
    .map((pg) => ({ content: pg.html || "", url: pg.url, kind: "html" }))
    .filter((s) => s.content.length);
  let jsFetched = 0;
  for (const js of meta.jsFiles.slice(0, 25)) {
    const res = await httpGet(js, { timeout: 15000 });
    if (res.ok && res.text) {
      sources.push({ content: res.text.slice(0, 800000), url: js, kind: "js" });
      jsFetched++;
      if (jsFetched >= 15) break;
    }
  }

  const extractSourceEndpoints = () => {
    const out = new Map();
    for (const s of sources) {
      ENDPOINT_RE.lastIndex = 0;
      let m;
      while ((m = ENDPOINT_RE.exec(s.content))) {
        const val = (m[0] || "").replace(/["'`(]/g, "");
        if (val.startsWith("/") && val.length > 1 && val.length < 120 && !val.includes(" ")) {
          out.set(val, s.url);
        }
      }
    }
    return out;
  };

  // ---- Phase 6: Endpoint probing ----
  onProgress(6, "Endpoints", "Reverse-engineering & probing every endpoint...");
  try {
    const candidates = new Map();
    for (const p of allPages) {
      try {
        const u = new URL(p.url);
        candidates.set(u.pathname, p.url);
      } catch {
        /* ignore */
      }
    }
    for (const [path] of extractSourceEndpoints()) {
      candidates.set(path, new URL(path, new URL(targetUrl).origin).href);
    }
    const probeList = [...candidates.values()];
    const probed = [];
    let pi = 0;
    for (const url of probeList.slice(0, 100)) {
      pi++;
      onProgress(6, "Endpoints", `Probing ${pi}/${Math.min(probeList.length, 100)} endpoints...`);
      try {
        const res = await httpGet(url, { timeout: 8000 });
        const path = new URL(res.url || url).pathname;
        const contentType = res.headers?.get?.("content-type") || "";
        const isApi = /(api|graphql|v\d+|internal|swagger|actuator|health|metrics|json)/i.test(path) || /json/.test(contentType);
        probed.push({ url, finalUrl: res.url || url, status: res.status, contentType: contentType.split(";")[0], isApi, size: (res.text || "").length });
        const cacheIssue = analyzeCacheControl(path, res.headers?.get?.("cache-control"), res.status);
        if (cacheIssue) {
          findings.push(
            finding({
              severity: cacheIssue.severity,
              category: "misconfig",
              title: `Sensitive endpoint is cacheable: ${path}`,
              url,
              evidence: `Cache-Control: ${res.headers?.get?.("cache-control")}`,
              description: cacheIssue.note,
              phase: "endpoints",
              tool: "prober",
            })
          );
        }
        if (isApi && res.ok && res.status !== 404) {
          findings.push(
            finding({
              severity: "medium",
              category: "endpoint",
              title: `API endpoint reachable without authentication: ${path}`,
              url,
              evidence: `HTTP ${res.status} · ${contentType.split(";")[0]} · ${(res.text || "").slice(0, 120)}`,
              description: "This API/application endpoint returned data without authentication headers. If it exposes sensitive data or mutates state, secure it.",
              phase: "endpoints",
              tool: "prober",
            })
          );
        }
      } catch {
        /* ignore */
      }
    }
    meta.endpoints = probed;
    meta.endpointCount = probed.length;
  } catch {
    /* non-fatal */
  }

  // ---- Phase 7: Source review ----
  onProgress(7, "Source Review", "Scanning source for secrets, leaks, mixed content & CSRF...");
  try {
    const secretSet = new Map();
    for (const s of sources) {
      for (const hit of scanSecrets(s.content, s.url)) {
        if (!secretSet.has(hit.name)) secretSet.set(hit.name, { ...hit, sampleUrl: s.url });
      }
      const emails = new Set(s.content.match(EMAIL_RE) || []);
      for (const email of emails) {
        if (!/\.(png|jpg|svg|gif|webp)$/.test(email) && !/example\.com$/.test(email)) {
          findings.push(
            finding({
              severity: "low",
              category: "info",
              title: "Email address disclosed in source",
              url: s.url,
              evidence: email,
              description: "An email address is exposed in public source code and may be harvested for phishing.",
              phase: "source",
              tool: "regex",
            })
          );
        }
      }
      for (const leak of scanInfoLeaks(s.content, s.url)) {
        if (leak.kind === "stack-trace") {
          findings.push(
            finding({
              severity: "medium",
              category: "info",
              title: "Stack trace / error details disclosed",
              url: s.url,
              evidence: leak.snippet,
              description: "Raw stack traces or error details leak internals (file paths, library versions, logic) that aid attacks. Show generic errors in production.",
              phase: "source",
              tool: "regex",
            })
          );
        } else if (leak.kind === "internal-ip") {
          findings.push(
            finding({
              severity: "low",
              category: "info",
              title: "Internal IP address disclosed in source",
              url: s.url,
              evidence: leak.snippet,
              description: "An RFC1918 (private) IP appears in the source, revealing internal network layout.",
              phase: "source",
              tool: "regex",
            })
          );
        }
      }
    }
    for (const [, hit] of secretSet) {
      findings.push(
        finding({
          severity: hit.severity || "high",
          category: "secret",
          title: `Possible ${hit.name} in source code`,
          url: hit.sampleUrl,
          evidence: hit.snippet,
          description: `A possible ${hit.name} was found in public source (${hit.source}). ${hit.count} match(es). Treat as a real credential until proven otherwise.`,
          phase: "source",
          tool: "regex",
        })
      );
    }

    // Open redirects: user-controlled params feeding location/redirect
    let redirectHits = 0;
    for (const s of sources) {
      const hits = scanOpenRedirects(s.content, s.url);
      if (hits.length && redirectHits < 3) {
        redirectHits++;
        findings.push(
          finding({
            severity: "low",
            category: "misconfig",
            title: "Possible open redirect pattern in source",
            url: s.url,
            evidence: hits.join("\n"),
            description: "Code sets a redirect (location/next/return/url params) from a value that may be attacker-controlled. If not validated against an allowlist, phishers can use it to abuse your domain's trust.",
            phase: "source",
            tool: "regex",
          })
        );
      }
    }

    // Mixed content (https page loading http resources)
    if (home.url.startsWith("https://")) {
      let mixedCount = 0;
      for (const s of sources.slice(0, 5)) {
        MIXED_RE.lastIndex = 0;
        const m = s.content.match(MIXED_RE);
        if (m) {
          mixedCount += m.length;
          findings.push(
            finding({
              severity: "medium",
              category: "misconfig",
              title: "Mixed content: HTTPS page loads HTTP resource",
              url: s.url,
              evidence: m.slice(0, 5).join("\n"),
              description: "Secure pages are loading resources over plain HTTP, letting attackers tamper with them (content injection / MITM). Use protocol-relative or https URLs.",
              phase: "source",
              tool: "regex",
            })
          );
          if (mixedCount >= 6) break;
        }
      }
    }

    // Forms without CSRF tokens
    let csrfForms = 0;
    for (const s of sources.slice(0, 6)) {
      FORM_RE.lastIndex = 0;
      let fm;
      while ((fm = FORM_RE.exec(s.content)) && csrfForms < 4) {
        const form = fm[1];
        if (FORM_METHOD_RE.test(fm[0]) && !HIDDEN_TOKEN_RE.test(form)) {
          csrfForms++;
          findings.push(
            finding({
              severity: "low",
              category: "misconfig",
              title: "Form has no CSRF token",
              url: s.url,
              evidence: fm[0].slice(0, 220),
              description: "This form mutates state without a CSRF token. Attackers can submit it on behalf of logged-in users. Add a CSRF token + SameSite cookies.",
              phase: "source",
              tool: "regex",
            })
          );
        }
      }
    }
  } catch {
    /* non-fatal */
  }

  // ---- Phase 8: CVE lookup ----
  onProgress(8, "CVE Matching", "Matching detected versions against known CVEs...");
  try {
    const cves = lookupCves(meta.tech);
    for (const c of cves) {
      findings.push(
        finding({
          severity: c.cvss.startsWith("9") ? "high" : "medium",
          category: "cve",
          title: `${c.cve} — ${c.title}`,
          url: home.url,
          evidence: `${c.detected} ≤ ${c.max} · CVSS ${c.cvss}`,
          description: `Detected version ${c.detected} is affected by ${c.cve}. ` + getFix("cve", { cveId: c.cve }).fix,
          cveId: c.cve,
          phase: "cve",
          tool: "cve-db",
          references: [c.ref, "https://nvd.nist.gov/vuln/search"],
        })
      );
    }
  } catch {
    /* non-fatal */
  }

  // ---- Endpoint summary ----
  if (meta.endpointCount) {
    const apiCount = meta.endpoints.filter((e) => e.isApi).length;
    findings.push(
      finding({
        severity: "info",
        category: "endpoint",
        title: `${meta.endpointCount} endpoints mapped (${apiCount} API) — see the endpoint table`,
        url: home.url,
        evidence: meta.endpoints.slice(0, 20).map((e) => `${e.status} ${e.url}`).join("\n"),
        description: "Every reachable endpoint was probed and tabulated below with status codes. Review each, especially unauthenticated API paths.",
        phase: "endpoints",
        tool: "prober",
      })
    );
  }

  // ---- Link structure analysis ----
  try {
    const linkCategories = { api: [], admin: [], auth: [], static: [], redirect: [], notFound: [], other: [] };
    for (const pg of allPages) {
      try {
        const pgUrl = new URL(pg.url);
        const path = pgUrl.pathname;
        if (/\/api\/|\/v\d+\/|\/graphql|\/rest\/|\/json$/i.test(path)) {
          linkCategories.api.push(pg.url);
        } else if (/\/(admin|dashboard|panel|wp-admin|manage|control)/i.test(path)) {
          linkCategories.admin.push(pg.url);
        } else if (/\/(login|signin|signup|register|auth|oauth|account|profile)/i.test(path)) {
          linkCategories.auth.push(pg.url);
        } else if (/\.(css|js|png|jpg|svg|ico|woff|ttf|webp|gif|json|xml|txt)(\?.*)?$/i.test(path)) {
          linkCategories.static.push(pg.url);
        } else if (/redirect|return|next|goto/.test(pgUrl.search)) {
          linkCategories.redirect.push(pg.url);
        } else {
          linkCategories.other.push(pg.url);
        }
      } catch { /* skip malformed URLs */ }
    }
    for (const pg of allPages) {
      if (pg.status === 404) linkCategories.notFound.push(pg.url);
    }
    const summaryParts = [];
    if (linkCategories.api.length) summaryParts.push(`${linkCategories.api.length} API routes`);
    if (linkCategories.admin.length) summaryParts.push(`${linkCategories.admin.length} admin panels`);
    if (linkCategories.auth.length) summaryParts.push(`${linkCategories.auth.length} auth pages`);
    if (linkCategories.static.length) summaryParts.push(`${linkCategories.static.length} static assets`);
    if (linkCategories.redirect.length) summaryParts.push(`${linkCategories.redirect.length} redirect pages`);
    if (linkCategories.notFound.length) summaryParts.push(`${linkCategories.notFound.length} 404/error pages`);
    findings.push(
      finding({
        severity: "info",
        category: "info",
        title: `Link structure: ${summaryParts.join(", ")}`,
        url: home.url,
        evidence: Object.entries(linkCategories).filter(([, v]) => v.length).map(([k, v]) => `${k}: ${v.slice(0, 5).join("\n")}`).join("\n\n"),
        description: "All crawled URLs categorized by pattern. API routes, admin panels, and auth pages are high-value targets for attackers.",
        phase: "endpoints",
        tool: "crawler",
      })
    );
    meta.linkCategories = linkCategories;
  } catch {
    /* non-fatal */
  }

  // ---- Phase 9: Active probes (runs in all modes) ----
  onProgress(9, "Active Probes", "Running SQLi, XSS, CSRF, and redirect tests...");
  try {
    await runActiveProbes(scan, findings, meta, allPages);
  } catch (err) {
    console.error("[active-probes] Error:", err.message);
  }

  async function runActiveProbes(scan, findings, meta, allPages) {
    const origin = new URL(scan.targetUrl).origin;

    const forms = [];
    for (const page of allPages) {
      const html = page.html || "";
      const formRegex = /<form[^>]*action=["']([^"']*)["'][^>]*method=["']([^"']*)["'][^>]*>([\s\S]*?)<\/form>/gi;
      let m;
      while ((m = formRegex.exec(html)) !== null) {
        forms.push({ url: page.url, action: m[1], method: m[2] || "get", html: m[3], pageHtml: html });
      }
    }

    // 1. CSRF check on forms
    for (const form of forms.slice(0, 10)) {
      const hasToken = /csrf|token|_token|nonce|authenticity/i.test(form.html);
      if ((form.method || "get").toLowerCase() !== "get" && !hasToken) {
        findings.push(finding({
          severity: "high", category: "misconfig",
          title: "Form without CSRF protection",
          url: form.url,
          evidence: `Form action=${form.action} method=${form.method} has no CSRF token field`,
          description: "This form changes state without anti-CSRF protection. Add a CSRF token + SameSite cookies.",
          phase: "active", tool: "csrf-check"
        }));
      }
    }

    // 2. SQL injection probes on form endpoints
    const sqliPayloads = ["' OR '1'='1", "1' AND 1=1--", "admin'--"];
    for (const form of forms.slice(0, 5)) {
      let action;
      try { action = new URL(form.action || "/", origin).href; } catch { continue; }
      for (const payload of sqliPayloads.slice(0, 2)) {
        try {
          const res = await httpGet(action + "?q=" + encodeURIComponent(payload), { timeout: 8000 });
          const sqliErrors = /sql|mysql|syntax error|ora-|postgres|sqlite|mssql/i;
          if (sqliErrors.test(res.text || "")) {
            findings.push(finding({
              severity: "critical", category: "injection",
              title: "Possible SQL injection vulnerability",
              url: action,
              evidence: `Payload: ${payload} triggered SQL error in response`,
              description: "The form endpoint returned SQL error messages when probed with injection payloads. This strongly suggests SQL injection is possible. Parameterize all queries immediately.",
              phase: "active", tool: "sqli-probe"
            }));
            break;
          }
        } catch { /* probe failed, continue */ }
      }
    }

    // 3. XSS reflection test
    const xssPayloads = ["<script>alert(1)</script>", "\"><svg onload=alert(1)>", "<img src=x onerror=alert(1)>"];
    for (const form of forms.slice(0, 5)) {
      let action;
      try { action = new URL(form.action || "/", origin).href; } catch { continue; }
      const xssPayload = xssPayloads[0];
      try {
        const res = await httpGet(action + "?q=" + encodeURIComponent(xssPayload), { timeout: 8000 });
        if (res.text && res.text.includes(xssPayload)) {
          findings.push(finding({
            severity: "high", category: "injection",
            title: "Reflected XSS vulnerability",
            url: action,
            evidence: `Payload ${xssPayload} was reflected in response`,
            description: "User input is reflected without sanitization. This enables cross-site scripting attacks. Escape output using context-appropriate encoding.",
            phase: "active", tool: "xss-probe"
          }));
          break;
        }
      } catch { /* probe failed, continue */ }
    }

    // 4. Open redirect check
    const redirectParams = ["url", "redirect", "next", "return", "goto", "target", "dest", "continue", "forward", "link", "uri", "path", "to", "ref", "callback"];
    for (const page of allPages.slice(0, 8)) {
      for (const param of redirectParams) {
        try {
          const testUrl = page.url.includes("?") ? `${page.url}&${param}=https://evil.com` : `${page.url}?${param}=https://evil.com`;
          const res = await httpGet(testUrl, { timeout: 8000 });
          const loc = res.headers?.get?.("location") || res.headers?.location;
          if (loc && loc.includes("evil.com")) {
            findings.push(finding({
              severity: "medium", category: "misconfig",
              title: "Open redirect detected via " + param + " parameter",
              url: page.url,
              evidence: `Setting ${param}=https://evil.com redirected to ${loc}`,
              description: "The site redirects to arbitrary external URLs via a query parameter. This enables phishing attacks. Validate redirects against an allowlist.",
              phase: "active", tool: "redirect-probe"
            }));
            break;
          }
        } catch { /* probe failed, continue */ }
      }
    }
  }

  async function finish() {
    meta.vibeSources = {
      html: sources.filter((s) => s.kind === "html").slice(0, 4).map((s) => s.content).join(" ").slice(0, 200000),
      js: sources.filter((s) => s.kind === "js").slice(0, 4).map((s) => s.content).join(" ").slice(0, 500000),
    };
    meta.titles = allPages.map((p) => p.title).filter(Boolean).slice(0, 20);
    meta.uniquePages = new Set(allPages.map((p) => `${(p.html || "").length}|${p.title}|${(p.html || "").slice(0, 200)}`)).size;
    const host = new URL(targetUrl).hostname;
    try {
      meta.hostInfo = await collectHostInfo(host);
    } catch {
      meta.hostInfo = null;
    }

    // ── Phase: DNS Deep Dive (SPF/DKIM/DMARC/CAA + full records) ──
    try {
      const dnsDeep = await checkDnsDeep(host);
      meta.dnsDeep = dnsDeep;
      meta.dnsFixes = generateDnsFixes(host, dnsDeep, findings);

      // Report DNS findings
      if (!dnsDeep.spf.present) {
        findings.push(finding({ severity: "high", category: "misconfig", title: "No SPF record — email spoofing possible", url: targetUrl, evidence: "SPF record not found in DNS", description: "Without SPF, anyone can send email claiming to be from this domain. Add a TXT record: v=spf1 mx -all", phase: "dns-deep", tool: "dns" }));
      } else if (dnsDeep.spf.mode !== "hardfail") {
        findings.push(finding({ severity: "medium", category: "misconfig", title: `SPF policy is ${dnsDeep.spf.mode || "unknown"} (not hardfail)`, url: targetUrl, evidence: dnsDeep.spf.raw, description: "SPF softfail/neutral allows spoofed emails through. Use -all (hardfail) for strict enforcement.", phase: "dns-deep", tool: "dns" }));
      }
      if (!dnsDeep.dmarc.present) {
        findings.push(finding({ severity: "high", category: "misconfig", title: "No DMARC record — email spoofing not prevented", url: targetUrl, evidence: "DMARC record not found in DNS", description: "DMARC tells receivers what to do with failed SPF/DKIM email. Add TXT _dmarc record with p=reject.", phase: "dns-deep", tool: "dns" }));
      } else if (dnsDeep.dmarc.policy === "none") {
        findings.push(finding({ severity: "medium", category: "misconfig", title: "DMARC policy is 'none' — monitoring only, no enforcement", url: targetUrl, evidence: dnsDeep.dmarc.raw, description: "Set p=reject to actually block spoofed emails. Currently only collecting reports.", phase: "dns-deep", tool: "dns" }));
      }
      if (!dnsDeep.dkim.present) {
        findings.push(finding({ severity: "medium", category: "misconfig", title: "No DKIM records found — email signing not configured", url: targetUrl, evidence: "No DKIM selectors found for common names", description: "DKIM cryptographically signs outgoing email so receivers can verify it was sent by this domain.", phase: "dns-deep", tool: "dns" }));
      }
    } catch { meta.dnsDeep = null; }

    // ── Phase: JS Supply Chain Audit ──
    try {
      meta.supplyChain = await auditJsSupplyChain(meta.jsFiles || [], crawlResult.pages || []);
      const vulnLibs = meta.supplyChain.filter(s => s.cves.length > 0);
      for (const lib of vulnLibs) {
        for (const cve of lib.cves) {
          findings.push(finding({
            severity: cve.cvss.startsWith("9") ? "critical" : "high",
            category: "cve",
            title: `${lib.lib} ${lib.version} — ${cve.cve}: ${cve.title}`,
            url: lib.src,
            evidence: `CVSS ${cve.cvss} · version ${lib.version} ≤ ${cve.maxVersion}`,
            description: `Third-party library ${lib.lib} v${lib.version} has a known vulnerability. Upgrade to latest patched version.`,
            cveId: cve.cve,
            phase: "supply-chain",
            tool: "js-audit",
          }));
        }
      }
      const noSri = meta.supplyChain.filter(s => s.sri && !s.sri.startsWith("error"));
      if (noSri.length) {
        findings.push(finding({ severity: "info", category: "info", title: `${noSri.length} CDN scripts have SRI hashes computed`, url: targetUrl, evidence: noSri.map(s => `${s.lib || s.src.split("/").pop()}: ${s.sri}`).join("\n"), description: "Subresource Integrity hashes prevent CDN compromise from injecting malicious code. We computed these for you.", phase: "supply-chain", tool: "sri" }));
      }
    } catch { meta.supplyChain = null; }

    // ── Phase: Security.txt RFC 9116 ──
    try {
      meta.securityTxt = await parseSecurityTxt(targetUrl);
      if (!meta.securityTxt.present) {
        findings.push(finding({ severity: "info", category: "info", title: "security.txt not published (RFC 9116)", url: meta.securityTxt.url, evidence: "No security.txt found at /.well-known/ or /", description: "Publishing security.txt tells researchers how to report vulnerabilities. It's a sign of a mature security program.", phase: "security-txt", tool: "parser" }));
      } else if (meta.securityTxt.issues.length) {
        findings.push(finding({ severity: "low", category: "misconfig", title: `security.txt has ${meta.securityTxt.issues.length} compliance issue(s)`, url: meta.securityTxt.url, evidence: meta.securityTxt.issues.join("\n"), description: "Improve security.txt to fully comply with RFC 9116 for better vulnerability disclosure.", phase: "security-txt", tool: "parser" }));
      }
    } catch { meta.securityTxt = null; }

    // ── Phase: WAF Fingerprinting ──
    try {
      const homeHeaders = home.headers ? Object.fromEntries(Object.entries(home.headers)) : {};
      meta.waf = fingerprintWaf(homeHeaders, meta.cookies || [], home.html || "");
      if (meta.waf.length) {
        const wafFix = generateWafFix(meta.waf);
        findings.push(finding({ severity: "info", category: "info", title: `WAF detected: ${meta.waf.map(w => `${w.name} (${w.confidence})`).join(", ")}`, url: targetUrl, evidence: JSON.stringify(meta.waf), description: wafFix ? wafFix.recommendations.join(". ") : "WAF presence detected. Verify rules are actively blocking attacks.", phase: "waf", tool: "fingerprint" }));
      }
    } catch { meta.waf = []; }

    // ── Phase: Cookie Security Scoring ──
    try {
      meta.cookieScore = scoreCookies(meta.cookies || []);
      if (meta.cookieScore.totalCookies > 0 && meta.cookieScore.overallScore < 70) {
        findings.push(finding({ severity: "low", category: "misconfig", title: `Cookie security score: ${meta.cookieScore.overallScore}/100`, url: targetUrl, evidence: `${meta.cookieScore.totalCookies} cookies · ${meta.cookieScore.cookies.filter(c => c.issues.length).length} with issues`, description: "Cookies are missing security flags. Enable Secure, HttpOnly, SameSite, and consider __Host- prefix for sensitive cookies.", phase: "cookies", tool: "scorer" }));
      }
    } catch { meta.cookieScore = null; }

    // ── Phase: JWT Analysis ──
    try {
      meta.jwts = checkJwts(sources, targetUrl);
      const badJwts = meta.jwts.filter(j => j.issues.some(i => i.severity === "critical" || i.severity === "high"));
      for (const j of badJwts) {
        findings.push(finding({ severity: "critical", category: "secret", title: "Insecure JWT detected in source code", url: j.source, evidence: j.issues.map(i => i.msg).join("\n"), description: "A JWT with security issues was found. Check the algorithm and claims — alg:none or missing expiration are critical vulnerabilities.", phase: "source", tool: "jwt-analyzer" }));
      }
    } catch { meta.jwts = []; }

    // ── Phase: Endpoint Risk Scoring ──
    try {
      meta.endpointRisk = scoreEndpointRisk(meta.endpoints || []);
      const risky = meta.endpointRisk.filter(e => e.risk === "critical" || e.risk === "high");
      if (risky.length) {
        findings.push(finding({ severity: "high", category: "endpoint", title: `${risky.length} high-risk endpoints detected`, url: targetUrl, evidence: risky.slice(0, 5).map(e => `${e.risk}: ${e.path} (${e.matchedPatterns.map(p => p.label).join(", ")})`).join("\n"), description: "These endpoints expose sensitive functionality. Ensure proper authentication and authorization on each.", phase: "endpoints", tool: "risk-scorer" }));
      }
    } catch { meta.endpointRisk = []; }

    // ── Subdomain Takeover Check ──
    try {
      meta.subdomainTakeover = await checkSubdomainTakeover(meta.subdomains || []);
      const takeovers = meta.subdomainTakeover.filter(s => s.risk === "critical" || s.risk === "high");
      for (const t of takeovers) {
        findings.push(finding({ severity: t.risk === "critical" ? "critical" : "high", category: "exposure", title: `Possible ${t.service || "subdomain"} takeover: ${t.subdomain}`, url: `https://${t.subdomain}`, evidence: t.evidence || t.issue, description: t.issue + ". If the service is no longer controlled, an attacker can claim it and serve malicious content.", phase: "subdomain", tool: "takeover-check" }));
      }
    } catch { meta.subdomainTakeover = []; }

    // ── CORS Exploit Impact ──
    try {
      const homeHeaders = home.headers ? Object.fromEntries(Object.entries(home.headers)) : {};
      meta.corsImpact = await checkCorsExploitImpact(homeHeaders, targetUrl);
      if (meta.corsImpact && meta.corsImpact.severity === "critical") {
        findings.push(finding({ severity: "critical", category: "misconfig", title: "Critical CORS misconfiguration — authenticated requests exposed", url: targetUrl, evidence: `ACAO: ${meta.corsImpact.origin} · Credentials: ${meta.corsImpact.credentials}`, description: meta.corsImpact.exploitScenario.join(". ") + `. CWE: ${meta.corsImpact.cwe}.`, phase: "headers", tool: "cors-impact" }));
      }
    } catch { meta.corsImpact = null; }

    // ── Rate Limiting Detection ──
    try {
      meta.rateLimit = await detectRateLimiting(targetUrl);
      if (meta.rateLimit.overall === "none") {
        findings.push(finding({ severity: "medium", category: "misconfig", title: "No rate limiting detected on API endpoints", url: targetUrl, evidence: meta.rateLimit.endpoints.map(e => `${e.url}: ${e.detail}`).join("\n"), description: "Endpoints accept unlimited rapid requests — vulnerable to brute force, credential stuffing, and DoS attacks. Implement token bucket or sliding window rate limiting.", phase: "endpoints", tool: "rate-limit" }));
      } else if (meta.rateLimit.overall === "partial") {
        findings.push(finding({ severity: "low", category: "info", title: "Partial rate limiting detected", url: targetUrl, evidence: `${meta.rateLimit.endpoints.filter(e => e.rated).length}/${meta.rateLimit.endpoints.length} endpoints rate-limited`, description: "Some endpoints have rate limiting, others don't. Ensure consistent protection across all public endpoints.", phase: "endpoints", tool: "rate-limit" }));
      }
    } catch { meta.rateLimit = null; }

    const score = computeScore(findings);
    return { findings, score, meta };
  }

  return await finish();
}

import { httpGet } from "./http.js";

const TAKEOVER_SIGNATURES = [
  { service: "Heroku", pattern: /herokuapp\.com|no such app|there's nothing here/i, cname: /heroku(app|dns)\.com$/i },
  { service: "GitHub Pages", pattern: /there isn't a github pages site here|404.*github pages/i, cname: /github\.io$/i },
  { service: "Netlify", pattern: /not found.*netlify|site not found/i, cname: /netlify\.app$/i },
  { service: "Vercel", pattern: /DEPLOYMENT_NOT_FOUND|404.*vercel/i, cname: /vercel\.app$/i },
  { service: "AWS S3", pattern: /NoSuchBucket|The specified bucket does not exist/i, cname: /s3[.-]|amazonaws\.com$/i },
  { service: "Azure", pattern: /404 Web Site not found|This web app is stopped/i, cname: /azurewebsites\.net$/i },
  { service: "Surge.sh", pattern: /project not found|surge/i, cname: /surge\.sh$/i },
  { service: "Fastly", pattern: /Fastly error: unknown domain/i, cname: /fastly\.net$/i },
  { service: "Shopify", pattern: /Sorry, this shop is currently unavailable/i, cname: /myshopify\.com$/i },
  { service: "CloudFront", pattern: /ERROR: The request could not be satisfied/i, cname: /cloudfront\.net$/i },
];

export async function checkSubdomainTakeover(subdomains) {
  if (!subdomains || !subdomains.length) return [];

  const results = [];
  for (const sub of subdomains.slice(0, 30)) {
    try {
      const url = `https://${sub}`;
      const res = await httpGet(url, { timeout: 10000 });

      if (res.status === 0) {
        // Could be dangling - check DNS
        results.push({ subdomain: sub, status: "dns_fail", issue: "DNS resolution failed — may be dangling", risk: "medium" });
        continue;
      }

      const body = (res.text || "").toLowerCase();
      for (const sig of TAKEOVER_SIGNATURES) {
        if (sig.pattern.test(body)) {
          results.push({
            subdomain: sub,
            service: sig.service,
            status: res.status,
            issue: `Possible ${sig.service} subdomain takeover — service returns error page`,
            risk: "critical",
            evidence: (res.text || "").slice(0, 200),
          });
          break;
        }
      }

      // Check if it's a 404 on a known SaaS platform
      if (res.status === 404 && !results.some(r => r.subdomain === sub)) {
        const server = (res.headers?.get?.("server") || res.headers?.get?.("x-powered-by") || "").toLowerCase();
        if (server.includes("netlify") || server.includes("vercel") || server.includes("heroku")) {
          results.push({ subdomain: sub, service: server, status: 404, issue: `404 on ${server} — may be unclaimed`, risk: "high" });
        }
      }
    } catch (err) {
      results.push({ subdomain: sub, status: "error", issue: `Connection error: ${err.message}`, risk: "low" });
    }
  }

  return results;
}

export async function checkCorsExploitImpact(headers, targetUrl) {
  const acao = headers?.["access-control-allow-origin"];
  const acac = headers?.["access-control-allow-credentials"];
  const acam = headers?.["access-control-allow-methods"];
  const acah = headers?.["access-control-allow-headers"];

  if (!acao) return null;

  const impact = {
    origin: acao,
    credentials: String(acac || "").toLowerCase() === "true",
    methods: acam || "GET, POST",
    headers: acah || "Content-Type",
    severity: "low",
    exploitScenario: [],
    cwe: null,
  };

  if (acao === "*") {
    impact.severity = "medium";
    if (impact.credentials) {
      impact.severity = "critical";
      impact.cwe = "CWE-942: Permissive Cross-domain Policy with Untrusted Domains";
      impact.exploitScenario.push("Any website can make authenticated requests as a logged-in user");
      impact.exploitScenario.push("Attacker's page: fetch('https://target/api/user', { credentials: 'include' }) steals user data");
    } else {
      impact.cwe = "CWE-346: Origin Validation Error";
      impact.exploitScenario.push("Any origin can read responses — PII/CSRF tokens may leak");
      impact.exploitScenario.push("Consider restricting to specific trusted origins");
    }
  }

  if (acao && acao !== "*") {
    impact.severity = "low";
    impact.exploitScenario.push(`Origin restricted to: ${acao}`);

    // Check if origin is overly broad
    if (acao.match(/https?:\/\/\*\./)) {
      impact.severity = "medium";
      impact.exploitScenario.push("Wildcard subdomain — any subdomain can access");
    }

    // Check if origin reflects request origin dynamically
    if (acao === "null") {
      impact.severity = "high";
      impact.cwe = "CWE-346: Origin Validation Error (null origin bypass)";
      impact.exploitScenario.push("'null' origin accepted — sandboxed iframes can bypass CORS");
    }
  }

  // Check method exposure
  const exposedMethods = (acam || "").toUpperCase().split(",").map(m => m.trim());
  const dangerous = exposedMethods.filter(m => ["PUT", "DELETE", "PATCH"].includes(m));
  if (dangerous.length) {
    impact.exploitScenario.push(`Write methods exposed via CORS: ${dangerous.join(", ")}`);
    if (impact.severity !== "critical") impact.severity = "high";
  }

  return impact;
}

export async function detectRateLimiting(targetUrl) {
  const origin = new URL(targetUrl).origin;
  const results = { endpoints: [], overall: "unknown" };
  const probes = [origin, `${origin}/api`, `${origin}/login`, `${origin}/`].filter(Boolean);

  for (const url of probes.slice(0, 3)) {
    const timings = [];
    // Send 5 rapid requests
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      try {
        const res = await httpGet(url, { timeout: 8000 });
        timings.push({ status: res.status, time: Date.now() - start, attempt: i + 1 });
        if (res.status === 429) {
          results.endpoints.push({
            url,
            rated: true,
            detail: `Rate limited at request ${i + 1} (HTTP 429)`,
            threshold: i + 1,
          });
          break;
        }
      } catch {
        timings.push({ status: 0, time: Date.now() - start, attempt: i + 1 });
      }
      if (i < 4) await new Promise(r => setTimeout(r, 50)); // 50ms gap
    }

    if (!results.endpoints.some(e => e.url === url)) {
      results.endpoints.push({
        url,
        rated: false,
        detail: "No rate limiting detected (5 requests in <1s)",
        timings: timings.map(t => `${t.status} (${t.time}ms)`),
      });
    }
  }

  const ratedCount = results.endpoints.filter(e => e.rated).length;
  results.overall = ratedCount === 0 ? "none" : ratedCount >= results.endpoints.length * 0.5 ? "good" : "partial";
  if (ratedCount === 0) {
    results.recommendation = "No rate limiting detected — endpoints are vulnerable to brute force and DoS attacks";
  }

  return results;
}

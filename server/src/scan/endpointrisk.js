const RISK_PATTERNS = [
  { pattern: /\/(?:admin|dashboard|panel|manage|control)(?:\/|$)/i, score: 30, label: "Admin panel", reason: "Administrative interface — high-value target" },
  { pattern: /\/(?:login|signin|signup|register|auth|oauth|sso)(?:\/|$)/i, score: 15, label: "Auth endpoint", reason: "Authentication endpoint — credential attacks possible" },
  { pattern: /\/(?:api|graphql|rest|v\d+)\/.*(?:user|profile|account|password)/i, score: 25, label: "User data API", reason: "Exposes user/profile data — target for data exfiltration" },
  { pattern: /\/(?:api|graphql)(?:\/|$)/i, score: 10, label: "API surface", reason: "Generic API endpoint — needs auth assessment" },
  { pattern: /\/(?:graphql|graphiql|playground)/i, score: 20, label: "GraphQL endpoint", reason: "GraphQL with introspection may expose entire schema" },
  { pattern: /\/(?:upload|import|export|download)/i, score: 15, label: "File operation", reason: "File upload/download — potential for injection/path traversal" },
  { pattern: /\/(?:config|settings|env|secret|key)/i, score: 35, label: "Configuration exposure", reason: "May expose config values/credentials" },
  { pattern: /\/(?:backup|restore|dump|sql|database)/i, score: 35, label: "Database/backup access", reason: "May expose database dumps or backup archives" },
  { pattern: /\/(?:wp-admin|wp-login|wp-json|wp-content)/i, score: 20, label: "WordPress surface", reason: "WordPress admin/API — common attack vector" },
  { pattern: /\/(?:\.git|\.env|\.aws|\.ssh)/i, score: 40, label: "Secret file exposure", reason: "Sensitive config/credential file — critical if exposed" },
  { pattern: /\/(?:phpinfo|phpmyadmin|adminer|pgadmin|pma)/i, score: 35, label: "Database admin tool", reason: "Database management tool — full DB access if unprotected" },
  { pattern: /\/(?:debug|test|staging|dev|sandbox)/i, score: 20, label: "Dev/staging access", reason: "Development environment — may have weaker security" },
  { pattern: /\/(?:webhook|callback|notify|event)/i, score: 10, label: "Webhook endpoint", reason: "Webhook receiver — verify signature validation" },
  { pattern: /\/(?:pay|payment|billing|checkout|invoice)/i, score: 25, label: "Payment endpoint", reason: "Financial transaction endpoint — high-value target" },
];

export function scoreEndpointRisk(endpoints) {
  const scored = endpoints.map(ep => {
    const path = new URL(ep.url, "http://localhost").pathname;
    const urlLower = ep.url.toLowerCase();
    let riskScore = 0;
    const matchedPatterns = [];

    for (const rp of RISK_PATTERNS) {
      if (rp.pattern.test(path) || rp.pattern.test(urlLower)) {
        riskScore += rp.score;
        matchedPatterns.push({ label: rp.label, reason: rp.reason, score: rp.score });
      }
    }

    // Boost API endpoints
    if (ep.isApi) riskScore += 5;

    // 4xx/5xx endpoints are less risky (already blocked)
    if (ep.status >= 400) riskScore = 0;

    let risk = "safe";
    if (riskScore >= 40) risk = "critical";
    else if (riskScore >= 25) risk = "high";
    else if (riskScore >= 10) risk = "medium";
    else if (riskScore > 0) risk = "low";

    return {
      url: ep.url,
      path,
      status: ep.status,
      isApi: ep.isApi,
      riskScore,
      risk,
      matchedPatterns: matchedPatterns.slice(0, 5),
    };
  });

  // Sort by risk score descending
  scored.sort((a, b) => b.riskScore - a.riskScore);

  return scored;
}

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "to", "of", "in", "on", "at", "for",
  "with", "and", "or", "not", "no", "your", "you", "this", "that", "it", "its", "has", "have", "had",
  "from", "by", "as", "can", "could", "may", "might", "detected", "found", "exposed", "missing",
]);

const WORKER = process.env.YT_SEARCH_API || "https://ytapis.djalokyt27.workers.dev";

function buildQuery(finding) {
  const words = (finding.title || "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w.toLowerCase()) && !/^[0-9]+$/.test(w));
  let query = words.slice(0, 6).join(" ");
  if (query.length > 60) query = query.slice(0, 60).trim();
  return `${query} how to fix`;
}

function buildFixPrompt(finding, targetUrl) {
  return [
    `You are a senior application security engineer. The website ${targetUrl} was scanned by SiteAudit and has this issue:`,
    ``,
    `SEVERITY: ${(finding.severity || "info").toUpperCase()}`,
    `CATEGORY: ${finding.category || "unknown"}`,
    `TITLE: ${finding.title || "Untitled finding"}`,
    `WHAT IT MEANS: ${finding.description || "—"}`,
    `EVIDENCE: ${finding.evidence ? finding.evidence.slice(0, 600) : "—"}`,
    finding.cveId ? `CVE: ${finding.cveId}` : null,
    finding.fix ? `BASELINE FIX: ${finding.fix}` : null,
    ``,
    `Give me a precise, copy-paste-ready fix for THIS exact issue: the exact code, config, or headers to change, the file(s) to edit, why it matters in 2 sentences, and how to verify the fix worked. Be specific — no generic advice.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function normalize(items) {
  const out = [];
  for (const it of items || []) {
    if (!it || typeof it.id !== "string" || !it.id) continue;
    out.push({
      id: it.id,
      title: String(it.title || "Untitled video").slice(0, 120),
      author: String(it.author || "YouTube").slice(0, 60),
      thumbnail: String(it.thumbnail || ""),
      fullUrl: it.fullUrl || `https://www.youtube.com/watch?v=${it.id}`,
      embedUrl: it.embedUrl || `https://www.youtube.com/embed/${it.id}?rel=0`,
    });
  }
  return out.slice(0, 6);
}

export async function searchVideos(query, limit = 6) {
  const q = String(query || "").trim().slice(0, 120);
  if (!q) return [];
  try {
    const url = `${WORKER}/search?q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; SiteAudit/1.0; +security agent)", accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return normalize(data).slice(0, limit);
  } catch {
    return [];
  }
}

export async function videosForIssues(findings, targetUrl, limit = 5) {
  const SEV = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  const ranked = (findings || [])
    .filter((f) => f && f.severity !== "info")
    .sort((a, b) => (SEV[a.severity] ?? 9) - (SEV[b.severity] ?? 9))
    .slice(0, limit);
  const issues = [];
  for (const f of ranked) {
    const query = buildQuery(f);
    const videos = await searchVideos(query, 4);
    issues.push({
      findingId: f.id,
      severity: f.severity,
      category: f.category,
      title: f.title,
      query,
      prompt: buildFixPrompt(f, targetUrl),
      videos,
    });
  }
  return issues;
}

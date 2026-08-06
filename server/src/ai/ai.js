import { detectVibeCode } from "./vibe.js";
import { getScan, updateScan } from "../store.js";
import { getFix } from "../scan/fixes.js";
import { lookupCves } from "../scan/cve.js";

const PROVIDERS = {
  gemini: {
    key: () => process.env.GEMINI_API_KEY,
    model: () => process.env.GEMINI_MODEL || "gemini-2.5-flash",
    call: async (system, user) => {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${PROVIDERS.gemini.model()}:generateContent?key=${PROVIDERS.gemini.key()}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 1600 },
          }),
          signal: AbortSignal.timeout(25000),
        }
      );
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
    },
  },
  openai: {
    key: () => process.env.OPENAI_API_KEY,
    model: () => process.env.OPENAI_MODEL || "gpt-4o-mini",
    call: async (system, user) => {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${PROVIDERS.openai.key()}` },
        body: JSON.stringify({
          model: PROVIDERS.openai.model(),
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.4,
          max_tokens: 1600,
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      return data?.choices?.[0]?.message?.content || "";
    },
  },
  anthropic: {
    key: () => process.env.ANTHROPIC_API_KEY,
    model: () => process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest",
    call: async (system, user) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": PROVIDERS.anthropic.key(),
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: PROVIDERS.anthropic.model(),
          max_tokens: 1600,
          system,
          messages: [{ role: "user", content: user }],
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      return data?.content?.map((c) => c.text).join("") || "";
    },
  },
};

export function aiProviders() {
  const order = (process.env.AI_PROVIDER || "gemini,openai,anthropic")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((p) => PROVIDERS[p] && PROVIDERS[p].key());
  return order;
}

export function aiEnabled() {
  return aiProviders().length > 0;
}

async function callLLM(system, user) {
  const order = aiProviders();
  const errors = [];
  for (const name of order) {
    try {
      const text = await PROVIDERS[name].call(system, user);
      if (text && text.trim()) return { text, provider: name };
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
    }
  }
  throw new Error(errors.join(" | ") || "no AI provider configured");
}

export async function parseJsonLoose(text) {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

function buildContext(scan) {
  const findings = scan.findings || [];
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) if (counts[f.severity] != null) counts[f.severity]++;
  const summary = {
    targetUrl: scan.targetUrl,
    score: scan.score,
    counts,
    top: findings
      .filter((f) => ["critical", "high"].includes(f.severity))
      .slice(0, 8)
      .map((f) => `[${f.severity}] ${f.title} @ ${f.url || scan.targetUrl}`),
    endpoints: (scan.meta?.endpoints || []).slice(0, 15).map((e) => `${e.status} ${e.isApi ? "API" : ""} ${e.url}`),
    tech: (scan.meta?.tech || []).map((t) => `${t.name}${t.version ? "@" + t.version : ""}`).slice(0, 10),
    subdomains: (scan.meta?.subdomains || []).slice(0, 10),
    cves: lookupCves(scan.meta?.tech || [])
      .slice(0, 5)
      .map((c) => c.cve),
  };
  return JSON.stringify(summary);
}

// ---------- Local fallback (deterministic, works with zero AI keys) ----------

function localAnalysis(scan) {
  const findings = scan.findings || [];
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) if (counts[f.severity] != null) counts[f.severity]++;
  const critical = findings.filter((f) => ["critical", "high"].includes(f.severity));
  const priorities = critical.slice(0, 3).map((f) => `${f.title} — ${f.fix || "fix listed in report"}`);
  const fixPlan = (critical.length ? critical : findings.filter((f) => f.severity === "medium")).slice(0, 5).map((f) => ({
    step: `Resolve ${f.severity}: ${f.title}`,
    action: f.fix || "Apply the fix recommended in the report.",
    why: f.description || "This exposes the site to attack.",
  }));
  const summary = `The site scored ${scan.score}/100. ${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low, ${counts.info} info. ${
    critical.length
      ? `The most urgent issues: ${critical[0].title}${critical[1] ? `, ${critical[1].title}` : ""}.`
      : "No critical or high-severity issues detected — the main improvements are the medium/low findings listed below."
  }`;
  return {
    engine: "local",
    summary,
    priorities,
    fixPlan,
    vibe: null,
    severityAssessment: counts.critical ? "high" : counts.high ? "medium" : "low",
  };
}

function localVibe(scan, vibe) {
  return {
    engine: "local",
    assessment: `${vibe.label} — ${vibe.summary} To look trustworthy, remove template leftovers and placeholder copy.`,
    recommendations: vibe.signals.slice(0, 4).map((s) => `Replace ${s.name} (${s.detail}).`),
  };
}

// ---------- Public API ----------

export async function analyzeFindings(scan) {
  const context = buildContext(scan);
  const system =
    "You are SiteAudit, an AI security analyst. You review a website security scan and explain it in plain, actionable language for a non-expert owner. Never invent vulnerabilities that are not in the data. Never fabricate CVEs. Be concise.";
  const user = `Here is the scan data as JSON:\n${context}\n\nRespond with STRICT JSON only:\n{
    "summary": "2-3 sentence plain-language summary of security posture",
    "severityAssessment": "high|medium|low",
    "priorities": ["top priority 1", "top priority 2", "top priority 3"],
    "fixPlan": [{"step":"actionable title","action":"exact concrete fix","why":"why it matters"}]
  }`;
  if (!aiEnabled()) {
    const local = localAnalysis(scan);
    return { ...local, provider: "local" };
  }
  try {
    const { text, provider } = await callLLM(system, user);
    const parsed = await parseJsonLoose(text);
    if (parsed?.summary && Array.isArray(parsed.fixPlan)) {
      return {
        engine: "ai",
        provider,
        summary: parsed.summary,
        severityAssessment: parsed.severityAssessment || "low",
        priorities: parsed.priorities || [],
        fixPlan: parsed.fixPlan,
        vibe: null,
      };
    }
    return { ...localAnalysis(scan), provider };
  } catch {
    return { ...localAnalysis(scan), provider: "local" };
  }
}

export async function analyzeVibe(scan) {
  const vibe = detectVibeCode(scan.meta || {});
  if (!aiEnabled()) {
    return { ...vibe, assessment: localVibe(scan, vibe).assessment, recommendations: localVibe(scan, vibe).recommendations, provider: "local" };
  }
  const system =
    "You are SiteAudit's 'VibeCheck' analyst. A site scan flagged signs that this app was built quickly with AI assistance (boilerplate, placeholder copy, default templates). Explain in 3-4 sentences how trustworthy the site looks, and give 3 concrete improvements to make it look production-grade.";
  const user = `VibeCode signals (JSON):\n${JSON.stringify(vibe.signals.slice(0, 12))}\nvibeScore=${vibe.score}, label=${vibe.label}\n\nRespond with STRICT JSON only: {"assessment":"paragraph","recommendations":["improvement 1","improvement 2","improvement 3"]}`;
  try {
    const { text, provider } = await callLLM(system, user);
    const parsed = await parseJsonLoose(text);
    if (parsed?.assessment) {
      return { ...vibe, assessment: parsed.assessment, recommendations: parsed.recommendations || [], provider };
    }
    return { ...vibe, ...localVibe(scan, vibe), provider };
  } catch {
    return { ...vibe, ...localVibe(scan, vibe), provider: "local" };
  }
}

export async function chatReply(scan, history, question) {
  const context = buildContext(scan);
  const system =
    "You are SiteAudit's AI security advisor. Answer the user's question about THEIR OWN site's scan. Use ONLY the provided scan data. Be concise and practical. If the data doesn't contain an answer, say so and suggest what to check. Never fabricate vulnerabilities or CVEs.";
  const user = `Scan data:\n${context}\n\nConversation so far:\n${history.map((m) => `${m.role}: ${m.content}`).join("\n")}\n\nQuestion: ${question}`;
  if (!aiEnabled()) return { reply: localChatAnswer(scan, question), provider: "local" };
  try {
    const { text, provider } = await callLLM(system, user);
    return { reply: text.trim(), provider };
  } catch {
    return { reply: localChatAnswer(scan, question), provider: "local" };
  }
}

function localChatAnswer(scan, question) {
  const findings = scan.findings || [];
  const q = question.toLowerCase();
  const relevant = findings.filter((f) => {
    const hay = `${f.title} ${f.category} ${f.description || ""} ${f.url || ""}`.toLowerCase();
    return q.split(/\s+/).some((w) => w.length > 3 && hay.includes(w));
  });
  if (relevant.length) {
    const f = relevant[0];
    return `Found something relevant: ${f.severity} — ${f.title}${f.url ? ` at ${f.url}` : ""}.\n\n${f.description || ""}\n\nHow to fix: ${f.fix || "see the report"}.${f.cveId ? `\n\nRelated CVE: ${f.cveId}` : ""}`;
  }
  if (/score|risk|how bad/.test(q)) {
    return `Overall security score: ${scan.score}/100. Breakdown: ${summarizeCounts(scan)}. ${
      scan.score < 50 ? "This needs urgent attention — start with the critical/high findings." : scan.score < 80 ? "Decent, but the medium/low findings should still be fixed." : "Looks good — keep fixing the remaining low findings."
    }`;
  }
  if (/what should|priority|first|fix/.test(q)) {
    const top = findings.filter((f) => ["critical", "high"].includes(f.severity));
    const pick = top.length ? top : findings.filter((f) => f.severity === "medium");
    return pick.slice(0, 3).map((f) => `- ${f.severity}: ${f.title} → ${f.fix || "fix in report"}`).join("\n") || "No actionable findings in this scan.";
  }
  return `I can answer questions about this scan of ${scan.targetUrl}. Summary: score ${scan.score}/100, ${summarizeCounts(scan)}. Ask me things like "what should I fix first?" or "explain the critical issues" or "is the score good?".`;
}

function summarizeCounts(scan) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of scan.findings || []) if (counts[f.severity] != null) counts[f.severity]++;
  return `${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low, ${counts.info} info`;
}

export async function ensureAiAnalysis(scanId) {
  try {
    const scan = getScan(scanId);
    if (!scan || scan.status !== "completed") return null;
    if (scan.ai?.summary && scan.ai?.vibe?.assessment) return scan.ai;
    const [analysis, vibe] = await Promise.all([analyzeFindings(scan), analyzeVibe(scan)]);
    const ai = { ...analysis, vibe, generatedAt: new Date().toISOString() };
    updateScan(scanId, { ai });
    return ai;
  } catch (err) {
    console.error(`[ai] analysis failed for ${scanId}:`, err.message);
    return null;
  }
}

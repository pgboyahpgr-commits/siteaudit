import { detectVibeCode } from "./vibe.js";
import { getScan, updateScan } from "../store.js";
import { getFix } from "../scan/fixes.js";
import { lookupCves } from "../scan/cve.js";

const PROVIDERS = {
  gemini: {
    key: () => (globalThis.__saUserSettings?.GEMINI_API_KEY) || process.env.GEMINI_API_KEY,
    model: () => process.env.GEMINI_MODEL || "gemini-1.5-flash",
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
    key: () => (globalThis.__saUserSettings?.OPENAI_API_KEY) || process.env.OPENAI_API_KEY,
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
    key: () => (globalThis.__saUserSettings?.ANTHROPIC_API_KEY) || process.env.ANTHROPIC_API_KEY,
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
  // OpenAI-compatible providers (xAI Grok, Completions AI, Mistral, NVIDIA NIM)
  xai: {
    key: () => (globalThis.__saUserSettings?.XAI_API_KEY) || process.env.XAI_API_KEY,
    model: () => process.env.XAI_MODEL || "grok-3",
    call: async (system, user) =>
      openAICompat({
        url: "https://api.x.ai/v1/chat/completions",
        key: process.env.XAI_API_KEY,
        model: process.env.XAI_MODEL || "grok-3",
        system,
        user,
      }),
  },
  completions: {
    key: () => (globalThis.__saUserSettings?.COMPLETIONS_API_KEY) || process.env.COMPLETIONS_API_KEY,
    model: () => process.env.COMPLETIONS_MODEL || "gemini-2.5-flash",
    call: async (system, user) =>
      openAICompat({
        url: (process.env.COMPLETIONS_BASE_URL || "https://completions.me/api/v1").replace(/\/$/, "") + "/chat/completions",
        key: process.env.COMPLETIONS_API_KEY,
        model: process.env.COMPLETIONS_MODEL || "gemini-2.5-flash",
        system,
        user,
      }),
  },
  mistral: {
    key: () => (globalThis.__saUserSettings?.MISTRAL_API_KEY) || process.env.MISTRAL_API_KEY,
    model: () => process.env.MISTRAL_MODEL || "mistral-small-latest",
    call: async (system, user) =>
      openAICompat({
        url: "https://api.mistral.ai/v1/chat/completions",
        key: process.env.MISTRAL_API_KEY,
        model: process.env.MISTRAL_MODEL || "mistral-small-latest",
        system,
        user,
      }),
  },
  nim: {
    key: () => (globalThis.__saUserSettings?.NVIDIA_NIM_API_KEY) || process.env.NVIDIA_NIM_API_KEY,
    model: () => process.env.NVIDIA_NIM_MODEL || "deepseek-ai/deepseek-r1",
    call: async (system, user) =>
      openAICompat({
        url: "https://integrate.api.nvidia.com/v1/chat/completions",
        key: process.env.NVIDIA_NIM_API_KEY,
        model: process.env.NVIDIA_NIM_MODEL || "deepseek-ai/deepseek-r1",
        system,
        user,
      }),
  },
  pollinations: {
    key: () => "pollinations-free",
    model: () => process.env.POLLINATIONS_MODEL || "openai",
    call: async (system, user) => {
      const res = await fetch("https://text.pollinations.ai/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          model: process.env.POLLINATIONS_MODEL || "openai",
          jsonMode: false
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`Pollinations HTTP ${res.status}`);
      const text = await res.text();
      return text || "";
    },
  },
  lmstudio: {
    key: () => {
      const enabled = globalThis.__saUserSettings?.LMSTUDIO_ENABLED || process.env.LMSTUDIO_ENABLED;
      const baseUrl = globalThis.__saUserSettings?.LMSTUDIO_BASE_URL || process.env.LMSTUDIO_BASE_URL;
      return (enabled === "1" || baseUrl) ? "lmstudio" : undefined;
    },
    model: () => globalThis.__saUserSettings?.LMSTUDIO_MODEL || process.env.LMSTUDIO_MODEL || "local-model",
    call: async (system, user) => {
      const baseUrl = (globalThis.__saUserSettings?.LMSTUDIO_BASE_URL || process.env.LMSTUDIO_BASE_URL || "http://localhost:1234/v1").replace(/\/$/, "");
      return openAICompat({ url: baseUrl + "/chat/completions", key: "lm-studio", model: PROVIDERS.lmstudio.model(), system, user });
    },
  },
};

// Any provider that speaks OpenAI's chat-completions format can share this caller.
async function openAICompat({ url, key, model, system, user }) {
  if (!key) throw new Error("missing API key");
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      max_tokens: 1600,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

export function aiProviders() {
  const defaultOrder = "lmstudio,gemini,xai,completions,pollinations";
  const order = (process.env.AI_PROVIDER || defaultOrder)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((p) => PROVIDERS[p] && (p === "pollinations" || PROVIDERS[p].key()));
  return order;
}

export function aiProviderNames() {
  return aiProviders();
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

function safeExtractJson(text) {
  if (!text || typeof text !== "string") return null;
  const maxLen = 50000;
  const s = text.length > maxLen ? text.slice(0, maxLen) : text;
  const start = s.indexOf("{");
  if (start === -1) return null;
  let braceCount = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"' && !escape) { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") braceCount++;
    else if (ch === "}") { braceCount--; if (braceCount === 0) { try { return JSON.parse(s.slice(start, i + 1)); } catch { return null; } } }
  }
  return null;
}

export async function parseJsonLoose(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return safeExtractJson(text);
  }
}

export function buildContext(scan) {
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

  // Try to find relevant findings by keyword match
  const relevant = findings.filter((f) => {
    const hay = `${f.title} ${f.category} ${f.description || ""} ${f.url || ""}`.toLowerCase();
    const words = q.split(/\s+/).filter((w) => w.length > 3);
    return words.some((w) => hay.includes(w));
  });

  if (relevant.length) {
    const f = relevant[0];
    return [
      `## ${f.severity.toUpperCase()}: ${f.title}`,
      f.url ? `\n**URL:** ${f.url}` : "",
      f.description ? `\n**What this means:** ${f.description}` : "",
      f.fix ? `\n**How to fix:** ${f.fix}` : "",
      f.cveId ? `\n**Related CVE:** ${f.cveId}` : "",
      f.evidence ? `\n**Evidence:** ${f.evidence.slice(0, 200)}` : "",
      relevant.length > 1 ? `\n\n*${relevant.length - 1} more related finding(s) found.*` : "",
    ].join("");
  }

  if (/score|risk|grade|how bad|rating/.test(q)) {
    const criticalHigh = findings.filter((f) => ["critical", "high"].includes(f.severity)).length;
    return [
      `**Overall security score: ${scan.score}/100**`,
      "",
      `Breakdown: ${summarizeCounts(scan)}`,
      "",
      scan.score < 50
        ? "This site needs urgent attention. Start with the critical and high findings — each one lists exact fix steps in the report below."
        : scan.score < 80
          ? "Decent score, but the medium and low findings still matter. Addressing these will significantly improve your security posture."
          : "Strong score! The remaining low-severity items are good hygiene to clean up. Your site is in solid shape.",
      "",
      criticalHigh > 0 ? `**${criticalHigh} critical/high issue(s) need immediate action.** Scroll down to FINDINGS for details.` : "",
    ].join("\n");
  }

  if (/what should|priority|first|urgent|important/.test(q)) {
    const top = findings.filter((f) => ["critical", "high"].includes(f.severity));
    if (top.length) {
      const list = top.slice(0, 5).map((f, i) => `${i + 1}. **${f.severity}**: ${f.title} → ${(f.fix || "see report").slice(0, 120)}`).join("\n\n");
      return `**Top ${Math.min(top.length, 5)} urgent fixes:**\n\n${list}`;
    }
    const medium = findings.filter((f) => f.severity === "medium");
    if (medium.length) {
      const list = medium.slice(0, 3).map((f, i) => `${i + 1}. ${f.title} → ${(f.fix || "see report").slice(0, 120)}`).join("\n\n");
      return `No critical/high issues found — nice! Here are your top medium-priority items:\n\n${list}`;
    }
    return "No actionable findings in this scan. Your site looks clean!";
  }

  if (/cve|vulnerability|exploit/.test(q)) {
    const cves = findings.filter((f) => f.cveId);
    if (cves.length) {
      return `**${cves.length} CVE(s) matched:**\n\n${cves.map((f) => `- **${f.cveId}**: ${f.title}`).join("\n")}`;
    }
    return "No CVEs matched for your detected technology versions. This is good — your stack appears up-to-date. However, our CVE database covers 22 entries; consider an external CVE scan for comprehensive coverage.";
  }

  if (/endpoint|api|route/.test(q) && scan.meta?.endpoints) {
    const eps = scan.meta.endpoints || [];
    const apiEps = eps.filter((e) => e.isApi);
    return [
      `**${eps.length} endpoints mapped** (${apiEps.length} API, ${eps.length - apiEps.length} pages)`,
      "",
      "Endpoints found:" + eps.slice(0, 10).map((e) => `\n- ${e.status} ${e.url} ${e.isApi ? "[API]" : ""}`).join(""),
      eps.length > 10 ? `\n\n*...and ${eps.length - 10} more. Scroll up to ENDPOINT MAP for the full list.*` : "",
    ].join("\n");
  }

  if (/header|csp|cors|hsts|xfo/.test(q)) {
    const headerFindings = findings.filter((f) => f.category === "header");
    if (headerFindings.length) {
      return `**${headerFindings.length} header issue(s) found:**\n\n${headerFindings.map((f) => `- ${f.severity}: ${f.title} → ${(f.fix || "see report").slice(0, 100)}`).join("\n")}`;
    }
    return "No security header issues found. Your headers look well-configured!";
  }

  if (/tls|ssl|certificate|https/.test(q)) {
    const tlsFindings = findings.filter((f) => f.category === "tls");
    const tls = scan.meta?.hostInfo?.tls;
    return [
      tlsFindings.length ? `**${tlsFindings.length} TLS issue(s):**\n${tlsFindings.map((f) => `- ${f.title} → ${f.fix || "see report"}`).join("\n")}` : "No TLS issues found.",
      tls ? `\n\nTLS: ${tls.protocol || "unknown"} · Certificate expires in ${tls.daysLeft != null ? tls.daysLeft + " days" : "?"} · Issuer: ${tls.issuer || "?"}` : "",
    ].join("\n");
  }

  if (/third.party|service|analytics|tracking|ad/.test(q)) {
    const svcs = scan.meta?.services || [];
    if (svcs.length) {
      const grouped = {};
      svcs.forEach((s) => { if (!grouped[s.category]) grouped[s.category] = []; grouped[s.category].push(s.name); });
      const lines = Object.entries(grouped).map(([cat, names]) => `- **${cat}**: ${names.join(", ")}`);
      return `**${svcs.length} third-party services detected across ${Object.keys(grouped).length} categories:**\n\n${lines.join("\n")}\n\nEach third-party service is a trust boundary and potential supply-chain risk.`;
    }
    return "No third-party services detected on this page.";
  }

  return [
    `I can answer specific questions about this scan of **${scan.targetUrl}**.`,
    `\n**Summary:** Score **${scan.score}/100** · ${summarizeCounts(scan)}`,
    `**Pages crawled:** ${scan.meta?.pagesCrawled || 0} · **Endpoints:** ${scan.meta?.endpointCount || scan.meta?.endpoints?.length || 0}`,
    `**Tech:** ${(scan.meta?.tech || []).map((t) => t.name).join(", ") || "none detected"}`,
    `\nTry asking:`,
    `- "What should I fix first?"`,
    `- "Explain my VibeCheck score"`,
    `- "What CVEs affect my site?"`,
    `- "Are my headers secure?"`,
    `- "What third-party services are running?"`,
  ].join("\n");
}

function summarizeCounts(scan) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of scan.findings || []) if (counts[f.severity] != null) counts[f.severity]++;
  return `${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low, ${counts.info} info`;
}

export async function ensureAiAnalysis(scanId) {
  const scan = getScan(scanId);
  if (!scan) return null;
  if (scan.ai?.summary && scan.ai?.vibe?.assessment) return scan.ai;
  try {
    const [analysis, vibe] = await Promise.all([analyzeFindings(scan), analyzeVibe(scan)]);
    const ai = { ...analysis, vibe, generatedAt: new Date().toISOString() };
    updateScan(scanId, { ai });
    return ai;
  } catch (err) {
    console.error(`[ai] analysis error for ${scanId}, producing guaranteed local report:`, err.message);
    const local = localAnalysis(scan);
    const vibeData = detectVibeCode(scan.meta || {});
    const vibe = { ...vibeData, ...localVibe(scan, vibeData), provider: "local" };
    const ai = { ...local, vibe, generatedAt: new Date().toISOString() };
    updateScan(scanId, { ai });
    return ai;
  }
}

// ---------- Reversiy: the SiteAudit AI agent (floating security pet) ----------

const REVERSIY_SYSTEM = [
  "You are Reversiy, a friendly, slightly playful AI security companion that lives on the SiteAudit website.",
  "You are concise, warm and practical. You talk like a knowledgeable friend, and you can also be a security engineer.",
  "You know about the current scan if scan context is provided — answer questions about the site's security, findings, score and fixes using ONLY that data. Never invent vulnerabilities or CVEs.",
  "If no scan context is given, you can still answer general questions about web security, how SiteAudit works, verification, VibeCheck, or anything the user asks — but never invent CVEs or vulnerabilities.",
  "Keep answers to 2-5 sentences unless the user asks for detail. Prefer short, punchy replies with an occasional emoji or two.",
  "If asked for a fix, give concrete steps or code/config snippets.",
].join(" ");

export function localAgentReply(question) {
  const q = question.toLowerCase();
  if (/hi|hello|hey|yo|sup/.test(q)) {
    return "Hey there! 👋 I'm Reversiy — your security sidekick. Paste a URL and hit RUN SCAN, then I'll help you understand exactly what's wrong and how to fix it. Ask me anything!";
  }
  if (/what are you|who are you|your name/.test(q)) {
    return "I'm Reversiy 🛰️ — SiteAudit's resident AI agent. I live on every page of this site, watching your scans, explaining findings in plain English, and turning them into fixes.";
  }
  if (/score|how bad|risk/.test(q)) {
    return "Your scan score lives in the REPORT panel at the top of the scan page. Scores below 50 need urgent action, 50–79 means fix the medium/high items, 80+ is in good shape. Open a scan and I'll walk you through its numbers!";
  }
  if (/how.*scan|does.*work|how to use/.test(q)) {
    return "It's simple: paste a URL → RUN SCAN (passive, no signup) → read the report → VERIFY ownership with a token file to unlock the FULL CHECK. On the scan page you'll also get AI risk reports, VibeCheck, video fix guides and me 😄";
  }
  if (/verif/.test(q)) {
    return "Ownership verification proves the site is yours before the deeper Full Check unlocks. Easiest method: TOKEN FILE — download it, drop it in your site's public/ folder (Vercel) and redeploy, then we auto-check it every 8 seconds.";
  }
  if (/vibe|trustworth|vibecode/.test(q)) {
    return "VibeCheck scores 0–100 how 'vibe-coded' a site looks — boilerplate scaffolds, placeholder copy, free proxies as backend, hardcoded seed data. High score = looks untrustworthy. My fix guides show you videos for exactly those issues!";
  }
  if (/thank/.test(q)) {
    return "Anytime! 🎉 That's what I'm here for. If you hit a wall, hit the ▶ WATCH TUTORIAL button on any finding or ask me again.";
  }
  return "I can help with: reading a scan (findings, score, VibeCheck), how SiteAudit works, ownership verification, and general web-security questions. Open a scan and ask me 'what should I fix first?', or just ask anything! 🤖";
}

export async function agentReply({ message, history = [], context = null }) {
  const system = context ? `${REVERSIY_SYSTEM}\n\nCurrent scan context (JSON):\n${JSON.stringify(context).slice(0, 4000)}` : REVERSIY_SYSTEM;
  const convo = history
    .slice(-8)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  const user = `${convo ? `Conversation so far:\n${convo}\n\n` : ""}User: ${message}\n\nReversiy:`;
  if (!aiEnabled()) return { reply: localAgentReply(message), provider: "local" };
  try {
    const { text, provider } = await callLLM(system, user);
    const reply = text.trim();
    // Filter junk/joke responses from free AI services
    if (isJunkResponse(reply)) {
      return { reply: localAgentReply(message), provider: `local (filtered ${provider})` };
    }
    return { reply, provider };
  } catch (err) {
    return { reply: localAgentReply(message), provider: `local (${err.message})` };
  }
}

function isJunkResponse(text) {
  if (!text || text.length < 10) return true;
  const lower = text.toLowerCase();
  const junkPatterns = [
    "never gonna give you up",
    "rick roll",
    "rick astley",
    "i'm sorry, i cannot",
    "i cannot fulfill",
    "as an ai language model",
    "i am not able to",
    "i'm unable to",
    "as an ai,",
    "i apologize, but",
  ];
  for (const p of junkPatterns) {
    if (lower.includes(p)) return true;
  }
  // Reject responses that are just lyrics/song snippets (very repetitive text)
  const words = lower.split(/\s+/);
  if (words.length > 5 && words.length < 30) {
    const uniqueWords = new Set(words);
    if (uniqueWords.size < words.length * 0.4) return true;
  }
  return false;
}

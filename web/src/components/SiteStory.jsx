import { useState, useEffect, useRef, useMemo } from "react";

function detectSiteType(tech) {
  const names = (tech || []).map((t) => (t.name || "").toLowerCase());
  const joined = names.join(" ");
  if (joined.includes("wordpress")) return "WordPress blog";
  if (joined.includes("shopify")) return "Shopify store";
  if (joined.includes("next.js") || joined.includes("nextjs")) return "Next.js app";
  if (joined.includes("react") || joined.includes("create react app")) return "React SPA";
  if (joined.includes("vue")) return "Vue.js app";
  if (joined.includes("angular")) return "Angular app";
  if (joined.includes("laravel")) return "Laravel app";
  if (joined.includes("django")) return "Django app";
  if (joined.includes("express")) return "Express.js app";
  if (joined.includes("gatsby")) return "Gatsby site";
  return "website";
}

function getLmSettings() {
  try {
    const raw = localStorage.getItem("sa_settings");
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s?.lmStudio?.enabled && s.lmStudio.baseUrl) {
      return { baseUrl: s.lmStudio.baseUrl.replace(/\/+$/, ""), model: s.lmStudio.model || "local-model" };
    }
  } catch { /* ignore */ }
  return null;
}

async function callLmStudio(prompt) {
  const lm = getLmSettings();
  if (!lm) return null;
  const res = await fetch(`${lm.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: lm.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7, max_tokens: 200,
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const msg = data?.choices?.[0]?.message || {};
  return msg.content || msg.reasoning_content || null;
}

function buildLocalNarrative(scan) {
  const tech = scan?.meta?.tech || [];
  const services = scan?.meta?.services || [];
  const counts = scan?.findingsSummary || {};
  const critical = counts.critical || 0, high = counts.high || 0, medium = counts.medium || 0, low = counts.low || 0;
  const totalFindings = (scan?.findings || []).length;
  const score = scan?.score ?? 0;
  const pagesCrawled = scan?.meta?.pagesCrawled ?? 0;
  const endpointCount = scan?.meta?.endpointCount ?? (scan?.meta?.endpoints || []).length ?? 0;
  const scanDate = scan?.completedAt ? new Date(scan.completedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "recently";
  const siteType = detectSiteType(tech);
  const hosting = tech.map(t => t.name).join(" + ") || "unknown stack";
  const techList = tech.length > 0 ? tech.map((t) => t.name + (t.version ? " " + t.version : "")).join(", ") : "no detected tech";
  const { usesHttps: https } = { usesHttps: (scan?.targetUrl || "").startsWith("https") };
  const tlsVer = scan?.meta?.hostInfo?.tls?.protocol || "unknown";

  let scoreNote = totalFindings > 0
    ? (score < 50 ? "needs urgent attention" : score < 80 ? "has room for improvement" : "is in solid shape")
    : "has a clean security record";

  return `Scanned on ${scanDate}. A ${siteType} running on ${hosting}. Security score: ${score}/100 — ${scoreNote}. Found ${totalFindings} issues (${critical} critical, ${high} high, ${medium} medium, ${low} low) across ${pagesCrawled} pages and ${endpointCount} endpoints. Uses ${techList}. ${https ? "HTTPS" : "HTTP"} / TLS ${tlsVer}.`;
}

export default function SiteStory({ scan }) {
  const [displayedText, setDisplayedText] = useState("");
  const [aiStory, setAiStory] = useState("");
  const [typingDone, setTypingDone] = useState(false);
  const [badge, setBadge] = useState("");
  const charIndex = useRef(0);
  const timerRef = useRef(null);

  const localNarrative = useMemo(() => buildLocalNarrative(scan), [scan]);

  // Typewriter for local narrative
  useEffect(() => {
    charIndex.current = 0;
    setDisplayedText("");
    setTypingDone(false);
    setAiStory("");
    setBadge("");

    const chars = localNarrative.split("");
    function typeChar() {
      if (charIndex.current < chars.length) {
        setDisplayedText((prev) => prev + chars[charIndex.current]);
        charIndex.current++;
        timerRef.current = setTimeout(typeChar, 10);
      } else {
        setTypingDone(true);
      }
    }
    timerRef.current = setTimeout(typeChar, 200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [localNarrative]);

  // After typing done: try LM Studio → Pollinations → nothing
  useEffect(() => {
    if (!typingDone) return;
    const prompt = `Write 1-2 plain English sentences summarizing: ${localNarrative}`;

    const tryAI = async () => {
      // 1. Try LM Studio first (local, private)
      try {
        const lmReply = await callLmStudio(prompt);
        if (lmReply && lmReply.length > 15) {
          setAiStory(lmReply);
          setBadge("🧠 LM Studio");
          return;
        }
      } catch { /* LM Studio not available */ }

      // 2. Try Pollinations (free cloud)
      try {
        const r = await fetch("https://text.pollinations.ai/", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: [{ role: "user", content: prompt }], model: "openai" }),
          signal: AbortSignal.timeout(12000),
        });
        const text = await r.text();
        if (text && text.trim().length > 15 && !text.toLowerCase().includes("error")) {
          setAiStory(text.trim());
          setBadge("✨ Pollinations AI");
          return;
        }
      } catch { /* Pollinations down */ }

      // 3. No AI available — local narrative is already showing, that's fine
    };

    tryAI();
  }, [typingDone, localNarrative]);

  return (
    <div className="console mt">
      <div className="console-title">
        <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
        <span>AI SITE STORY</span>
        {badge && (
          <span style={{ marginLeft: 10, fontSize: 10, color: badge.includes("LM") ? "#a855f7" : "#ffd700", background: badge.includes("LM") ? "rgba(168,85,247,0.1)" : "rgba(255,215,0,0.1)", padding: "2px 8px", borderRadius: 10, border: badge.includes("LM") ? "1px solid rgba(168,85,247,0.3)" : "1px solid rgba(255,215,0,0.3)" }}>
            {badge}
          </span>
        )}
      </div>
      <div className="console-body">
        <div style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.85)", whiteSpace: "pre-wrap", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
          {displayedText}
          {!typingDone && <span className="cursor" />}
        </div>
        {aiStory && (
          <div style={{ marginTop: 14, padding: "12px 14px", background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 6, fontSize: 13, lineHeight: 1.7, color: "rgba(255,255,255,0.9)", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
            <div style={{ fontSize: 10, color: "#a855f7", marginBottom: 6, fontWeight: 600 }}>AI NARRATIVE</div>
            {aiStory}
          </div>
        )}
        <div style={{ marginTop: 10, fontSize: 10, color: "rgba(255,255,255,0.2)", textAlign: "right", letterSpacing: 1 }}>
          Generated by SiteAudit AI
        </div>
      </div>
    </div>
  );
}
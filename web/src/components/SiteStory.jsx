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
  if (joined.includes("hugo") || joined.includes("jekyll")) return "static site";
  return "generic website";
}

function detectHosting(tech, services) {
  const names = [
    ...(tech || []).map((t) => (t.name || "").toLowerCase()),
    ...(services || []).map((s) => (s.name || "").toLowerCase()),
  ];
  const joined = names.join(" ");
  if (joined.includes("vercel")) return "Vercel";
  if (joined.includes("netlify")) return "Netlify";
  if (joined.includes("cloudflare")) return "Cloudflare";
  if (joined.includes("aws")) return "AWS";
  if (joined.includes("heroku")) return "Heroku";
  if (joined.includes("render")) return "Render";
  if (joined.includes("nginx")) return "Nginx";
  if (joined.includes("apache")) return "Apache";
  if (joined.includes("github pages") || joined.includes("github-pages")) return "GitHub Pages";
  return "unknown hosting";
}

function detectTls(scan) {
  if (!scan?.meta) return { usesHttps: false, tlsInfo: "unknown" };
  const url = scan.targetUrl || "";
  const usesHttps = url.startsWith("https://");
  const tls = scan.meta.hostInfo?.tls;
  if (!tls || !tls.version) return { usesHttps, tlsInfo: usesHttps ? "TLS version unknown" : "no TLS" };
  return { usesHttps, tlsInfo: `TLS ${tls.version}` };
}

function countSecurityHeaders(scan) {
  const headers = scan?.meta?.securityHeaders || [];
  const required = [
    "Content-Security-Policy",
    "X-Frame-Options",
    "X-Content-Type-Options",
    "Strict-Transport-Security",
    "Referrer-Policy",
    "Permissions-Policy",
    "X-XSS-Protection",
    "Cross-Origin-Resource-Policy",
  ];
  const present = headers.filter((h) => {
    const name = (h.name || h || "").toLowerCase();
    return required.some((r) => name === r.toLowerCase());
  }).length;
  return { present, total: required.length };
}

function buildLocalNarrative(scan) {
  const tech = scan?.meta?.tech || [];
  const services = scan?.meta?.services || [];
  const counts = scan?.findingsSummary || {};
  const critical = counts.critical || 0;
  const high = counts.high || 0;
  const medium = counts.medium || 0;
  const low = counts.low || 0;
  const totalFindings = (scan?.findings || []).length;
  const score = scan?.score ?? 0;
  const pagesCrawled = scan?.meta?.pagesCrawled ?? 0;
  const endpointCount = scan?.meta?.endpointCount ?? (scan?.meta?.endpoints || []).length ?? 0;
  const scanDate = scan?.completedAt
    ? new Date(scan.completedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "recently";

  const siteType = detectSiteType(tech);
  const hosting = detectHosting(tech, services);
  const { usesHttps, tlsInfo } = detectTls(scan);
  const headers = countSecurityHeaders(scan);

  const techList = tech.length > 0
    ? tech.map((t) => t.name + (t.version ? " " + t.version : "")).join(", ")
    : "no specific technologies";

  const serviceGroups = {};
  for (const s of services) {
    const cat = s.category || "Other";
    if (!serviceGroups[cat]) serviceGroups[cat] = [];
    serviceGroups[cat].push(s.name);
  }
  const serviceDesc = Object.entries(serviceGroups).length > 0
    ? Object.entries(serviceGroups)
        .map(([cat, names]) => `${cat} (${names.join(", ")})`)
        .join("; ")
    : "none detected";

  let scoreNote = "";
  if (totalFindings > 0) {
    if (score < 50) {
      scoreNote = "This needs urgent attention — the critical and high findings expose the site to real attacks.";
    } else if (score < 80) {
      scoreNote = "This is fixable — addressing the high and medium items will significantly improve security.";
    } else {
      scoreNote = "Good baseline security. The remaining findings are best-practice improvements.";
    }
  }

  const httpsVerb = usesHttps ? "uses" : "doesn't use";

  let narrative = `A ${siteType} hosted on ${hosting}, scanned ${scanDate} — scored ${score}/100. `;

  if (totalFindings > 0) {
    narrative += `${critical} critical, ${high} high, ${medium} medium, ${low} low findings. ${scoreNote} `;
  } else {
    narrative += "No findings — clean scan. ";
  }

  narrative += `Tech stack: ${techList}. ${httpsVerb} HTTPS / ${tlsInfo}. ${headers.present}/${headers.total} security headers missing.`;

  return narrative;
}

export default function SiteStory({ scan }) {
  const [aiStory, setAiStory] = useState("");
  const [displayedText, setDisplayedText] = useState("");
  const [typingDone, setTypingDone] = useState(false);
  const [showAiBadge, setShowAiBadge] = useState(false);
  const charIndex = useRef(0);
  const timerRef = useRef(null);

  const localNarrative = useMemo(() => buildLocalNarrative(scan), [scan]);

  useEffect(() => {
    charIndex.current = 0;
    setDisplayedText("");
    setTypingDone(false);
    setAiStory("");
    setShowAiBadge(false);

    const chars = localNarrative.split("");
    const speed = 12;

    function typeChar() {
      if (charIndex.current < chars.length) {
        setDisplayedText((prev) => prev + chars[charIndex.current]);
        charIndex.current++;
        timerRef.current = setTimeout(typeChar, speed);
      } else {
        setTypingDone(true);
      }
    }

    timerRef.current = setTimeout(typeChar, 200);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [localNarrative]);

  useEffect(() => {
    if (!typingDone) return;

    const summary = scan?.findingsSummary
      ? `Critical:${scan.findingsSummary.critical || 0} High:${scan.findingsSummary.high || 0} Medium:${scan.findingsSummary.medium || 0} Low:${scan.findingsSummary.low || 0}`
      : "No findings";
    const tech = (scan?.meta?.tech || []).map((t) => t.name + (t.version ? " " + t.version : "")).join(", ") || "unknown";
    const services = (scan?.meta?.services || []).map((s) => `${s.name} (${s.category || "other"})`).join(", ") || "none";

    const controller = new AbortController();
    fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: `2-3 sentence security summary: ${scan.targetUrl} scored ${scan.score}/100. ${summary}. Tech: ${tech}. Services: ${services}.`,
          },
        ],
        model: "openai",
      }),
      signal: AbortSignal.timeout(15000),
    })
      .then((r) => r.text())
      .then((story) => {
        if (story && story.trim() && !story.toLowerCase().includes("error")) {
          setAiStory(story.trim());
          setShowAiBadge(true);
        }
      })
      .catch(() => {});

    return () => controller.abort();
  }, [typingDone, scan]);

  return (
    <div className="console mt">
      <div className="console-title">
        <span className="traffic">
          <span className="t g" />
          <span className="t a" />
          <span className="t r" />
        </span>
        <span>AI SITE STORY</span>
        {showAiBadge && (
          <span
            style={{
              marginLeft: 10,
              fontSize: 10,
              color: "#ffd700",
              background: "rgba(255,215,0,0.1)",
              padding: "2px 8px",
              borderRadius: 10,
              border: "1px solid rgba(255,215,0,0.3)",
            }}
          >
            ✨ AI-enhanced
          </span>
        )}
      </div>
      <div className="console-body">
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: "rgba(255,255,255,0.85)",
            whiteSpace: "pre-wrap",
            fontFamily: "'Segoe UI', system-ui, sans-serif",
          }}
        >
          {displayedText}
          {!typingDone && <span className="cursor" />}
        </div>
        {aiStory && (
          <div
            style={{
              marginTop: 16,
              padding: "14px 16px",
              background: "rgba(255,215,0,0.06)",
              border: "1px solid rgba(255,215,0,0.2)",
              borderRadius: 6,
              fontSize: 14,
              lineHeight: 1.7,
              color: "rgba(255,255,255,0.9)",
              fontFamily: "'Segoe UI', system-ui, sans-serif",
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: 1.5,
                color: "#ffd700",
                marginBottom: 8,
                fontWeight: 600,
              }}
            >
              AI-ENHANCED SUMMARY
            </div>
            {aiStory}
          </div>
        )}
        <div
          style={{
            marginTop: 12,
            fontSize: 10,
            color: "rgba(255,255,255,0.25)",
            textAlign: "right",
            letterSpacing: 1,
          }}
        >
          Generated by SiteAudit AI
        </div>
      </div>
    </div>
  );
}

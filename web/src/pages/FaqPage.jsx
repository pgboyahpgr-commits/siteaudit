import { Link } from "react-router-dom";

const SECTIONS = [
  {
    title: "ABOUT SITEAUDIT",
    faqs: [
      {
        q: "What is SiteAudit?",
        a: "SiteAudit is a free, AI-powered security, privacy & trust agent for any website you own or are authorized to test. Paste a URL and it reverse-engineers the site — every page, JavaScript file, endpoint and secret — then explains what's broken in plain English, tells you exactly how to fix it, and scores how trustworthy the site looks.",
      },
      {
        q: "What problem does it solve?",
        a: "Modern apps are often built in hours with AI assistance. The result is a trust crisis: sites shipped with exposed .env files, hardcoded API keys, default templates, placeholder copy and missing security headers — and the owners don't know. Professional pentests cost thousands; free scanners output jargon nobody can act on; and nothing checks whether an app looks like an untrustworthy, hastily-generated prototype. SiteAudit fixes all three.",
      },
      {
        q: "Is it really free?",
        a: "Yes. It's built entirely on free infrastructure and free AI tiers, with a built-in analysis engine that works even with no AI key configured. No signup is required to run a scan.",
      },
      {
        q: "Is this an AI product or a real scanner?",
        a: "Both. The scanner does real work: crawling, endpoint discovery, secret and exposure detection, header/TLS/CORS analysis, CVE matching. Then AI (Gemini → OpenAI → Claude, with a local fallback) interprets the results into a plain-language risk report, a prioritized fix plan, and a VibeCheck narrative. If no AI provider is available, the local engine still produces the full report.",
      },
    ],
  },
  {
    title: "SCANNING & RESULTS",
    faqs: [
      {
        q: "What exactly does a scan find?",
        a: "Exposed files (.git, .env, SQL dumps, backups), hardcoded secrets and API keys, reverse-engineered API endpoints (with status and content-type), directory listings, source maps, missing or weak security headers, cookie issues, CORS misconfigurations, TLS problems, known CVEs matched to your tech versions, mixed content, and more. Every finding shows evidence, a plain-language explanation, and a fix.",
      },
      {
        q: "The scan says a lot of paths return the same content — why?",
        a: "That's an SPA (single-page app) catch-all: the server serves index.html for every route (common on Vercel/Netlify with a rewrite rule). It's flagged by VibeCheck as a scaffolded demo. For real detection of hidden routes, use the Full Check on a site you've verified you own.",
      },
      {
        q: "My score is low / high — what does the number mean?",
        a: "The score (0–100) weights findings by severity: critical findings drop it fastest. A low score means real, fixable problems — the AI Fix Plan lists them in order. A high score means the basics are in place; keep fixing the medium/low items.",
      },
      {
        q: "Can it test my login-protected areas?",
        a: "Passive scans only see what's public. After you verify ownership, the Full Check runs deeper active tests. Authenticated testing needs a test account and is on the roadmap.",
      },
    ],
  },
  {
    title: "VIBECHECK",
    faqs: [
      {
        q: "What is the VibeCheck score?",
        a: "It's a 0–100 measure of how much a site looks like a low-effort, AI-generated 'vibe-coded' app. It looks for tell-tale signals: stock Vite/React/Next scaffolds, placeholder copy, dead '# ' links, free third-party proxies used as a backend, hardcoded seed/mock data, all routes serving one SPA shell, debug code left in, and 'powered by' template markers.",
      },
      {
        q: "Why does VibeCheck matter for security?",
        a: "Perception is trust. Users hesitate to sign up or enter payment details on a site that looks unfinished or template-y. VibeCheck turns that gut feeling into concrete, fixable evidence — and the AI tells you exactly what to change to look production-grade.",
      },
      {
        q: "My site scored higher than I expected. What should I do?",
        a: "Open the detected signals list, then apply the AI recommendations. Remove boilerplate assets and placeholder copy, add a real robots.txt and security.txt, replace free proxy endpoints with your own backend, and add custom branding. Re-scan after each change to watch the score drop.",
      },
    ],
  },
  {
    title: "OWNERSHIP VERIFICATION",
    faqs: [
      {
        q: "Why do I have to verify ownership?",
        a: "The Full Check runs active tests that can be disruptive. Scanning a site you don't own or lack permission to test is illegal in most jurisdictions, so SiteAudit proves you control the site first — the same model Google Search Console uses.",
      },
      {
        q: "How do I verify with a file?",
        a: "Click 'VERIFY NOW', choose TOKEN FILE, generate a token, then download the file and upload it to your site's public root — Vercel: put it in the public/ folder and redeploy; Netlify/Pages: the publish dir. Then we read it back from your site (auto-checking every 8 seconds) and unlock the Full Check.",
      },
      {
        q: "Verification says my site is serving index.html — what now?",
        a: "Your host is serving its app page for every path, so the token file isn't being delivered. Add the file inside public/ (Vercel) or your static dir and redeploy, or switch to the HTML Meta Tag method — add one <meta> line to your homepage <head> and redeploy.",
      },
      {
        q: "Which methods work on *.vercel.app?",
        a: "Token file, HTML meta tag, and HTTP header all work without a custom domain. DNS TXT / CNAME and email need your own domain.",
      },
      {
        q: "Is my token safe?",
        a: "Yes. Tokens are random, expire in 60 minutes, and are stored only as a SHA-256 hash. We never accept a screenshot or self-report — we read the token back from your site itself.",
      },
    ],
  },
  {
    title: "AI & PRIVACY",
    faqs: [
      {
        q: "Which AI models power SiteAudit?",
        a: "Google Gemini by default, falling back to OpenAI, then Anthropic Claude, then a built-in local analysis engine. The chain is automatic, so reports are always produced even if a provider is down or rate-limited.",
      },
      {
        q: "Are my scan results sent to an AI?",
        a: "Only the structured scan summary (finding titles, severities, endpoints, tech stack) is sent — never secrets you'd find in raw source. And it only happens for scans you run. If no AI provider is configured on the server, nothing leaves it.",
      },
      {
        q: "Do you store my data?",
        a: "Scan results are stored in your own account so you can re-open reports. Passwords are bcrypt-hashed, API keys live only in server environment variables, and every scan records a consent acknowledgement with timestamp.",
      },
      {
        q: "Why does the advisor only answer from my scan data?",
        a: "By design. The AI Security Advisor is grounded in your scan's findings so it doesn't hallucinate vulnerabilities or CVEs. Ask it things like 'what should I fix first?' or 'explain the critical issues'.",
      },
    ],
  },
  {
    title: "COMMON ISSUES & FIXES",
    faqs: [
      {
        q: "The scan didn't find my page / site has many routes but one HTML file.",
        a: "It's an SPA. The crawler fetches rendered pages over HTTP; if your app renders via JavaScript only, deep routes won't be reachable without a headless browser (coming soon). Full Check adds deeper probing on verified sites.",
      },
      {
        q: "Scan failed with 'no pages fetched'.",
        a: "The site was unreachable, blocked the scanner's user-agent, or the URL was wrong. Check the URL loads in a browser, and that no WAF/bot protection blocks non-browser requests.",
      },
      {
        q: "How do I add security headers on Vercel?",
        a: "Create vercel.json in your project root with a headers block setting X-Frame-Options, Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy, and Content-Security-Policy. SiteAudit's findings include copy-paste configs.",
      },
      {
        q: "I have an AI API key — how do I enable the real AI?",
        a: "Set GEMINI_API_KEY (free at aistudio.google.com), OPENAI_API_KEY, or ANTHROPIC_API_KEY in the server's environment (.env). Keys are read server-side only. Without them the local engine still produces full reports.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <>
      <div className="section-head">
        <div>
          <h2>FAQ</h2>
          <span className="small dim">Everything about SiteAudit — what it is, how scanning and verification work, and the AI.</span>
        </div>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.title} className="console mt">
          <div className="console-title">
            <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
            <span>{section.title}</span>
          </div>
          <div className="console-body">
            {section.faqs.map((f, i) => (
              <details key={i} className="faq-item">
                <summary>
                  <span className="faq-q">{f.q}</span>
                  <span className="faq-chev">▶</span>
                </summary>
                <div className="faq-a">{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      ))}

      <div className="center mt" style={{ padding: 20 }}>
        <Link to="/" className="btn btn-ghost btn-sm">▸ RUN YOUR FIRST SCAN</Link>
      </div>
    </>
  );
}

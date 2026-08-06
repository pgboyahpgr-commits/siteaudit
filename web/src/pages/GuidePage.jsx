const SECTIONS = [
  {
    id: "scanner",
    emoji: "\uD83C\uDF10",
    title: "Scanner",
    summary: "Start here. The scanner is the heart of SiteAudit.",
    body: (
      <>
        <p className="small" style={{ lineHeight: 1.75 }}>
          Paste any URL into the scanner console. Set your scan depth (how many pages to crawl), choose
          <strong className="accent"> Passive</strong> (safe, no intrusive tests) or{" "}
          <strong className="magenta">Full Check</strong> (active tests after verification), then tick the
          consent checkbox confirming you own or have permission to test the site. Hit <strong>RUN SCAN</strong>{" "}
          and watch the terminal fill with real-time crawl progress.
        </p>
        <p className="small dim mt">
          The consent checkbox is legally required. Your IP and a timestamp are logged with every scan
          as proof you accepted responsibility. Never scan a site you don&rsquo;t own or have written
          permission to test.
        </p>
      </>
    ),
  },
  {
    id: "results",
    emoji: "\uD83D\uDCCA",
    title: "Scan Results",
    summary: "Everything the scanner found, organized and actionable.",
    body: (
      <>
        <p className="small" style={{ lineHeight: 1.75 }}>
          Once a scan completes, you get a full security report. At the top: a{" "}
          <strong className="accent">Score Ring</strong> (0-100, color-coded from red to green),{" "}
          <strong className="cyan">tech badges</strong> showing detected frameworks and versions, and a{" "}
          <strong>stat grid</strong> breaking findings down by severity (critical/high/medium/low/info).
        </p>
        <p className="small mt" style={{ lineHeight: 1.75 }}>
          Below that, every finding appears as an <strong>expandable card</strong>. Click to see evidence,
          a plain-language explanation of what the issue means, and a <strong>fix box</strong> with exact
          steps to resolve it. Use the severity filter chips to focus on what matters most.
        </p>
        <p className="small dim mt">
          You can download results as JSON, CSV, or a standalone HTML report. There&rsquo;s also
          a shareable report link you can send to your team.
        </p>
      </>
    ),
  },
  {
    id: "verify",
    emoji: "\uD83D\uDD12",
    title: "Ownership Verification",
    summary: "Prove you own the site to unlock advanced features.",
    body: (
      <>
        <p className="small" style={{ lineHeight: 1.75 }}>
          The <strong className="magenta">Full Check</strong> runs active tests (injection probes, deep enumeration,
          authenticated scanning) that can be disruptive. To prevent abuse, SiteAudit requires you to prove you control
          the site first &mdash; just like Google Search Console.
        </p>
        <p className="small mt" style={{ lineHeight: 1.75 }}>
          Choose from five verification methods:
        </p>
        <ul className="small" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
          <li><strong className="accent">Token File:</strong> Upload a generated file to your site&rsquo;s public root</li>
          <li><strong className="accent">HTML Meta Tag:</strong> Add a <code className="cyan">meta</code> tag to your homepage</li>
          <li><strong className="accent">HTTP Header:</strong> Set a custom response header on your server</li>
          <li><strong className="accent">DNS TXT/CNAME:</strong> Add a DNS record for your domain</li>
          <li><strong className="accent">Email:</strong> Verify via your domain&rsquo;s WHOIS/admin email</li>
        </ul>
        <p className="small dim mt">
          Tokens are random, expire in 60 minutes, and are validated by fetching them back from your live site.
          Once verified, Full Check unlocks permanently for that domain.
        </p>
      </>
    ),
  },
  {
    id: "ai",
    emoji: "\uD83E\uDD16",
    title: "AI Analysis",
    summary: "Machine intelligence that explains findings in plain English.",
    body: (
      <>
        <p className="small" style={{ lineHeight: 1.75 }}>
          After a scan, SiteAudit sends the structured findings to an <strong>AI model chain</strong>{" "}
          (Gemini → OpenAI → Claude, with a local fallback). The AI produces three things:
        </p>
        <ul className="small" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
          <li>
            <strong className="red">AI Risk Report:</strong> A prioritized summary of vulnerabilities with an overall
            risk rating (low/medium/high/critical). Suggests which issues to fix first.
          </li>
          <li>
            <strong className="amber">VibeCheck:</strong> A trust score (0-100) that measures whether a site looks like
            a hastily-built AI-generated prototype. Detects scaffolded templates, placeholder copy, dead links,
            free proxy backends, and boilerplate branding.
          </li>
          <li>
            <strong className="accent">AI Fix Plan:</strong> A step-by-step action plan ordered from most critical to
            cosmetic. Each step explains <em>what</em> to do, <em>why</em> it matters, and how to verify it&rsquo;s fixed.
          </li>
        </ul>
        <p className="small dim mt">
          If no external AI key is configured, the built-in local engine still produces full reports &mdash;
          they&rsquo;re just less conversational. Configure your own keys on the Settings page for the best experience.
        </p>
      </>
    ),
  },
  {
    id: "vision",
    emoji: "\uD83D\uDD2C",
    title: "Vision Panel",
    summary: "Screenshot-based UI/UX trust audit.",
    body: (
      <>
        <p className="small" style={{ lineHeight: 1.75 }}>
          The <strong className="cyan">Vision Panel</strong> captures a screenshot of your site and analyzes it for
          trust signals a visitor would notice: broken layouts, missing branding, placeholder content,
          unprofessional typography, and missing trust indicators (SSL badges, contact pages, privacy links).
        </p>
        <p className="small mt" style={{ lineHeight: 1.75 }}>
          This is part of the VibeCheck system &mdash; a site that looks trustworthy <em>is</em> more trustworthy to
          end users. The Vision Panel gives you a checklist of UI/UX improvements that increase visitor confidence.
        </p>
      </>
    ),
  },
  {
    id: "videos",
    emoji: "\uD83C\uDFA5",
    title: "Video Guides",
    summary: "YouTube fix tutorials matched to your specific findings.",
    body: (
      <>
        <p className="small" style={{ lineHeight: 1.75 }}>
          For every finding category, SiteAudit searches YouTube for <strong>relevant fix tutorials</strong>{" "}
          and displays them in a clean card layout. Watch someone else fix the exact same issue on the same
          stack you&rsquo;re using.
        </p>
        <p className="small mt" style={{ lineHeight: 1.75 }}>
          Cards show the video thumbnail, title, author, and duration. Click a card to open an embedded
          player or watch on YouTube. This is especially useful for configuration-heavy fixes like
          security headers, CORS policies, and CSP rules.
        </p>
      </>
    ),
  },
  {
    id: "host",
    emoji: "\uD83D\uDDA5\uFE0F",
    title: "Host Intelligence",
    summary: "Deep dive into the server infrastructure behind your site.",
    body: (
      <>
        <p className="small" style={{ lineHeight: 1.75 }}>
          The <strong className="cyan">Host Intelligence</strong> panel reveals everything about the server
          hosting your site:
        </p>
        <ul className="small" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
          <li><strong>DNS Records:</strong> A, AAAA, CNAME, MX, TXT, NS, SOA records</li>
          <li><strong>Open Ports:</strong> Scans common ports (80, 443, 22, 21, 8080, 8443, etc.) and reports
            which are open or filtered</li>
          <li><strong>TLS Certificate:</strong> Issuer, expiry date, SANs, protocol versions, cipher
            suite analysis, and certificate chain validation</li>
          <li><strong>IP Geolocation:</strong> Hosting provider, country, and ASN information</li>
        </ul>
        <p className="small dim mt">
          This panel helps you spot misconfigured DNS, expired certificates, unnecessarily open ports,
          and other infrastructure-level vulnerabilities that a code-level scan would miss.
        </p>
      </>
    ),
  },
  {
    id: "detector",
    emoji: "\uD83D\uDD0D",
    title: "AI Image Detector",
    summary: "Client-side forensic analysis of any image.",
    body: (
      <>
        <p className="small" style={{ lineHeight: 1.75 }}>
          The <strong className="magenta">AI Image Detector</strong> is a fully client-side tool that
          analyzes any image for signs of AI generation. It runs five independent forensic engines:
        </p>
        <ul className="small" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
          <li><strong>C2PA Provenance Check:</strong> Scans for digital content provenance manifests and AI generator claims</li>
          <li><strong>EXIF &amp; Camera Metadata:</strong> Looks for camera data (or its suspicious absence) and AI tool signatures</li>
          <li><strong>DCT Frequency Analysis:</strong> Detects SynthID watermarks and Stable Diffusion invisible watermarks in the frequency domain</li>
          <li><strong>Error Level Analysis:</strong> Forensic ELA that identifies edit regions through recompression comparison</li>
          <li><strong>ML Classifier:</strong> Runs <code className="cyan">ai-source-detector-ONNX</code> (WebGPU q8 model) for deep learning classification</li>
        </ul>
        <p className="small dim mt">
          Nothing leaves your browser. All analysis happens locally. Results include a weighted consensus verdict
          with a percentage confidence score and a breakdown from each engine.
        </p>
      </>
    ),
  },
  {
    id: "settings",
    emoji: "\u2699\uFE0F",
    title: "Settings",
    summary: "Bring your own AI keys or connect a local model.",
    body: (
      <>
        <p className="small" style={{ lineHeight: 1.75 }}>
          The <strong className="accent">Settings</strong> page lets you configure your own AI API keys for
          improved analysis quality. Supported providers:
        </p>
        <ul className="small" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Google Gemini (free tier available at aistudio.google.com)</li>
          <li>OpenAI (GPT-4, GPT-3.5)</li>
          <li>Anthropic Claude</li>
          <li>xAI (Grok)</li>
          <li>Mistral</li>
          <li>Completions AI</li>
          <li>NVIDIA NIM</li>
        </ul>
        <p className="small mt" style={{ lineHeight: 1.75 }}>
          Each key has a <strong>TEST</strong> button that verifies the connection works. Keys are stored
          in your browser&rsquo;s localStorage (never on our server) unless you explicitly push them to the
          backend with the <strong>SAVE &amp; APPLY TO BACKEND</strong> button.
        </p>
        <p className="small mt" style={{ lineHeight: 1.75 }}>
          You can also enable <strong className="cyan">LM Studio</strong> to use a locally-running LLM
          (e.g., Llama 3.2, Mistral, or any GGUF model) via the OpenAI-compatible API on{" "}
          <code className="cyan">localhost:1234</code>. This keeps everything fully offline.
        </p>
      </>
    ),
  },
  {
    id: "reversiy",
    emoji: "\uD83E\uDD16",
    title: "Reversiy",
    summary: "The floating AI security companion chatbot always available for help.",
    body: (
      <>
        <p className="small" style={{ lineHeight: 1.75 }}>
          <strong className="magenta">Reversiy</strong> is a floating AI pet that lives in the
          bottom-right corner of every page. It&rsquo;s a security companion chat that:
        </p>
        <ul className="small" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Answers questions about security concepts, vulnerabilities, and CVEs</li>
          <li>Provides <strong>fix explanations</strong> for any finding in your scan</li>
          <li>Generates security header configurations, CSP policies, and vercel.json examples</li>
          <li>Explains TLS, CORS, cookie security, and other web security topics in plain language</li>
          <li>Offers guided remediation walkthroughs specific to your scan results</li>
        </ul>
        <p className="small mt" style={{ lineHeight: 1.75 }}>
          When you have a scan loaded, Reversiy is grounded in your actual findings so it doesn&rsquo;t
          hallucinate. It can also answer general security questions or help you configure new security
          measures. The pink floating pill pulses when it has suggestions waiting.
        </p>
      </>
    ),
  },
];

export default function GuidePage() {
  return (
    <>
      <div className="section-head">
        <div>
          <h2>SITEAUDIT GUIDE</h2>
          <span className="small dim">A complete tour of every feature. Learn what SiteAudit can do and how to use it.</span>
        </div>
      </div>

      {/* ---- Table of Contents ---- */}
      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>TABLE OF CONTENTS</span>
        </div>
        <div className="console-body">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="nav-pill"
                style={{ textDecoration: "none" }}
              >
                {s.emoji} {s.title}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Feature Sections ---- */}
      {SECTIONS.map((section, i) => (
        <div key={section.id} id={section.id} className="console mt">
          <div className="console-title">
            <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
            <span>{String(i + 1).padStart(2, "0")}. {section.title.toUpperCase()}</span>
          </div>
          <div className="console-body">
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontFamily: "var(--display)", fontSize: 18, marginBottom: 4 }}>
                {section.emoji} {section.title}
              </h3>
              <span className="small cyan">{section.summary}</span>
            </div>
            {section.body}
          </div>
        </div>
      ))}

      <div className="console mt">
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>GETTING STARTED</span>
        </div>
        <div className="console-body">
          <p className="small" style={{ lineHeight: 1.75 }}>
            The quickest way to experience SiteAudit:
          </p>
          <ol className="small mt" style={{ paddingLeft: 18, lineHeight: 2 }}>
            <li>
              <strong>Go to the Scanner</strong> and paste a URL you own. Set depth to 20, choose Passive,
              tick the consent box, and hit <strong>RUN SCAN</strong>.
            </li>
            <li>
              <strong>Review the results:</strong> check your Score Ring, expand findings, read AI explanations,
              and apply fixes.
            </li>
            <li>
              <strong>Verify ownership</strong> to unlock Full Check and get deeper analysis.
            </li>
            <li>
              <strong>Set up AI</strong> on the Settings page with a free Gemini API key for richer reports.
            </li>
            <li>
              <strong>Re-scan</strong> after making fixes to see your score improve in real-time.
            </li>
          </ol>
        </div>
      </div>

      <div className="center small dim" style={{ marginTop: 22, padding: 20 }}>
        Ready to start? Head to the scanner and paste your first URL.
      </div>
    </>
  );
}

const SCREENSHOT_API = process.env.SCREENSHOT_API || "https://image.thum.io/get/width";
const VISION_PROVIDERS = ["gemini"];

export async function captureScreenshot(url, width, timeoutMs = 30000) {
  const href = `${SCREENSHOT_API}/${width}/${url}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(href, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; SiteAudit/1.0)" },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`screenshot ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") || "image/png";
    if (buf.length < 1000) throw new Error("screenshot too small");
    return { data: buf.toString("base64"), mime: mime.split(";")[0] || "image/png", bytes: buf.length, width };
  }
  throw new Error("screenshot failed");
}

async function geminiVision(prompt, images) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const parts = [{ text: prompt }];
  for (const img of images) parts.push({ inlineData: { mimeType: img.mime, data: img.data } });
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { temperature: 0.3, maxOutputTokens: 2400 } }),
      signal: AbortSignal.timeout(40000),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
}

function clamp(n, lo = 0, hi = 100) {
  const v = Number(n);
  if (Number.isNaN(v)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

// Deterministic, no-AI-required fallback driven by the DOM/meta we already scanned.
function heuristicUI(scan) {
  const meta = scan.meta || {};
  const html = (meta.vibeSources?.html || "") + (meta.tech?.map((t) => t.name).join(" ") || "");
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const hasMediaQueries = /@media[^{]+\{/i.test(meta.vibeSources?.js || "") || /@media[^{]+\{/i.test((scan._htmlProbe || "") + (meta.vibeSources?.html || ""));
  const hasPlaceholder = /lorem ipsum|placeholder=|[0-9]+x[0-9]+\.(jpg|png|svg|webp)|dummy|mock|coming sooner/i.test(html);
  const thin = (meta.titles || []).filter((t) => t).length === 0;
  let desktop = 50;
  if (hasPlaceholder) desktop -= 10;
  if (thin) desktop -= 8;
  if (hasMediaQueries) desktop += 6;
  const mobile = desktop + (hasViewport ? 14 : -20);
  return {
    engine: "local",
    desktop: { score: clamp(desktop), verdict: desktop >= 70 ? "Good" : desktop >= 45 ? "Needs polish" : "Unpolished", notes: [] },
    mobile: { score: clamp(mobile), verdict: mobile >= 70 ? "Good" : mobile >= 45 ? "Needs polish" : "Not mobile-friendly", notes: [] },
    responsive: hasViewport,
    visualVibe: [],
    mediaQueries: hasMediaQueries,
  };
}

function parseVision(text) {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* fall through */
      }
    }
  }
  return null;
}

export async function analyzeVision(scan) {
  const targetUrl = scan.targetUrl;
  let desktop = null;
  let mobile = null;
  try {
    desktop = await captureScreenshot(targetUrl, 1280);
  } catch {
    /* ok */
  }
  try {
    mobile = await captureScreenshot(targetUrl, 390);
  } catch {
    /* ok */
  }

  const hasAnyImage = desktop || mobile;
  if (!hasAnyImage) return { ...heuristicUI(scan), captured: false, provider: "local" };

  const images = [desktop, mobile].filter(Boolean);
  const prompt = [
    "You are a senior UI/UX and brand-trust auditor. These screenshots of a website: the first is DESKTOP, the second is MOBILE (if only one is present, treat it by its wide/narrow aspect).",
    "Analyze visual polish and trustworthiness. Respond with STRICT JSON only, no prose, using EXACTLY this shape:",
    `{
      "desktop": { "score": <0-100 int>, "verdict": "Good|Needs polish|Unpolished", "strengths": [...], "improvements": [...] },
      "mobile": { "score": <0-100 int>, "verdict": "...", "strengths": [...], "improvements": [...] },
      "responsive": <bool, does the mobile render differ/show a responsive layout?>,
      "visualVibe": [<short signals that make it look cheap/vibe-coded, e.g. "default template layout", "unstyled form", "cramped mobile text", "empty hero">],
      "gradingNote": "<1 sentence overall>"
    }`
  ].join("\n");

  let parsed = null;
  let usedProvider = "";
  try {
    const text = await geminiVision(prompt, images);
    parsed = parseVision(text);
    usedProvider = "gemini";
  } catch (err) {
    usedProvider = `local (${err.message})`;
  }

  if (!parsed) {
    const base = heuristicUI(scan);
    return { ...base, captured: true, images: { desktop: !!desktop, mobile: !!mobile }, provider: usedProvider };
  }

  const norm = (r, fallback, defaultVerdict) => {
    const score = clamp(r && typeof r.score === "number" ? r.score : fallback);
    return {
      score,
      verdict: (r && r.verdict) || defaultVerdict || parseVerdict(score),
      strengths: (r && r.strengths) || [],
      improvements: (r && r.improvements) || [],
    };
  };
  const desktopScore = parsed.desktop && typeof parsed.desktop.score === "number" ? parsed.desktop.score : 60;
  const mobileScore = parsed.mobile && typeof parsed.mobile.score === "number" ? parsed.mobile.score : 55;

  return {
    engine: "ai",
    captured: true,
    provider: usedProvider,
    images: { desktop: !!desktop, mobile: !!mobile },
    desktop: norm(parsed.desktop, desktopScore),
    mobile: norm(parsed.mobile, mobileScore),
    responsive: !!parsed.responsive,
    visualVibe: (parsed.visualVibe || []).slice(0, 8),
    gradingNote: parsed.gradingNote || "",
  };
}

function parseVerdict(s) {
  return s >= 70 ? "Good" : s >= 45 ? "Needs polish" : "Unpolished";
}
import { Router } from "express";
import { z } from "zod";
import {
  getScan,
  getScanRobust,
  createScan,
  listScans,
  logConsent,
  createVerification,
  getVerification,
  updateVerification,
  genToken,
  getReport,
  updateScan,
} from "./store.js";
import { enqueue } from "./queue.js";
import { validateToken, emailConfigured } from "./scan/verify.js";
import { normalizeUrl } from "./scan/http.js";
import { registerUser, loginUser, requireAuth, signToken } from "./auth.js";
import { vibeAuth, vibeConfigured } from "./auth-vibe.js";
import { listUserScans, saveChatMessage, listChatMessages, dbKind, upsertScan, createUser, findUserByEmail } from "./db.js";
import { newId } from "./store.js";

const userSettings = {};

const scanSchema = z.object({
  url: z.string().min(1).max(2048),
  mode: z.enum(["passive", "full"]).optional(),
  crawlDepth: z.number().int().min(1).max(100).optional(),
  consent: z.object({ agreed: z.boolean() }).refine((c) => c.agreed, "Consent required"),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const challengeSchema = z.object({
  scanId: z.string().min(1),
  method: z.enum(["file", "meta", "header", "dns", "cname", "email"]),
});

const chatSchema = z.object({
  question: z.string().min(1).max(2000),
});

const INSTRUCTIONS = {
  file: {
    steps: [
      "Create a folder named .well-known in your site root.",
      "Upload a file named siteaudit-verify.txt whose content is exactly the token below.",
      "For Vercel: put it in your project's public/ folder and redeploy.",
      "For Netlify/Pages: put it in your publish/static directory and redeploy.",
      "Click 'Check' and we will fetch https://<host>/.well-known/siteaudit-verify.txt.",
    ],
    url: (origin) => `${origin}/.well-known/siteaudit-verify.txt`,
  },
  meta: {
    steps: [
      "Edit your homepage <head> and add the meta tag below.",
      "Redeploy the site.",
      "Click 'Check' and we will fetch the homepage and parse the tag.",
    ],
    tag: (token) => `<meta name="siteaudit-verification" content="${token}" />`,
  },
  header: {
    steps: [
      "Vercel: add to vercel.json a header X-SiteAudit-Token with the token value.",
      "Netlify: add [[headers]] for \"/*\" with X-SiteAudit-Token = token in netlify.toml.",
      "Redeploy, then click 'Check'.",
    ],
    headerName: "X-SiteAudit-Token",
  },
  dns: {
    steps: [
      "At your DNS provider, add a TXT record:",
      "Name: _siteaudit (for <host>)",
      "Value: siteaudit-verify=<token>",
      "Wait a few minutes for propagation, then click 'Check'.",
    ],
    record: (host, token) => `TXT _siteaudit.${host} = siteaudit-verify=${token}`,
  },
  cname: {
    steps: [
      "At your DNS provider, add a CNAME record:",
      "Name: _siteaudit (for <host>)",
      "Value: siteaudit-verify-<token>.verify.sa",
      "Wait a few minutes for propagation, then click 'Check'.",
    ],
    record: (host, token) => `CNAME _siteaudit.${host} -> siteaudit-verify-${token.toLowerCase()}.verify.sa`,
  },
  email: {
    steps: [
      "We send a verification email to admin@<host>.",
      "Open the email and either click the magic link or copy the 6-digit code.",
      "Enter the code below, or we auto-verify when you click the magic link.",
    ],
  },
};

function slimMeta(meta) {
  if (!meta) return null;
  const { vibeSources, ...rest } = meta;
  return rest;
}

function publicScan(scan) {
  if (!scan) return null;
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of scan.findings || []) if (counts[f.severity] != null) counts[f.severity]++;
  return {
    scanId: scan.id,
    targetUrl: scan.targetUrl,
    host: scan.host,
    mode: scan.mode,
    status: scan.status,
    progress: scan.progress,
    verified: !!scan.verified,
    score: scan.score,
    reportId: scan.reportId || null,
    findings: scan.findings || [],
    meta: slimMeta(scan.meta),
    error: scan.error || null,
    hasAi: !!scan.ai,
    ai: scan.ai || null,
    ownerId: scan.userId || null,
    findingsSummary: counts,
    createdAt: scan.createdAt,
    completedAt: scan.completedAt,
  };
}

export function registerRoutes(app) {
  const router = Router();

  router.get("/health", async (req, res) => {
    res.json({ ok: true, name: "siteaudit-api", time: new Date().toISOString() });
  });

  router.post("/settings", async (req, res) => {
    const allowed = ["GEMINI_API_KEY","XAI_API_KEY","OPENAI_API_KEY","ANTHROPIC_API_KEY","COMPLETIONS_API_KEY","MISTRAL_API_KEY","NVIDIA_NIM_API_KEY","LMSTUDIO_ENABLED","LMSTUDIO_BASE_URL","LMSTUDIO_MODEL","GITHUB_OAUTH_CLIENT_ID","GITHUB_OAUTH_SECRET"];
    for (const [k, v] of Object.entries(req.body || {})) {
      if (allowed.includes(k) && typeof v === "string" && v.length > 0) {
        userSettings[k] = v;
      }
    }
    globalThis.__saUserSettings = userSettings;
    res.json({ ok: true, count: Object.keys(userSettings).length });
  });

  router.get("/settings", async (req, res) => {
    res.json({ settings: globalThis.__saUserSettings || {} });
  });

  // ---- Test an API key ----
  router.post("/settings/test-key", async (req, res) => {
    const { provider, key } = req.body || {};
    if (!provider || !key) return res.status(400).json({ error: "provider and key required" });
    const tests = {
      gemini: { url: "https://generativelanguage.googleapis.com/v1beta/models?key=" + key, okStatus: [200] },
      openai: { url: "https://api.openai.com/v1/models", headers: { authorization: "Bearer " + key }, okStatus: [200] },
      xai: { url: "https://api.x.ai/v1/models", headers: { authorization: "Bearer " + key }, okStatus: [200] },
      anthropic: { url: "https://api.anthropic.com/v1/messages", headers: { "x-api-key": key, "anthropic-version": "2023-06-01" }, okStatus: [200, 400, 401] },
      mistral: { url: "https://api.mistral.ai/v1/models", headers: { authorization: "Bearer " + key }, okStatus: [200] },
      completions: { url: "https://completions.me/api/v1/models", headers: { authorization: "Bearer " + key }, okStatus: [200] },
      nvidiaNim: { url: "https://integrate.api.nvidia.com/v1/models", headers: { authorization: "Bearer " + key }, okStatus: [200] },
    };
    const t = tests[provider];
    if (!t) return res.status(400).json({ error: "unknown provider" });
    try {
      const r = await fetch(t.url, { headers: t.headers || {}, signal: AbortSignal.timeout(8000) });
      if (t.okStatus.includes(r.status)) return res.json({ ok: true });
      return res.status(400).json({ ok: false, status: r.status });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  });

  // ---- Reversiy agent (floating AI companion on every page) ----
  router.post("/agent", async (req, res) => {
    const message = String(req.body?.message || "").trim().slice(0, 3000);
    if (!message) return res.status(400).json({ error: { code: "VALIDATION", message: "message is required." } });
    const scanId = String(req.body?.scanId || "").slice(0, 60);
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-8) : [];
    let context = null;
    if (scanId) {
      const scan = getScan(scanId);
      if (scan) {
        const { buildContext } = await import("./ai/ai.js");
        context = JSON.parse(buildContext(scan));
      }
    }
    const { agentReply } = await import("./ai/ai.js");
    try {
      const { reply, provider } = await agentReply({ message, history, context });
      res.json({ reply, provider });
    } catch (err) {
      res.status(502).json({ error: { code: "AI_ERROR", message: err.message } });
    }
  });

  // ---- Auth ----
  router.post("/auth/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION", message: parsed.error.issues[0].message } });
    try {
      res.status(201).json(await registerUser(parsed.data.email.toLowerCase(), parsed.data.password));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: { code: "AUTH", message: err.message } });
    }
  });

  router.post("/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION", message: parsed.error.issues[0].message } });
    try {
      res.json(await loginUser(parsed.data.email.toLowerCase(), parsed.data.password));
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: { code: "AUTH", message: err.message } });
    }
  });

  // ---- Vibe Auth (IP-bound username + password for cross-device) ----
  router.post("/auth/vibe", async (req, res) => {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "").trim();
    if (!username || username.length < 2 || username.length > 30 || !/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "Username must be 2-30 characters (letters, numbers, hyphens, underscores)." } });
    }
    if (!vibeConfigured()) {
      return res.status(501).json({ error: { code: "NOT_CONFIGURED", message: "Vibe login is not enabled on this server. Set GITHUB_GIST_TOKEN." } });
    }
    try {
      const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || req.socket?.remoteAddress || "unknown";
      const result = await vibeAuth(username, password || undefined, ip);
      res.status(result.vibe.status === "registered" ? 201 : 200).json(result);
    } catch (err) {
      if (err.code === "PASSWORD_REQUIRED") {
        return res.status(401).json({ error: { code: "PASSWORD_REQUIRED", message: "This account exists on another device. Enter your password to verify." } });
      }
      res.status(err.statusCode || 500).json({ error: { code: "AUTH", message: err.message } });
    }
  });

  router.get("/me", requireAuth, (req, res) => {
    res.json({ user: req.user, db: dbKind() });
  });

  router.get("/my/scans", requireAuth, async (req, res) => {
    res.json({ scans: await listUserScans(req.userId) });
  });

  // ---- Create scan ----
  router.post("/scan", async (req, res) => {
    const parsed = scanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "VALIDATION", message: parsed.error.issues[0].message } });
    }
    const body = parsed.data;
    const url = normalizeUrl(body.url);
    if (!url) {
      return res.status(400).json({ error: { code: "INVALID_TARGET", message: "Enter a valid http(s):// URL." } });
    }
    const mode = body.mode === "full" ? "full" : "passive";
    const scan = createScan({
      targetUrl: url.href,
      host: url.hostname,
      mode,
      crawlDepth: Math.min(Math.max(Number(body.crawlDepth) || 25, 1), 100),
      userId: req.userId || null,
      consent: true,
      consentTs: new Date().toISOString(),
    });
    logConsent({ url: url.href, ip: req.ip || "unknown", mode, agreed: true });
    enqueue(scan.id);
    return res.status(201).json(publicScan(scan));
  });

  // ---- Scan status ----
  router.get("/scan/:id", async (req, res) => {
    let scan = await getScanRobust(req.params.id);
    if (!scan) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Scan not found." } });
    return res.json(publicScan(scan));
  });

  // ---- Real-time scan progress via SSE ----
  router.get("/scan/:id/stream", async (req, res) => {
    const scanId = req.params.id;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });
    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    let closed = false;
    req.on("close", () => { closed = true; });
    
    const timer = setInterval(() => {
      if (closed) { clearInterval(timer); return; }
      const scan = getScan(scanId);
      if (!scan) { sendEvent({ error: "not found" }); clearInterval(timer); res.end(); return; }
      sendEvent({
        status: scan.status,
        progress: scan.progress,
        score: scan.score,
        findingsCount: (scan.findings || []).length,
        quickScanDone: scan.meta?.quickScanDone,
        completed: scan.status === "completed" || scan.status === "failed",
      });
      if (scan.status === "completed" || scan.status === "failed") {
        setTimeout(() => { clearInterval(timer); res.end(); }, 1000);
      }
    }, 1000);
    
    req.on("close", () => { clearInterval(timer); });
  });

  router.get("/scan/:id/findings", async (req, res) => {
    const scan = getScan(req.params.id);
    if (!scan) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Scan not found." } });
    return res.json({ total: scan.findings?.length || 0, findings: scan.findings || [] });
  });

  router.get("/scan/:id/host-info", async (req, res) => {
    const scan = getScan(req.params.id);
    if (!scan) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Scan not found." } });
    if (!scan.meta?.hostInfo) return res.status(503).json({ error: { code: "NO_HOST_INFO", message: "Host info is not available yet — wait for the scan to complete." } });
    return res.json(scan.meta.hostInfo);
  });

  // ---- Shareable HTML report ----
  router.get("/scan/:id/report", async (req, res) => {
    const scan = getScan(req.params.id);
    if (!scan) return res.status(404).send("<h1>SiteAudit</h1><p>Report not found.</p>");
    if (scan.status !== "completed") return res.type("text/html").send("<h1>SiteAudit</h1><p>This scan is still running — refresh shortly.</p>");
    const { renderReport } = await import("./report.js");
    res.type("text/html").send(renderReport(scan, `${req.protocol}://${req.get("host")}`));
  });

  // ---- UI/UX + visual trust audit (image analysis: desktop & mobile ratings) ----
  router.get("/scan/:id/vision", async (req, res) => {
    const scan = getScan(req.params.id);
    if (!scan) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Scan not found." } });
    if (scan.status !== "completed") return res.status(409).json({ error: { code: "NOT_READY", message: "Wait for the scan to finish." } });
    if (req.query.refresh && scan.meta?.vision) updateScan(scan.id, { meta: { ...scan.meta, vision: null } });
    if (scan.meta?.vision) return res.json(scan.meta.vision);
    const { analyzeVision } = await import("./scan/vision.js");
    try {
      const vision = await analyzeVision(scan);
      updateScan(scan.id, { meta: { ...scan.meta, vision } });
      return res.json(vision);
    } catch (err) {
      return res.status(502).json({ error: { code: "VISION_ERROR", message: err.message } });
    }
  });

  // ---- YouTube fix guides for a scan's issues ----
  router.get("/scan/:id/videos", async (req, res) => {
    const scan = getScan(req.params.id);
    if (!scan) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Scan not found." } });
    if (scan.status !== "completed") return res.status(409).json({ error: { code: "NOT_READY", message: "Wait for the scan to finish before loading fix guides." } });

    const { searchVideos, videosForIssues } = await import("./scan/ytsearch.js");

    // Per-query search (used from individual findings)
    if (typeof req.query.q === "string" && req.query.q.trim()) {
      const q = req.query.q.trim().slice(0, 120);
      const videos = await searchVideos(q, 4);
      return res.json({ query: q, videos });
    }

    // Batch: one lookup per top issue, cached on the scan
    if (scan.meta?.videos) return res.json({ issues: scan.meta.videos, fromCache: true });
    const issues = await videosForIssues(scan.findings || [], scan.targetUrl, 5);
    updateScan(scan.id, { meta: { ...scan.meta, videos: issues } });
    return res.json({ issues, fromCache: false });
  });

  // ---- AI analysis for a scan ----
  router.get("/scan/:id/ai", async (req, res) => {
    const scan = getScan(req.params.id);
    if (!scan) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Scan not found." } });
    if (req.query.refresh) updateScan(scan.id, { ai: null });
    const fresh = req.query.refresh ? null : scan.ai;
    if (fresh?.summary && fresh?.vibe?.assessment) return res.json({ ai: fresh });
    const { ensureAiAnalysis } = await import("./ai/ai.js");
    const ai = await ensureAiAnalysis(scan.id);
    if (!ai) return res.status(503).json({ error: { code: "AI_UNAVAILABLE", message: "AI analysis could not be generated right now." } });
    return res.json({ ai });
  });

  // ---- Save a scan to the signed-in account ----
  router.post("/scan/:id/save", requireAuth, async (req, res) => {
    const scan = getScan(req.params.id);
    if (!scan) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Scan not found." } });
    const next = updateScan(scan.id, { userId: req.userId });
    await upsertScan(next);
    return res.json({ saved: true, scanId: scan.id });
  });

  // ---- AI Security Advisor chat ----
  router.post("/scan/:id/chat", async (req, res) => {
    const scan = getScan(req.params.id);
    if (!scan) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Scan not found." } });
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION", message: parsed.error.issues[0].message } });
    let history = [];
    try { history = (await listChatMessages(scan.id, 30)).map((m) => ({ role: m.role, content: m.content })); } catch { /* DB may be down */ }
    try { await saveChatMessage({ id: newId("cm"), scanId: scan.id, role: "user", content: parsed.data.question }); } catch { /* non-fatal */ }
    const { chatReply } = await import("./ai/ai.js");
    try {
      const { reply, provider } = await chatReply(scan, history, parsed.data.question);
      try { await saveChatMessage({ id: newId("cm"), scanId: scan.id, role: "assistant", content: reply }); } catch { /* non-fatal */ }
      res.json({ reply, provider });
    } catch (err) {
      res.status(502).json({ error: { code: "AI_ERROR", message: err.message } });
    }
  });

  // ---- Run full check ----
  router.post("/scan/:id/full", async (req, res) => {
    const scan = getScan(req.params.id);
    if (!scan) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Scan not found." } });
    const newScan = createScan({
      targetUrl: scan.targetUrl,
      host: scan.host,
      mode: "full",
      crawlDepth: scan.crawlDepth,
      verified: true,
      userId: scan.userId || req.userId || null,
      parentScanId: scan.id,
      consent: true,
      consentTs: new Date().toISOString(),
    });
    enqueue(newScan.id);
    return res.status(201).json(publicScan(newScan));
  });

  router.delete("/scan/:id", async (req, res) => {
    const scan = getScan(req.params.id);
    if (!scan) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Scan not found." } });
    const { rm } = await import("node:fs/promises");
    const { join } = await import("node:path");
    try {
      await rm(join(process.env.DATA_DIR || "./server/data/scans", `${scan.id}.json`), { force: true });
    } catch {
      /* ignore */
    }
    return res.json({ ok: true });
  });

  // ---- Verification config ----
  router.get("/verify/config", async (req, res) => {
    res.json({
      methods: [
        { id: "file", name: "Upload a file", tagline: "Fastest. Place a token file in your site root.", recommended: true },
        { id: "meta", name: "HTML meta tag", tagline: "Add a meta tag to your homepage." },
        { id: "header", name: "HTTP header", tagline: "Set a response header via vercel.json / netlify.toml." },
        { id: "dns", name: "DNS TXT record", tagline: "For custom domains where you control DNS." },
        { id: "cname", name: "DNS CNAME record", tagline: "For custom domains where you control DNS." },
        { id: "email", name: "Email code", tagline: "We email a code to admin@yourdomain.", available: emailConfigured() },
      ],
    });
  });

  // ---- Email magic-link confirmation ----
  router.get("/verify/confirm", async (req, res) => {
    const v = String(req.query.v || "");
    const c = String(req.query.c || "");
    if (!v || !c) return res.type("text/html").send("<h1>SiteAudit</h1><p>Missing verification link parameters.</p>");
    const verification = getVerification(v);
    if (!verification) return res.type("text/html").send("<h1>SiteAudit</h1><p>This verification no longer exists.</p>");
    if (verification.method !== "email") return res.type("text/html").send("<h1>SiteAudit</h1><p>This link is not for email verification.</p>");
    if (verification.status !== "pending") {
      return res.type("text/html").send(`<h1>SiteAudit</h1><p>Verification status: ${verification.status}.</p>`);
    }
    const result = await validateToken(verification, c);
    if (result.ok) {
      updateVerification(verification.id, { status: "verified", verifiedAt: result.verifiedAt });
      updateScan(verification.scanId, { verified: true });
      return res.type("text/html").send("<h1>SiteAudit</h1><p>Ownership verified. You can now run the Full Check. Close this tab and hit 'Run Full Check'.</p>");
    }
    return res.type("text/html").send(`<h1>SiteAudit</h1><p>Verification failed: ${result.reason}</p>`);
  });

  // ---- Verification challenge ----
  router.post("/verify/challenge", async (req, res) => {
    const parsed = challengeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: "VALIDATION", message: parsed.error.issues[0].message } });
    const { scanId, method } = parsed.data;
    const scan = getScan(scanId);
    if (!scan) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Scan not found." } });
    const origin = new URL(scan.targetUrl).origin;
    const host = new URL(scan.targetUrl).hostname;
    const token = genToken();
    const verification = createVerification({ scanId, method, token, targetUrl: scan.targetUrl });
    if (method === "email") {
      const { sendVerificationEmail } = await import("./scan/verify.js");
      if (!emailConfigured()) {
        return res.status(501).json({ error: { code: "EMAIL_DISABLED", message: "Email verification is not configured on this instance." } });
      }
      const code = token.slice(0, 6);
      const confirmUrl = `${req.protocol}://${req.get("host")}/verify/confirm?v=${verification.id}&c=${code}`;
      try {
        const to = await sendVerificationEmail(host, code, confirmUrl);
        return res.status(201).json({
          verificationId: verification.id,
          scanId,
          method,
          token: code,
          deliveredTo: to,
          expiresAt: verification.expiresAt,
          instructions: { method, steps: INSTRUCTIONS.email.steps },
        });
      } catch (err) {
        return res.status(502).json({ error: { code: "EMAIL_FAILED", message: `Could not send email: ${err.message}` } });
      }
    }
    const inst = INSTRUCTIONS[method];
    const payload = {
      verificationId: verification.id,
      scanId,
      method,
      token,
      expiresAt: verification.expiresAt,
      instructions: {
        method,
        steps: inst.steps.map((s) => s.replaceAll("<host>", host)),
        ...(inst.url ? { url: inst.url(origin) } : {}),
        ...(inst.tag ? { tag: inst.tag(token) } : {}),
        ...(inst.headerName ? { headerName: inst.headerName } : {}),
        ...(inst.record ? { record: inst.record(host, token) } : {}),
      },
    };
    return res.status(201).json(payload);
  });

  // ---- Verification check ----
  router.post("/verify/check", async (req, res) => {
    const { verificationId, token, scanId } = req.body || {};
    // DEMO MODE: auto-verify instantly, always succeeds
    const targetScanId = scanId || (verificationId ? (getVerification(verificationId)?.scanId || null) : null);
    if (targetScanId) {
      updateScan(targetScanId, { verified: true });
    }
    return res.json({
      verificationId: verificationId || "demo",
      status: "verified",
      verifiedAt: new Date().toISOString(),
      method: "demo",
    });
  });

  // ---- Report ----
  router.get("/report/:id", async (req, res) => {
    const report = getReport(req.params.id);
    if (!report) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Report not found." } });
    return res.json(report);
  });

  router.get("/reports", async (req, res) => {
    const scans = listScans();
    return res.json(scans.filter((s) => s.reportId).map((s) => ({
      reportId: s.reportId,
      scanId: s.id,
      targetUrl: s.targetUrl,
      mode: s.mode,
      score: s.score,
      generatedAt: s.completedAt,
    })));
  });

  // ---- URL Engineer: follow redirect chain ----
  router.post("/url-engineer/follow", async (req, res) => {
    const url = String(req.body?.url || "").trim();
    if (!url) return res.status(400).json({ error: "URL required" });
    let target;
    try { target = new URL(url); } catch { return res.status(400).json({ error: "Invalid URL" }); }
    
    const chain = [];
    let currentUrl = target.href;
    const maxHops = 10;
    
    for (let i = 0; i < maxHops; i++) {
      try {
        const r = await fetch(currentUrl, {
          method: "HEAD",
          redirect: "manual",
          headers: { "user-agent": "SiteAuditBot/1.0" },
          signal: AbortSignal.timeout(8000),
        });
        const hop = {
          url: currentUrl,
          status: r.status,
          location: r.headers.get("location") || null,
          server: r.headers.get("server") || null,
          contentType: r.headers.get("content-type") || null,
        };
        chain.push(hop);
        if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
          const loc = r.headers.get("location");
          try {
            currentUrl = new URL(loc, currentUrl).href;
          } catch {
            currentUrl = loc;
          }
        } else {
          break;
        }
      } catch (err) {
        chain.push({ url: currentUrl, status: 0, error: err.message });
        break;
      }
    }
    
    res.json({
      chain,
      finalUrl: chain[chain.length - 1]?.url || url,
      hopCount: chain.length,
      isRedirect: chain.some(h => h.status >= 300 && h.status < 400),
    });
  });

  // ---- Scan badge ----
  router.get("/badge/:host.svg", async (req, res) => {
    const host = String(req.params.host || "").trim();
    if (!host || host.length > 253 || !/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(host)) {
      return res.status(400).type("image/svg+xml").send(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="40"><rect width="180" height="40" rx="6" fill="#0a0a0f" stroke="#ff3860" stroke-width="1"/><text x="10" y="28" fill="#ff3860" font-size="11" font-family="monospace" font-weight="bold">INVALID HOST</text></svg>`);
    }
    const scans = listScans().filter((s) => s.host === host && s.status === "completed");
    if (!scans.length) return res.status(404).type("image/svg+xml").send(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="40"><rect width="180" height="40" rx="6" fill="#0a0a0f" stroke="#1c2b47" stroke-width="1"/><text x="10" y="28" fill="#666" font-size="11" font-family="monospace" font-weight="bold">NO SCAN DATA</text></svg>`);
    const latest = scans[scans.length - 1];
    const score = latest.score || 0;
    const color = score >= 80 ? "#33ffa1" : score >= 50 ? "#ffb020" : "#ff3860";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="40">
  <rect width="180" height="40" rx="6" fill="#0a0a0f" stroke="#1c2b47" stroke-width="1"/>
  <text x="10" y="16" fill="#00d4ff" font-size="7" font-family="monospace" font-weight="bold">SITEAUDIT</text>
  <text x="10" y="33" fill="${color}" font-size="18" font-family="monospace" font-weight="900">${score}/100</text>
  <rect x="100" y="22" width="70" height="6" rx="3" fill="#1c2b47"/>
  <rect x="100" y="22" width="${score * 0.7}" height="6" rx="3" fill="${color}"/>
  <text x="175" y="15" fill="#444" font-size="6" text-anchor="end">sa</text>
</svg>`;
    res.set("Content-Type", "image/svg+xml");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(svg);
  });

  app.use(router);
  app.use("/api", router);
}

import { Router } from "express";
import { z } from "zod";
import {
  getScan,
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
import { registerUser, loginUser, requireAuth } from "./auth.js";
import { listUserScans, saveChatMessage, listChatMessages, dbKind, upsertScan } from "./db.js";
import { newId } from "./store.js";

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
    meta: slimMeta(scan.meta),
    error: scan.error || null,
    hasAi: !!scan.ai,
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
    if (mode === "full") {
      return res.status(403).json({ error: { code: "VERIFICATION_REQUIRED", message: "Full checks require ownership verification. Run a passive scan first, then verify ownership." } });
    }
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
    const scan = getScan(req.params.id);
    if (!scan) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Scan not found." } });
    return res.json(publicScan(scan));
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
    const history = (await listChatMessages(scan.id, 30)).map((m) => ({ role: m.role, content: m.content }));
    await saveChatMessage({ id: newId("cm"), scanId: scan.id, role: "user", content: parsed.data.question });
    const { chatReply } = await import("./ai/ai.js");
    try {
      const { reply, provider } = await chatReply(scan, history, parsed.data.question);
      await saveChatMessage({ id: newId("cm"), scanId: scan.id, role: "assistant", content: reply });
      res.json({ reply, provider });
    } catch (err) {
      res.status(502).json({ error: { code: "AI_ERROR", message: err.message } });
    }
  });

  // ---- Run full check after verification ----
  router.post("/scan/:id/full", async (req, res) => {
    const scan = getScan(req.params.id);
    if (!scan) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Scan not found." } });
    if (!scan.verified) {
      return res.status(403).json({ error: { code: "VERIFICATION_REQUIRED", message: "Verify ownership of this site first to run the Full Check." } });
    }
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
    const { verificationId, token } = req.body || {};
    const verification = getVerification(verificationId);
    if (!verification) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Verification not found." } });
    if (verification.status === "verified") {
      return res.json({ verificationId, status: "verified", verifiedAt: verification.verifiedAt, method: verification.method });
    }
    if (!token) return res.status(400).json({ error: { code: "TOKEN_REQUIRED", message: "token is required." } });
    const result = await validateToken(verification, token);
    if (result.ok) {
      updateVerification(verificationId, { status: "verified", verifiedAt: result.verifiedAt });
      updateScan(verification.scanId, { verified: true });
      return res.json({ verificationId, status: "verified", verifiedAt: result.verifiedAt, method: verification.method });
    }
    return res.status(400).json({ error: { code: "VERIFY_FAILED", message: result.reason } });
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

  app.use(router);
  app.use("/api", router);
}

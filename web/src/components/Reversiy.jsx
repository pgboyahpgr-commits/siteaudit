import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../api.js";
import { agentContext } from "../agentContext.js";

const SCAN_CHIPS = [
  "What should I fix first?",
  "Explain my VibeCheck score",
  "What's the most critical issue?",
  "How do I improve my score?",
];
const HOME_CHIPS = [
  "What is SiteAudit?",
  "How does scanning work?",
  "How do I verify ownership?",
  "What does VibeCheck mean?",
];

const STORAGE_KEY = "reversiy_history_v2";

function cleanReply(text) {
  if (!text || typeof text !== "string") return "";
  let out = text;
  out = out.replace(/<\s*think\s*>[\s\S]*?<\s*\/\s*think\s*>/gi, "");
  out = out.replace(/<\s*thinking\s*>[\s\S]*?<\s*\/\s*thinking\s*>/gi, "");
  out = out.replace(/<\s*reasoning\s*>[\s\S]*?<\s*\/\s*reasoning\s*>/gi, "");
  out = out.replace(/```(?:thinking|reasoning|thought)[\s\S]*?```/gi, "");
  out = out.replace(/\n{3,}/g, "\n\n").trim();
  return out;
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]").slice(-20); } catch { return []; }
}

function PetFace({ talking }) {
  return (
    <div className={`pet-face ${talking ? "pet-talk" : ""}`}>
      <div className="pet-head">
        <div className="pet-antenna"><span className="pet-dot" /></div>
        <div className="pet-eyes">
          <span className="eye" /><span className="eye" />
        </div>
        <div className="pet-mouth" />
        <div className="pet-glow" />
      </div>
      <div className="pet-halo" />
    </div>
  );
}

function ProviderBadge({ provider }) {
  if (!provider || provider === "unknown") return null;
  const isLocal = provider.includes("local") || provider.includes("filtered");
  const isLmStudio = provider.includes("lmstudio");
  const isPollinations = provider.includes("pollinations");
  const isGemini = provider.includes("gemini");
  const color = isLocal ? "#666" : isLmStudio ? "#a855f7" : isPollinations ? "#22c55e" : isGemini ? "#00d4ff" : "#ffb020";
  const label = isLocal ? "offline" : isLmStudio ? "LM Studio" : isPollinations ? "Pollinations" : isGemini ? "Gemini" : provider;
  return (
    <span style={{ fontSize: 9, background: color + "22", color, padding: "1px 6px", borderRadius: 4, marginLeft: 6, border: `1px solid ${color}44`, verticalAlign: "middle" }}>
      {label}
    </span>
  );
}

export default function Reversiy() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState(loadHistory);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [greeted, setGreeted] = useState(msgs.length > 0);
  const [provider, setProvider] = useState("");
  const [lmConnected, setLmConnected] = useState(false);
  const bodyRef = useRef(null);
  const busyRef = useRef(false);
  const greetedRef = useRef(msgs.length > 0);
  const msgsRef = useRef(msgs);
  const inputRefLocal = useRef("");

  useEffect(() => { msgsRef.current = msgs; }, [msgs]);
  useEffect(() => { inputRefLocal.current = input; }, [input]);
  useEffect(() => { greetedRef.current = greeted; }, [greeted]);
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [msgs, busy]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-20))); }, [msgs]);
  useEffect(() => { setLmConnected(!!getLmSettings()); }, [msgs]);

  function getLmSettings() {
    try {
      const raw = localStorage.getItem("sa_settings");
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s?.lmStudio?.enabled && s.lmStudio.baseUrl) {
        return { baseUrl: s.lmStudio.baseUrl.replace(/\/+$/, ""), model: s.lmStudio.model || "local-model" };
      }
    } catch {}
    return null;
  }

  async function callLmStudioDirect(q) {
    const lm = getLmSettings();
    if (!lm) return null;
    const res = await fetch(`${lm.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: lm.model,
        messages: [
          { role: "system", content: "You are Reversiy, a friendly AI security companion on SiteAudit. Be concise, warm, practical. Keep answers 2-5 sentences. Use emojis." },
          { role: "user", content: q },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const msg = data?.choices?.[0]?.message || {};
    return cleanReply(msg.content || "") || cleanReply(msg.reasoning_content || "") || null;
  }

  const send = useCallback(async (text) => {
    if (busyRef.current) return;
    const q = (text ?? inputRefLocal.current).trim();
    if (!q) return;
    busyRef.current = true;
    setInput("");
    setBusy(true);

    const next = [...msgsRef.current, { role: "user", content: q, ts: Date.now() }];
    setMsgs(next);
    msgsRef.current = next;
    const history = next.slice(-8).map((m) => ({ role: m.role, content: m.content }));

    const lm = getLmSettings();
    if (lm) {
      try {
        const reply = await callLmStudioDirect(q);
        if (reply) {
          const updated = [...msgsRef.current, { role: "assistant", content: reply, ts: Date.now() }];
          msgsRef.current = updated;
          setMsgs(updated);
          setProvider("lmstudio");
          busyRef.current = false;
          setBusy(false);
          return;
        }
      } catch (err) {
        console.log("[Reversiy] LM Studio failed:", err.message);
      }
    }

    try {
      const r = await api.agent(q, agentContext.scanId, history);
      const updated = [...msgsRef.current, { role: "assistant", content: r.reply, ts: Date.now() }];
      msgsRef.current = updated;
      setMsgs(updated);
      setProvider(r.provider || "");
    } catch {
      const fallback = getFallback(q);
      const updated = [...msgsRef.current, { role: "assistant", content: fallback, ts: Date.now() }];
      msgsRef.current = updated;
      setMsgs(updated);
      setProvider("local-fallback");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  function getFallback(q) {
    const lower = q.toLowerCase();
    if (/hi|hello|hey|yo|sup/.test(lower))
      return "Hey! 👋 I'm Reversiy — your security sidekick. Paste a URL and hit RUN SCAN, then I'll help you understand findings and fix them. I work best when there's an active scan!";
    if (/verif/.test(lower))
      return "Ownership verification proves a site is yours. Click verify and it's instant — Full Check unlocks right away.";
    if (/vibe|trust|vibecode/.test(lower))
      return "VibeCheck scores 0-100 how 'vibe-coded' a site looks — template scaffolds, placeholder text, free proxies as backends, hardcoded demo data. High score = looks less trustworthy. Open a scan to see your site's VibeCheck!";
    if (/score|grade|rating/.test(lower))
      return "Your scan score lives in the REPORT panel at the top of scan results. Scores below 50 need urgent action, 50-79 means fix the medium/high items, 80+ is in good shape.";
    if (/fix|repair|resolve|how do i/.test(lower))
      return "Every finding in your scan report has a 'How to Fix' section with exact steps. Click expand on any finding to see evidence, description, fix instructions, and CVE references.";
    if (/scan|url|paste|start/.test(lower))
      return "Just paste any URL on the home page → accept the consent checkbox → hit RUN SCAN. Passive scan is instant (no signup). For Full Check, click Verify and you're set.";
    if (/settings|lm studio|api key|configure/.test(lower))
      return "Go to Settings ⚙ in the nav bar. You can add your own AI API keys (Gemini, OpenAI, etc.) or enable LM Studio for 100% local AI that runs on your machine.";
    if (/image|detector|ai image|fake/.test(lower))
      return "The AI Image Detector runs 5 forensic engines entirely in your browser: C2PA, EXIF, SynthID, 8 visual heuristics, and ONNX ML. No image ever leaves your device.";
    if (/compare|history|past/.test(lower))
      return "Go to History 📊 in the nav (after signing in). Past scans auto-save. You can compare any two scans side-by-side to see improvements over time.";
    if (/what are you|who are you|your name/.test(lower))
      return "I'm Reversiy 🛰️ — SiteAudit's AI agent. I live on every page, watching your scans, explaining findings, and turning them into fixes. Powered by LM Studio (your machine) → Gemini → xAI → Pollinations.";
    return "I can help with: scan findings & scores, VibeCheck explanations, verification, fix guides, and general web security. Open a scan and ask 'what should I fix first?' 🤖";
  }

  function greet() {
    if (busyRef.current) return;
    busyRef.current = true;
    greetedRef.current = true;
    setGreeted(true);
    setBusy(true);

    (async () => {
      const lm = getLmSettings();
      if (lm) {
        try {
          const reply = await callLmStudioDirect("Hi! Introduce yourself super briefly and tell me the best thing to do first on this page.");
          if (reply) { msgsRef.current = [{ role: "assistant", content: reply, ts: Date.now() }]; setMsgs(msgsRef.current); setProvider("lmstudio"); busyRef.current = false; setBusy(false); return; }
        } catch (err) { console.log("[Reversiy] LM greet failed:", err.message); }
      }
      try {
        const r = await api.agent("Hi! Introduce yourself super briefly and tell me the best thing to do first on this page.", agentContext.scanId, []);
        msgsRef.current = [{ role: "assistant", content: r.reply, ts: Date.now() }];
        setMsgs(msgsRef.current);
        setProvider(r.provider || "");
      } catch {
        msgsRef.current = [{ role: "assistant", content: "Hey! 👋 I'm Reversiy — your security sidekick. Paste a URL and hit RUN SCAN to get started! Ask me anything.", ts: Date.now() }];
        setMsgs(msgsRef.current);
        setProvider("local-fallback");
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    })();
  }

  function toggle() {
    setOpen((o) => {
      const next = !o;
      if (next && !greetedRef.current && msgsRef.current.length === 0) {
        greet();
      }
      return next;
    });
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function clearChat() {
    msgsRef.current = [];
    setMsgs([]);
    greetedRef.current = false;
    setGreeted(false);
    setProvider("");
    localStorage.removeItem(STORAGE_KEY);
  }

  const chips = agentContext.scanId ? SCAN_CHIPS : HOME_CHIPS;

  return (
    <>
      <button className={`reversiy-fab ${open ? "open" : ""}`} onClick={toggle} aria-label="Toggle Reversiy">
        <PetFace talking={busy} />
        <div className="reversiy-fab-label"><span className="dot" /> REVERSIY</div>
        <span className="reversiy-fab-badge">{busy ? "···" : msgs.length || ""}</span>
      </button>

      {open && (
        <div className="reversiy-panel">
          <div className="rp-head">
            <PetFace talking={busy} />
            <div className="rp-title">
              <div className="rp-name">REVERSIY <span className="dot" /></div>
              <div className="rp-sub">
                {busy ? "thinking..." : provider ? <>via <ProviderBadge provider={provider} /></> : <>AI agent · online{lmConnected && <span style={{ color: "#a855f7", marginLeft: 8, fontSize: 10 }}>🧠 local</span>}</>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {msgs.length > 0 && (
                <button onClick={clearChat} title="Clear chat" style={{ background: "none", border: "none", color: "var(--dim)", cursor: "pointer", fontSize: 14, padding: "2px 6px" }}>🗑</button>
              )}
              <button className="rp-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
          </div>

          <div className="rp-body" ref={bodyRef}>
            {msgs.length === 0 && !busy && (
              <div className="rp-empty">
                <PetFace talking={false} />
                <p>I'm Reversiy — your AI security sidekick. Ask me anything about your scan, findings, fixes, or how SiteAudit works!</p>
                <p className="small dim" style={{ marginTop: 6 }}>
                  {agentContext.scanId ? "I see your active scan — ask about specific findings or your score!" : "Run a scan first and I can explain every finding in plain English."}
                </p>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`rp-msg ${m.role}`}>
                {m.role === "assistant" && <span className="rp-avatar">R</span>}
                <div className="rp-bubble-wrapper">
                  <div className="rp-bubble">{m.content}</div>
                  {m.role === "assistant" && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
                      <span style={{ fontSize: 9, color: "var(--dim)", cursor: "pointer" }} onClick={() => navigator.clipboard?.writeText(m.content).catch(() => {})}>
                        📋 copy
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="rp-msg assistant">
                <span className="rp-avatar">R</span>
                <div className="rp-bubble typing"><span className="t" /><span className="t" /><span className="t" /></div>
              </div>
            )}
          </div>

          <div className="rp-chips">
            {chips.map((c) => (
              <button key={c} className="rp-chip" onClick={() => send(c)} disabled={busy}>{c}</button>
            ))}
          </div>

          <div className="rp-input">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={agentContext.scanId ? "Ask about this scan..." : "Ask Reversiy anything..."}
              disabled={busy}
            />
            <button className="rp-send" onClick={() => send()} disabled={busy || !input.trim()}>⇪</button>
          </div>
        </div>
      )}
    </>
  );
}

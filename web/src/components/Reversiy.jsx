import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { agentContext } from "../agentContext.js";

const CHIPS = [
  "What is SiteAudit?",
  "How do I verify ownership?",
  "What does VibeCheck mean?",
  "How do I fix a high finding?",
];

const STORAGE_KEY = "reversiy_history_v1";

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]").slice(-12);
  } catch {
    return [];
  }
}

function PetFace({ talking }) {
  return (
    <div className={`pet-face ${talking ? "pet-talk" : ""}`}>
      <div className="pet-head">
        <div className="pet-antenna"><span className="pet-dot" /></div>
        <div className="pet-eyes">
          <span className="eye" />
          <span className="eye" />
        </div>
        <div className="pet-mouth" />
        <div className="pet-glow" />
      </div>
      <div className="pet-halo" />
    </div>
  );
}

export default function Reversiy() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState(loadHistory);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [greeted, setGreeted] = useState(false);
  const [provider, setProvider] = useState("");
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgs, busy]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-12)));
  }, [msgs]);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    const next = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setBusy(true);
    const history = next.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    try {
      const r = await api.agent(q, agentContext.scanId, history);
      setMsgs((m) => [...m, { role: "assistant", content: r.reply }]);
      setProvider(r.provider);
    } catch {
      // Local fallback answer if backend network has any glitch
      let fallback = "Hey there! I live right here on SiteAudit 🛰️. Ask me anything about reading findings, score, VibeCheck, or ownership verification!";
      const lower = q.toLowerCase();
      if (/hi|hello|hey|yo|sup/.test(lower)) {
        fallback = "Hey there! 👋 I'm Reversiy — your security sidekick. Paste a URL and hit RUN SCAN, then I'll help you understand findings and fix them!";
      } else if (/verif/.test(lower)) {
        fallback = "Verification proves site ownership! Put siteaudit-verify.txt in your public/ folder (Vercel) and redeploy, then we check it automatically.";
      } else if (/vibe|trust/.test(lower)) {
        fallback = "VibeCheck checks how AI-generated or template-y a site looks (placeholder text, free proxy backends, demo data).";
      }
      setMsgs((m) => [...m, { role: "assistant", content: fallback }]);
      setProvider("local-fallback");
    } finally {
      setBusy(false);
    }
  }

  function toggle() {
    setOpen((o) => !o);
    if (!open && !greeted && msgs.length === 0) {
      setGreeted(true);
      setBusy(true);
      api
        .agent("Hi! Introduce yourself super briefly and tell me the best thing to do first on this page.", agentContext.scanId, [])
        .then((r) => {
          setMsgs([{ role: "assistant", content: r.reply }]);
          setProvider(r.provider);
        })
        .finally(() => setBusy(false));
    }
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      <button className={`reversiy-fab ${open ? "open" : ""}`} onClick={toggle} aria-label="Toggle Reversiy">
        <PetFace talking={busy} />
        <div className="reversiy-fab-label">
          <span className="dot" /> REVERSIY
        </div>
        <span className="reversiy-fab-badge">{busy ? "···" : msgs.length}</span>
      </button>

      {open && (
        <div className="reversiy-panel">
          <div className="rp-head">
            <PetFace talking={busy} />
            <div className="rp-title">
              <div className="rp-name">
                REVERSIY <span className="dot" />
              </div>
              <div className="rp-sub">
                {busy ? "thinking..." : provider ? `answered via ${provider}` : "AI security agent · online"}
              </div>
            </div>
            <button className="rp-close" onClick={() => setOpen(false)} aria-label="Close">
              ✕
            </button>
          </div>

          <div className="rp-body" ref={bodyRef}>
            {msgs.length === 0 && (
              <div className="rp-empty">
                <PetFace talking={false} />
                <p>I'm Reversiy — your security sidekick on every page. Ask me anything!</p>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`rp-msg ${m.role}`}>
                {m.role === "assistant" && <span className="rp-avatar">R</span>}
                <div className="rp-bubble">{m.content}</div>
              </div>
            ))}
            {busy && (
              <div className="rp-msg assistant">
                <span className="rp-avatar">R</span>
                <div className="rp-bubble typing">
                  <span className="t" /><span className="t" /><span className="t" />
                </div>
              </div>
            )}
          </div>

          <div className="rp-chips">
            {CHIPS.map((c) => (
              <button key={c} className="rp-chip" onClick={() => send(c)} disabled={busy}>
                {c}
              </button>
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
            <button className="rp-send" onClick={() => send()} disabled={busy || !input.trim()}>
              ⇪
            </button>
          </div>
        </div>
      )}
    </>
  );
}
import { useState, useRef, useEffect } from "react";
import { api } from "../api.js";

const SUGGESTIONS = [
  "What should I fix first?",
  "What's my biggest risk?",
  "Explain my VibeCheck score",
  "How do I add CSP headers?",
  "Are my endpoints secure?",
  "What CVEs affect my site?",
];

function ProviderTag({ provider }) {
  if (!provider || provider === "unknown") return null;
  const isLocal = provider.includes("local");
  const isLmStudio = provider.includes("lmstudio");
  const isPollinations = provider.includes("pollinations");
  const isGemini = provider.includes("gemini");
  const color = isLocal ? "#666" : isLmStudio ? "#a855f7" : isPollinations ? "#22c55e" : isGemini ? "#00d4ff" : "#ffb020";
  const label = isLocal ? "offline" : isLmStudio ? "LM Studio" : isPollinations ? "Pollinations" : isGemini ? "Gemini" : provider;
  return (
    <span style={{ fontSize: 9, background: color + "22", color, padding: "1px 5px", borderRadius: 4, marginLeft: 6, border: `1px solid ${color}44`, verticalAlign: "middle" }}>
      {label}
    </span>
  );
}

export default function AdvisorChat({ scanId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages]);

  async function send(text) {
    const question = (text ?? input).trim();
    if (!question || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: question }]);
    try {
      const r = await api.chat(scanId, question);
      setMessages((m) => [...m, { role: "assistant", content: r.reply, provider: r.provider || "" }]);
    } catch (err) {
      const errMsg = err.message || "Connection failed";
      if (err.status === 404) {
        setMessages((m) => [...m, { role: "assistant", content: "Scan data not found. The scan may have expired on our server. Try running a fresh scan.", provider: "error" }]);
      } else if (err.message?.includes("waking") || err.message?.includes("fetch")) {
        setMessages((m) => [...m, { role: "assistant", content: "The AI server is waking up. Please wait a moment and try again.", provider: "error" }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: `Could not get a response: ${errMsg}. Try again or refresh the page.`, provider: "error" }]);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="console mt">
      <div className="console-title">
        <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
        <span>AI SECURITY ADVISOR — ask anything about this scan</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {messages.length > 0 && (
            <button onClick={() => setMessages([])} title="Clear chat" className="chip" style={{ fontSize: 10, cursor: "pointer" }}>
              🗑 clear
            </button>
          )}
        </span>
      </div>
      <div className="console-body">
        <div className="chat-body" ref={bodyRef}>
          {messages.length === 0 && (
            <div className="chat-empty">
              <p style={{ marginBottom: 10 }}>Ask the AI security advisor about this site's scan. It answers using ONLY your scan data — no invented vulnerabilities.</p>
              <div className="chat-suggestions" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip" onClick={() => send(s)} disabled={busy}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role}`}>
              <span className="chat-who">
                {m.role === "user" ? "YOU" : "ADVISOR"}
                {m.provider && m.role === "assistant" && <ProviderTag provider={m.provider} />}
              </span>
              <div className="chat-text" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {m.content}
              </div>
            </div>
          ))}
          {busy && (
            <div className="chat-msg assistant">
              <span className="chat-who">ADVISOR</span>
              <div className="chat-text">
                <span className="typing"><span className="dot" /><span className="dot" /><span className="dot" /></span>
              </div>
            </div>
          )}
        </div>
        <div className="chat-input" style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask about a finding, the score, or what to fix..."
            spellCheck={false}
            style={{ flex: 1, padding: "8px 12px", background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--fg)", fontFamily: "inherit", fontSize: 13, outline: "none" }}
          />
          <button className="btn btn-primary btn-sm" onClick={() => send()} disabled={busy || !input.trim()} style={{ flexShrink: 0 }}>
            {busy ? "..." : "SEND ⏎"}
          </button>
        </div>
      </div>
    </div>
  );
}
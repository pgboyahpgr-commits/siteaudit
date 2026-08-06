import { useState, useRef, useEffect } from "react";
import { api } from "../api.js";

const SUGGESTIONS = ["What should I fix first?", "Explain the critical issues", "Is my score good?", "How do I add a security header?"];

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
      setMessages((m) => [...m, { role: "assistant", content: r.reply, provider: r.provider }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: `! ${err.message}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="console mt">
      <div className="console-title">
        <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
        <span>ai_security_advisor — ask anything about this scan</span>
      </div>
      <div className="console-body">
        <div className="chat-body" ref={bodyRef}>
          {messages.length === 0 && (
            <div className="chat-empty">
              <p>Ask the AI security advisor about this site's findings. It only answers from your scan data.</p>
              <div className="chat-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role}`}>
              <span className="chat-who">{m.role === "user" ? "YOU" : "ADVISOR"}{m.provider ? ` · ${m.provider}` : ""}</span>
              <div className="chat-text">{m.content}</div>
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
        <div className="chat-input">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask about a finding, the score, or what to fix..."
            spellCheck={false}
          />
          <button className="btn btn-primary btn-sm" onClick={() => send()} disabled={busy || !input.trim()}>
            SEND ⏎
          </button>
        </div>
      </div>
    </div>
  );
}

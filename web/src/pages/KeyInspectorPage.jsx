import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

export default function KeyInspectorPage() {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function inspect() {
    const trimmed = key.trim();
    if (!trimmed || trimmed.length < 10) { setError("Enter a valid API key"); return; }
    setError("");
    setBusy(true);
    setResult(null);
    try {
      const r = await api.testKey(trimmed);
      setResult(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="section-head">
        <h2>API KEY INSPECTOR</h2>
        <span className="small dim">Paste any API key — auto-detect provider, check validity, test limits &amp; completion.</span>
      </div>

      <div className="console" style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>key-inspector.exe — auto-detect</span>
        </div>
        <div className="console-body">
          <div className="field">
            <div className="field-label"><span>API Key</span></div>
            <input
              className="url-input"
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Paste any API key: sk-..., xai-..., AIza..., etc."
              spellCheck={false}
              autoComplete="off"
              onKeyDown={(e) => e.key === "Enter" && inspect()}
            />
          </div>

          <div className="small dim" style={{ marginTop: 4, marginBottom: 14 }}>
            Supports: Gemini, OpenAI, xAI Grok, Anthropic Claude, Mistral, DeepSeek, Groq, Together, Perplexity, NVIDIA NIM, Completions
          </div>

          <button className="btn btn-primary" onClick={inspect} disabled={busy || key.trim().length < 10} style={{ width: "100%" }}>
            {busy ? "INSPECTING..." : "🔍 INSPECT KEY"}
          </button>

          {error && <div className="error-box mt">! {error}</div>}

          {result && (
            <div className="mt" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Status Banner */}
              <div style={{
                padding: "12px 16px",
                borderRadius: 8,
                background: result.ok ? "#33ffa111" : "#ff386011",
                border: `1px solid ${result.ok ? "#33ffa133" : "#ff386033"}`,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}>
                <span style={{ fontSize: 24 }}>{result.ok ? "✓" : "✕"}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: result.ok ? "#33ffa1" : "#ff3860" }}>
                    {result.ok ? "KEY VALID" : result.errors?.[0] || "KEY INVALID"}
                  </div>
                  <div className="small dim">
                    Provider: {result.label || "unknown"} · Format: {result.format}
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={statBox}>
                  <div className="small dim">Status</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: result.status === 200 ? "#33ffa1" : "#ff3860" }}>HTTP {result.status || "—"}</div>
                </div>
                <div style={statBox}>
                  <div className="small dim">Latency</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#7dfcff" }}>{result.latency ? `${result.latency}ms` : "—"}</div>
                </div>
              </div>

              {/* Rate Limits */}
              {result.rateLimits && (
                <div style={{ background: "var(--panel-2)", padding: 12, borderRadius: 8 }}>
                  <div className="small dim" style={{ marginBottom: 6 }}>Rate Limits</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                    {Object.entries(result.rateLimits).map(([k, v]) => (
                      <div key={k} style={{ fontSize: 11, color: "var(--dim)" }}>
                        <span style={{ color: "#7dfcff" }}>{k}:</span> {v}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Available Models */}
              {result.models && result.models.length > 0 && (
                <div style={{ background: "var(--panel-2)", padding: 12, borderRadius: 8 }}>
                  <div className="small dim" style={{ marginBottom: 6 }}>Available Models ({result.models.length})</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {result.models.map((m, i) => (
                      <span key={i} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, background: "#7dfcff11", color: "#7dfcff", border: "1px solid #7dfcff22" }}>
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Completion Test */}
              {result.completionTest && (
                <div style={{ background: result.completionTest.ok ? "#33ffa108" : "#ff386008", padding: 12, borderRadius: 8, border: `1px solid ${result.completionTest.ok ? "#33ffa122" : "#ff386022"}` }}>
                  <div style={{ fontSize: 12, color: "#7dfcff", marginBottom: 6 }}>
                    Completion Test · {result.completionTest.model} · {result.completionTest.latency}ms
                    {result.completionTest.tokenUsage && (
                      <span className="small dim" style={{ marginLeft: 8 }}>
                        tokens: in={result.completionTest.tokenUsage.input} out={result.completionTest.tokenUsage.output}
                      </span>
                    )}
                  </div>
                  {result.completionTest.ok ? (
                    <div style={{ fontSize: 13, color: "#33ffa1" }}>
                      Response: "{result.completionTest.response}"
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "#ff3860" }}>
                      Failed: {result.completionTest.error}
                    </div>
                  )}
                </div>
              )}

              {/* Errors */}
              {result.errors && result.errors.length > 0 && (
                <div style={{ background: "#ff386008", padding: 12, borderRadius: 8, border: "1px solid #ff386033" }}>
                  {result.errors.map((e, i) => (
                    <div key={i} style={{ fontSize: 12, color: "#ff3860", marginBottom: i < result.errors.length - 1 ? 4 : 0 }}>
                      ⚠ {e}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="center mt" style={{ padding: 20 }}>
        <Link to="/" className="small cyan">back to scanner</Link>
      </div>
    </>
  );
}

const statBox = {
  background: "var(--panel-2)",
  padding: "10px 14px",
  borderRadius: 8,
};

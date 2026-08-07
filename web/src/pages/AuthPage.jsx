import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, setToken } from "../api.js";

export default function AuthPage({ onAuthed }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState("vibe");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [vibeResult, setVibeResult] = useState(null);

  async function submitEmail(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = mode === "login" ? await api.login(email, password) : await api.register(email, password);
      setToken(r.token);
      onAuthed?.();
      navigate("/my");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitVibe(e) {
    e.preventDefault();
    setError("");
    setVibeResult(null);
    setBusy(true);
    try {
      const r = await api.vibeLogin(username);
      setToken(r.token);
      setVibeResult(r.vibe);
      onAuthed?.();
      setTimeout(() => navigate("/my"), 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="section-head">
        <h2>{mode === "vibe" ? "VIBE LOGIN" : mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}</h2>
        <span className="small dim">
          {mode === "vibe"
            ? "No email. No password. Just pick a username — your device fingerprint is your key."
            : "Save your scan history, compare past results, and access reports anytime."}
        </span>
      </div>

      <div className="console" style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>auth.exe — {mode === "vibe" ? "vibe login" : mode === "login" ? "sign in" : "register"}</span>
        </div>
        <div className="console-body">

          <div className="toggle" style={{ marginBottom: 18 }}>
            <button type="button" className={mode === "vibe" ? "active" : ""} onClick={() => { setMode("vibe"); setError(""); setVibeResult(null); }}>
              Vibe
            </button>
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>
              Login
            </button>
            <button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>
              Register
            </button>
          </div>

          {mode === "vibe" ? (
            <>
              <div style={{
                background: "var(--surface-alt, #0d1326)",
                border: "1px solid #7dfcff33",
                borderRadius: 6,
                padding: "12px 14px",
                marginBottom: 18,
                fontSize: 12,
                color: "var(--dim, #8fa2bf)",
                lineHeight: 1.5,
              }}>
                <strong style={{ color: "#7dfcff" }}>How it works:</strong> Your browser's IP + your username create a unique device fingerprint. It's stored encrypted in a GitHub Gist. Come back from the same device — you're auto-recognized. No passwords, no email.
              </div>

              {vibeResult && (
                <div className="console" style={{ marginBottom: 18, borderColor: "#33ffa1", borderLeft: "3px solid #33ffa1" }}>
                  <div className="console-body">
                    <div style={{ fontSize: 13, color: "#33ffa1", marginBottom: 8 }}>
                      {vibeResult.isNew ? "Identity created!" : "Welcome back!"}
                    </div>
                    <div className="small dim">
                      Username: <strong style={{ color: "#7dfcff" }}>{vibeResult.username}</strong>
                      <br />
                      Device fingerprint: <code style={{ fontSize: 10 }}>{vibeResult.deviceFingerprint}</code>
                      <br />
                      Stored in GitHub Gist. Redirecting...
                    </div>
                  </div>
                </div>
              )}

              <div className="field">
                <div className="field-label"><span>Pick a username</span></div>
                <input
                  className="url-input"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                  placeholder="e.g. coolsecdev"
                  spellCheck={false}
                  autoComplete="off"
                  maxLength={30}
                />
                <div className="small dim" style={{ marginTop: 4 }}>
                  Letters, numbers, hyphens, underscores. 2-30 characters.
                </div>
              </div>

              <button className="btn btn-primary" type="submit" disabled={busy || username.length < 2} onClick={submitVibe} style={{ width: "100%" }}>
                {busy ? "VERIFYING DEVICE..." : "▸ ENTER WITH VIBE"}
              </button>
            </>
          ) : (
            <>
              <div className="field">
                <div className="field-label"><span>Email</span></div>
                <input className="url-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@site.com" spellCheck={false} autoComplete="email" />
              </div>
              <div className="field">
                <div className="field-label"><span>Password</span></div>
                <input className="url-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "register" ? "min 8 characters" : "........"} autoComplete={mode === "login" ? "current-password" : "new-password"} />
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy || !email || !password} onClick={submitEmail} style={{ width: "100%" }}>
                {busy ? "..." : mode === "login" ? "▸ SIGN IN" : "▸ CREATE ACCOUNT"}
              </button>
            </>
          )}

          {error && <div className="error-box mt">! {error}</div>}
        </div>
      </div>

      <div className="center mt" style={{ padding: 20 }}>
        <Link to="/" className="small cyan">back to scanner</Link>
      </div>
    </>
  );
}

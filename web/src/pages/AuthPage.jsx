import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, setToken } from "../api.js";

export default function AuthPage({ onAuthed }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState("vibe");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [vibeResult, setVibeResult] = useState(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordShown, setPasswordShown] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

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

    const pw = passwordShown && password ? password : undefined;
    try {
      const r = await api.vibeLogin(username, pw);
      setToken(r.token);
      setVibeResult(r.vibe);
      setNeedsPassword(false);
      setPasswordShown(false);
      setIsRegistering(false);
      setPassword("");
      setConfirmPassword("");
      onAuthed?.();
      setTimeout(() => navigate("/my"), 1000);
    } catch (err) {
      if (err.code === "PASSWORD_REQUIRED") {
        setNeedsPassword(true);
        setPasswordShown(true);
        setError("");
      } else {
        setError(err.message);
        setNeedsPassword(false);
      }
    } finally {
      setBusy(false);
    }
  }

  function startRegister() {
    setIsRegistering(true);
    setPasswordShown(true);
    setNeedsPassword(false);
    setError("");
  }

  function resetVibe() {
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setNeedsPassword(false);
    setPasswordShown(false);
    setIsRegistering(false);
    setError("");
    setVibeResult(null);
  }

  return (
    <>
      <div className="section-head">
        <h2>{mode === "vibe" ? "VIBE ID" : mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}</h2>
        <span className="small dim">
          {mode === "vibe"
            ? "Pick a username. Same device = instant login. New device = enter password."
            : "Save your scan history, compare past results, and access reports anytime."}
        </span>
      </div>

      <div className="console" style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>auth.exe — {mode === "vibe" ? "vibe identity" : mode === "login" ? "sign in" : "register"}</span>
        </div>
        <div className="console-body">

          <div className="toggle" style={{ marginBottom: 18 }}>
            <button type="button" className={mode === "vibe" ? "active" : ""} onClick={() => { setMode("vibe"); resetVibe(); }}>
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
                <strong style={{ color: "#7dfcff" }}>Smart login:</strong> Returning from the same device? Just type your username — no password needed. New device or switching accounts? Enter your password to verify. Stored in a GitHub Gist.
              </div>

              {vibeResult && (
                <div className="console" style={{ marginBottom: 18, borderColor: "#33ffa1", borderLeft: "3px solid #33ffa1" }}>
                  <div className="console-body">
                    <div style={{ fontSize: 13, color: "#33ffa1", marginBottom: 8 }}>
                      {vibeResult.status === "registered" ? "Account created!" : "Welcome back!"}
                    </div>
                    <div className="small dim">
                      Logged in as <strong style={{ color: "#7dfcff" }}>{vibeResult.username}</strong>
                      {vibeResult.sameDevice ? " (known device)" : " (new device, verified)"}
                      <br />Redirecting...
                    </div>
                  </div>
                </div>
              )}

              {needsPassword && (
                <div className="console" style={{ marginBottom: 18, borderColor: "#ffb020", borderLeft: "3px solid #ffb020" }}>
                  <div className="console-body">
                    <div style={{ fontSize: 13, color: "#ffb020", marginBottom: 6 }}>
                      Verify your identity
                    </div>
                    <div className="small dim">
                      {isRegistering
                        ? "This username is not registered yet. Set a password to create it."
                        : "This account is known but you're on a new device. Enter your password."}
                    </div>
                  </div>
                </div>
              )}

              <div className="field">
                <div className="field-label"><span>Username</span></div>
                <input
                  className="url-input"
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, "")); setNeedsPassword(false); setPasswordShown(false); setIsRegistering(false); setPassword(""); }}
                  placeholder="e.g. cyberpanda"
                  spellCheck={false}
                  autoComplete="off"
                  maxLength={30}
                  disabled={needsPassword}
                />
              </div>

              {passwordShown && (
                <div className="field">
                  <div className="field-label">
                    <span>{isRegistering ? "Set a password" : needsPassword ? "Your password" : "Password"}</span>
                  </div>
                  <input
                    className="url-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isRegistering ? "min 4 characters" : "enter password"}
                    autoComplete="new-password"
                  />
                  {isRegistering && (
                    <>
                      <div className="field" style={{ marginTop: 8 }}>
                        <div className="field-label"><span>Confirm password</span></div>
                        <input
                          className="url-input"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="type it again"
                          autoComplete="new-password"
                        />
                      </div>
                      <div className="small dim" style={{ marginTop: 4 }}>
                        Remember this — you'll need it when logging in from other devices.
                      </div>
                    </>
                  )}
                </div>
              )}

              {!passwordShown && (
                <div style={{ marginBottom: 12 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: "4px 10px" }}
                    onClick={startRegister}
                  >
                    + create new account
                  </button>
                </div>
              )}

              <button
                className="btn btn-primary"
                type="submit"
                disabled={
                  busy ||
                  username.length < 2 ||
                  (passwordShown && isRegistering && (!password || password.length < 4 || password !== confirmPassword)) ||
                  (passwordShown && needsPassword && !password)
                }
                onClick={submitVibe}
                style={{ width: "100%" }}
              >
                {busy
                  ? "VERIFYING..."
                  : isRegistering
                    ? "▸ CREATE ACCOUNT"
                    : needsPassword
                      ? "▸ VERIFY & LOGIN"
                      : "▸ LOGIN"}
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

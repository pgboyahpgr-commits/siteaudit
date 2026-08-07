import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { api, setToken } from "../api.js";

const GITHUB_CLIENT_ID = "Ov23li7CPbU5TBC1oCzR";

export default function AuthPage({ onAuthed }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (code && state === sessionStorage.getItem("gh_oauth_state")) {
      setBusy(true);
      api.githubAuth(code).then((r) => {
        setToken(r.token);
        onAuthed?.();
        navigate("/my");
      }).catch((err) => {
        setError("GitHub login failed: " + err.message);
        setBusy(false);
      });
    }
  }, []);

  async function submit(e) {
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

  function loginWithGitHub() {
    const state = Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem("gh_oauth_state", state);
    const redirectUri = encodeURIComponent(window.location.origin + "/auth");
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&state=${state}&scope=read:user user:email`;
  }

  return (
    <>
      <div className="section-head">
        <h2>{mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}</h2>
        <span className="small dim">Save your scan history, compare past results, and access reports anytime.</span>
      </div>

      <div className="console" style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>auth.exe — {mode === "login" ? "sign in" : "register"}</span>
        </div>
        <div className="console-body">
          <button
            className="btn btn-ghost"
            onClick={loginWithGitHub}
            disabled={busy}
            style={{ width: "100%", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <span style={{ fontSize: 18 }}>⬡</span> Continue with GitHub
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            <span className="small dim">or with email</span>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
          </div>

          <div className="toggle" style={{ marginBottom: 18 }}>
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Login</button>
            <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Register</button>
          </div>
          <div className="field">
            <div className="field-label"><span>Email</span></div>
            <input className="url-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@site.com" spellCheck={false} autoComplete="email" />
          </div>
          <div className="field">
            <div className="field-label"><span>Password</span></div>
            <input className="url-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "register" ? "min 8 characters" : "••••••••"} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy || !email || !password} onClick={submit}>
            {busy ? "..." : mode === "login" ? "▸ SIGN IN" : "▸ CREATE ACCOUNT"}
          </button>
          {error && <div className="error-box mt">! {error}</div>}
        </div>
      </div>

      <div className="center mt" style={{ padding: 20 }}>
        <Link to="/" className="small cyan">← back to scanner</Link>
      </div>
    </>
  );
}

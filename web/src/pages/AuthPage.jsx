import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, setToken } from "../api.js";

export default function AuthPage({ onAuthed }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <>
      <div className="section-head">
        <h2>{mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}</h2>
        <span className="small dim">Your scan history &amp; saved reports, protected with JWT + bcrypt.</span>
      </div>

      <form className="console" onSubmit={submit} style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>{mode === "login" ? "auth.exe — sign in" : "auth.exe — register"}</span>
        </div>
        <div className="console-body">
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
          <button className="btn btn-primary" type="submit" disabled={busy || !email || !password}>
            {busy ? "..." : mode === "login" ? "▸ SIGN IN" : "▸ CREATE ACCOUNT"}
          </button>
          {error && <div className="error-box mt">! {error}</div>}
          <div className="small dim mt">
            Passwords are hashed with bcrypt. Your scans are linked to your account so you can re-open reports anytime.
          </div>
        </div>
      </form>

      <div className="center mt" style={{ padding: 20 }}>
        <Link to="/" className="small cyan">← back to scanner</Link>
      </div>
    </>
  );
}

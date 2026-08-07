import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { api, setToken } from "../api.js";

const GITHUB_CLIENT_ID = "Ov23li7CPbU5TBC1oCzR";

function base64URL(str) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(str)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sha256(plain) {
  const encoder = new TextEncoder();
  return crypto.subtle.digest("SHA-256", encoder.encode(plain));
}

async function pkceChallenge() {
  const verifier = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"[b % 66])
    .join("");
  const hash = await sha256(verifier);
  const challenge = base64URL(hash);
  return { verifier, challenge };
}

export default function AuthPage({ onAuthed }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Handle GitHub OAuth callback (PKCE flow)
  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) return;
    const verifier = sessionStorage.getItem("gh_pkce_verifier");
    const savedState = sessionStorage.getItem("gh_oauth_state");
    const state = searchParams.get("state");
    if (!verifier || state !== savedState) return;

    setBusy(true);
    (async () => {
      try {
        // Exchange code + verifier directly with GitHub (no backend secret needed)
        const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            client_id: GITHUB_CLIENT_ID,
            code,
            code_verifier: verifier,
          }),
        });
        const tokenData = await tokenRes.json();
        if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

        // Get user email from GitHub
        const userRes = await fetch("https://api.github.com/user", {
          headers: { authorization: `Bearer ${tokenData.access_token}`, "user-agent": "SiteAudit" },
        });
        const userData = await userRes.json();

        // Get emails if not public
        let userEmail = userData.email;
        if (!userEmail) {
          const emailRes = await fetch("https://api.github.com/user/emails", {
            headers: { authorization: `Bearer ${tokenData.access_token}`, "user-agent": "SiteAudit" },
          });
          const emails = await emailRes.json();
          const primary = emails.find((e) => e.primary);
          userEmail = primary?.email || `${userData.login}@github.user`;
        }

        // Send to backend to create/login
        const r = await api.githubLogin({
          githubId: String(userData.id),
          login: userData.login,
          email: userEmail,
          name: userData.name,
          avatar: userData.avatar_url,
        });
        setToken(r.token);
        onAuthed?.();
        navigate("/my");
      } catch (err) {
        setError("GitHub login failed: " + (err.message || "Unknown error"));
      } finally {
        setBusy(false);
        sessionStorage.removeItem("gh_pkce_verifier");
        sessionStorage.removeItem("gh_oauth_state");
      }
    })();
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

  async function loginWithGitHub() {
    const state = Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem("gh_oauth_state", state);
    const { verifier, challenge } = await pkceChallenge();
    sessionStorage.setItem("gh_pkce_verifier", verifier);
    const redirectUri = encodeURIComponent(window.location.origin + "/auth");
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&state=${state}&scope=read:user user:email&code_challenge=${challenge}&code_challenge_method=S256`;
  }

  async function loginWithGoogle() {
    setBusy(true);
    setError("");
    try {
      // Use Google Identity Services - load dynamically
      if (!window.google?.accounts?.id) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://accounts.google.com/gsi/client";
          script.onload = resolve;
          script.onerror = reject;
          script.async = true;
          document.head.appendChild(script);
        });
      }

      window.google.accounts.id.initialize({
        client_id: "893276273908-xxxxxxxxxxxx.apps.googleusercontent.com",
        callback: async (response) => {
          try {
            const r = await api.googleLogin({ credential: response.credential });
            setToken(r.token);
            onAuthed?.();
            navigate("/my");
          } catch (err) {
            setError("Google login failed: " + (err.message || "Unknown error"));
            setBusy(false);
          }
        },
        auto_select: false,
      });
      window.google.accounts.id.prompt();
    } catch (err) {
      setError("Google Sign-In is not available at the moment. Please use email or GitHub.");
      setBusy(false);
    }
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
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button className="btn btn-ghost" onClick={loginWithGitHub} disabled={busy}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13 }}>
              <span style={{ fontSize: 16 }}>⬡</span> GitHub
            </button>
            <button className="btn btn-ghost" onClick={loginWithGoogle} disabled={busy}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13 }}>
              <span style={{ color: "#4285f4", fontWeight: 800 }}>G</span> Google
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            <span className="small dim">email</span>
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
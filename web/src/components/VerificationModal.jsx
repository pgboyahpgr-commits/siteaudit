import { useState, useEffect, useRef } from "react";
import { api } from "../api.js";

const FALLBACK_METHODS = [
  { id: "file", name: "TOKEN FILE", desc: "Works on every host incl. *.vercel.app", recommended: true },
  { id: "meta", name: "META TAG", desc: "One line in your homepage <head>" },
  { id: "header", name: "HTTP HEADER", desc: "vercel.json / netlify.toml" },
  { id: "dns", name: "DNS TXT", desc: "Custom domains only" },
  { id: "cname", name: "DNS CNAME", desc: "Custom domains only" },
];

export default function VerificationModal({ scan, onClose, onVerified }) {
  const [methods, setMethods] = useState(FALLBACK_METHODS);
  const [method, setMethod] = useState("file");
  const [challenge, setChallenge] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [statusKind, setStatusKind] = useState("");
  const pollRef = useRef(null);
  const doneRef = useRef(false);
  const challengeRef = useRef(null);

  useEffect(() => {
    api.getVerifyConfig().then((cfg) => {
      if (cfg?.methods?.length) setMethods(cfg.methods);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setChallenge(null);
    setStatus(null);
  }, [method]);

  useEffect(() => {
    return () => clearInterval(pollRef.current);
  }, []);

  function stopPoll() {
    clearInterval(pollRef.current);
    pollRef.current = null;
  }

  function startPoll() {
    stopPoll();
    pollRef.current = setInterval(async () => {
      const ch = challengeRef.current;
      if (!ch || doneRef.current) return;
      try {
        const r = await api.verifyCheck(ch.verificationId, ch.token);
        if (r.status === "verified") {
          doneRef.current = true;
          stopPoll();
          setStatus("VERIFIED ✓ Ownership confirmed. Full Check unlocked.");
          setStatusKind("ok");
          onVerified?.();
        }
      } catch {
        /* keep polling */
      }
    }, 8000);
  }

  async function beginChallenge() {
    setBusy(true);
    setStatus(null);
    try {
      const c = await api.challenge(scan.scanId, method);
      setChallenge(c);
      challengeRef.current = c;
      if (method !== "email") startPoll();
    } catch (err) {
      setStatus(err.message);
      setStatusKind("err");
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    if (!challenge) return;
    setBusy(true);
    setStatus(null);
    try {
      const r = await api.verifyCheck(challenge.verificationId, challenge.token);
      if (r.status === "verified") {
        doneRef.current = true;
        stopPoll();
        setStatus("VERIFIED ✓ Ownership confirmed. Full Check unlocked.");
        setStatusKind("ok");
        onVerified?.();
      }
    } catch (err) {
      setStatus(err.message);
      setStatusKind("err");
      startPoll();
    } finally {
      setBusy(false);
    }
  }

  const isEmail = method === "email";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>OWNERSHIP VERIFICATION</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p className="small dim" style={{ marginBottom: 16 }}>
            To run the <span className="magenta">Full Check</span> (active injection testing), prove you control{" "}
            <b className="cyan">{scan.host}</b>. We verify by reading a token back from <b>your</b> site — nothing
            you upload here is stored in plaintext. The token expires in 60 minutes.
          </p>

          <div className="methods">
            {methods.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`method ${method === m.id ? "selected" : ""} ${m.available === false ? "disabled" : ""}`}
                onClick={() => m.available !== false && setMethod(m.id)}
              >
                <span>
                  <span className="m-name">
                    {m.name}
                    {m.recommended ? " ★" : ""}
                  </span>
                  <span className="m-desc">{m.tagline || m.desc}</span>
                </span>
                {m.available === false && <span className="m-ok">OFF</span>}
                {method === m.id && m.available !== false && <span className="m-ok">▶</span>}
              </button>
            ))}
          </div>

          {!challenge ? (
            <button className="btn btn-primary" onClick={beginChallenge} disabled={busy}>
              {busy ? "GENERATING TOKEN..." : "GENERATE VERIFICATION TOKEN"}
            </button>
          ) : (
            <>
              <div className="instructions">
                <ol>
                  {challenge.instructions.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                {challenge.instructions.url && (
                  <div className="block mt">
                    <div className="label">Expected URL</div>
                    <pre>{challenge.instructions.url}</pre>
                  </div>
                )}
                {challenge.instructions.tag && (
                  <div className="block mt">
                    <div className="label">Meta tag to add</div>
                    <pre>{challenge.instructions.tag}</pre>
                  </div>
                )}
                {challenge.instructions.headerName && (
                  <div className="block mt">
                    <div className="label">Header to set</div>
                    <pre>{challenge.instructions.headerName}: {challenge.token}</pre>
                  </div>
                )}
                {challenge.instructions.record && (
                  <div className="block mt">
                    <div className="label">DNS record</div>
                    <pre>{challenge.instructions.record}</pre>
                  </div>
                )}
                {isEmail && (
                  <div className="block mt">
                    <div className="label">Sent to</div>
                    <pre>{challenge.deliveredTo}</pre>
                  </div>
                )}
              </div>
              <div
                className="token-box"
                onClick={() => navigator.clipboard?.writeText(challenge.token)}
                title="Click to copy"
              >
                <small>TOKEN — click to copy</small>
                {challenge.token}
              </div>
              <div className="small dim" style={{ marginBottom: 14 }}>
                Expires {new Date(challenge.expiresAt).toLocaleTimeString()}.
                {!isEmail && " Once the token is live on your site, we auto-check every 8 seconds — or click now."}
                {isEmail && " Open the email and use the 6-digit code, or click the magic link in it."}
              </div>
              <button className="btn btn-primary" onClick={check} disabled={busy}>
                {busy ? "CHECKING..." : "✓ VERIFY & UNLOCK FULL CHECK"}
              </button>
              {!isEmail && <div className="small dim mt" style={{ fontSize: 11 }}>Auto-polling enabled — no need to click repeatedly.</div>}
            </>
          )}

          {status && (
            <div className={`mt ${statusKind === "ok" ? "green" : "red"}`} style={{ fontSize: 13 }}>
              {statusKind === "ok" ? "> " : "! "}
              {status}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

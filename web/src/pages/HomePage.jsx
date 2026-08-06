import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { HERO_ART } from "../theme.js";
import { api, warmUpBackend } from "../api.js";

export default function HomePage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [depth, setDepth] = useState(25);
  const [mode, setMode] = useState("passive");
  const [consent, setConsent] = useState(false);
  const [consentTouched, setConsentTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [backendReady, setBackendReady] = useState(true);

  useEffect(() => {
    warmUpBackend().then((ok) => setBackendReady(ok)).catch(() => {});
  }, []);

  async function startScan(e) {
    e.preventDefault();
    setError("");
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = "https://" + normalized;
    }
    if (!/^https?:\/\/[^\s]+\.[^\s]+/i.test(normalized)) {
      setError("Enter a valid URL, e.g. https://yoursite.com");
      return;
    }
    if (!consent) {
      setConsentTouched(true);
      setError("Confirm that you own the site or have written permission to test it.");
      return;
    }
    setBusy(true);
    try {
      const scan = await api.createScan({
        url: normalized,
        mode,
        crawlDepth: depth,
        consent: { agreed: true, statement: "I own this site or have written permission to test it." },
      });
      navigate(`/scan/${scan.scanId}`);
    } catch (err) {
      const msg = err.message || "Failed to connect to the server.";
      if (msg.includes("fetch") || msg.includes("network") || msg.includes("waking")) {
        setError("The scan server is waking up from sleep mode. Please wait a few seconds and try again.");
      } else {
        setError(msg);
      }
      setBusy(false);
    }
  }

  return (
    <>
      <section className="hero">
        <pre className="hero-art">{HERO_ART}</pre>
        <h1>
          REVERSE-ENGINEER <span className="accent">ANY</span> SITE.
          <br />
          FIND <span className="accent-cyan">EVERYTHING</span> BROKEN.
        </h1>
        <p className="sub">
          Paste a URL. We crawl every page, rip open the source code, hunt exposed
          endpoints, secrets &amp; known vulnerabilities — then give you a detailed list
          with <code>exactly how to fix it</code>.
        </p>
      </section>

      <form className="console" onSubmit={startScan}>
        <div className="console-title">
          <span className="traffic">
            <span className="t g" />
            <span className="t a" />
            <span className="t r" />
          </span>
          <span>scan_target.exe — new instance</span>
        </div>
        <div className="console-body">
          <div className="field">
            <div className="field-label">
              <span>Target URL</span>
              <span className="hint">https://</span>
            </div>
            <input
              className={`url-input ${error && !url ? "invalid" : ""}`}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-website.com"
              spellCheck={false}
              autoComplete="off"
              autoFocus
            />
            <div className="url-prefix">// only this host is scanned · off-site requests are never made</div>
          </div>

          <div className="row-options">
            <div className="option-block">
              <label>Scan depth</label>
              <div className="depth">
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={depth}
                  onChange={(e) => setDepth(Number(e.target.value))}
                />
                <span className="depth-val">{depth}</span>
              </div>
            </div>
            <div className="option-block">
              <label>Mode</label>
              <div className="toggle">
                <button type="button" className={mode === "passive" ? "active" : ""} onClick={() => setMode("passive")}>
                  Passive
                </button>
                <button type="button" className={`locked ${mode === "full" ? "active" : ""}`} onClick={() => setMode("full")}>
                  Full 🔒
                </button>
              </div>
            </div>
          </div>

          <div className={`consent ${consentTouched && !consent ? "error" : ""}`}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} id="consent" />
            <label htmlFor="consent">
              I confirm I <strong>own this website</strong> or have <strong>written permission</strong> to test it.
              Unauthorized scanning is illegal. (Consent is recorded with timestamp &amp; IP.)
            </label>
          </div>

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "INITIALIZING..." : backendReady ? "▸ RUN SCAN" : "▸ RUN SCAN (server waking...)"}
          </button>

          {!backendReady && !error && (
            <div className="info-box" style={{ marginTop: 8 }}>i Scan server is waking up from sleep. First scan may take ~30 seconds.</div>
          )}
          {error && <div className="error-box">! {error}</div>}
        </div>
      </form>

      <div className="try-examples" style={{ margin: "20px 0", textAlign: "center" }}>
        <span className="small dim" style={{ display: "block", marginBottom: 10 }}>TRY SCANNING AN EXAMPLE:</span>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { label: "example.com", url: "https://example.com" },
            { label: "httpbin.org", url: "https://httpbin.org" },
            { label: "hackthissite.org", url: "https://hackthissite.org" },
            { label: "demo.testfire.net", url: "https://demo.testfire.net" },
          ].map((ex) => (
            <button
              key={ex.url}
              className="nav-pill"
              type="button"
              onClick={() => { setUrl(ex.url); document.querySelector(".url-input")?.focus(); }}
              style={{ cursor: "pointer",fontSize:12 }}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      <div className="how-wrap">
        <div className="how">
          <span className="how-n">01</span>
          <b>RUN SCAN</b>
          <span className="how-d">Instant passive scan — crawl, endpoints, secrets, headers, TLS, exposed files. No signup.</span>
        </div>
        <div className="how-arrow">→</div>
        <div className="how">
          <span className="how-n">02</span>
          <b>VERIFY OWNERSHIP</b>
          <span className="how-d">Place a token file / meta tag / header / DNS record on <i>your</i> site (works on *.vercel.app). We read it back.</span>
        </div>
        <div className="how-arrow">→</div>
        <div className="how">
          <span className="how-n">03</span>
          <b>FULL CHECK</b>
          <span className="how-d">Active injection tests, deep enumeration, source-map &amp; secret deep scan, authenticated areas, full endpoint table.</span>
        </div>
      </div>

      <div className="legal-warn">
        ⚠ LEGAL GATE: passive scans require the consent checkbox above. Active testing (Full Check) requires you to
        prove you control the site — we verify by fetching a token from your own website.
      </div>

      <div className="center small dim" style={{ marginTop: 18 }}>
        How it works, verification steps &amp; common fixes → <Link to="/faq" className="hl">FAQ</Link>
      </div>
    </>
  );
}

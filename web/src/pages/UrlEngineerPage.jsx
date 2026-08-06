import { useState } from "react";
import { api } from "../api.js";

const SUSPICIOUS_TLDS = new Set([".tk", ".ml", ".ga", ".cf", ".gq", ".xyz", ".top", ".work", ".click", ".loan", ".country", ".stream", ".kim"]);
const SHORTENERS = new Set(["bit.ly", "t.co", "goo.gl", "tinyurl.com", "ow.ly", "buff.ly", "is.gd", "short.url", "rb.gy", "shorte.st", "cutt.ly", "tiny.cc", "v.gd", "x.co", "cli.gs", "tr.im", "lnkd.in", "d.pr", "adf.ly", "rebrand.ly", "soo.gd", "snip.ly", "bl.ink"]);
const HOMOGRAPH_STARTS = [
  [0x0430, 0x044F], [0x03B1, 0x03C9], [0x04D0, 0x04FF], [0x0500, 0x052F],
  [0x0531, 0x0587], [0x0590, 0x05FF], [0x0600, 0x06FF], [0x0700, 0x074F],
  [0x0900, 0x097F], [0x0980, 0x09FF], [0x0A00, 0x0A7F], [0x0E00, 0x0E7F],
  [0x0E80, 0x0EFF], [0x1100, 0x11FF], [0x1200, 0x137F], [0x13A0, 0x13FF],
  [0x1400, 0x167F], [0x1680, 0x169F], [0x16A0, 0x16FF], [0x1700, 0x171F],
  [0x1720, 0x173F], [0x1740, 0x175F], [0x1760, 0x177F], [0x1780, 0x17FF],
  [0x1800, 0x18AF], [0x1900, 0x194F], [0x1950, 0x197F], [0x1980, 0x19DF],
  [0x1A00, 0x1A1F], [0x1B00, 0x1B7F], [0x1E00, 0x1EFF], [0x2000, 0x206F],
  [0x2070, 0x209F], [0x20A0, 0x20CF], [0x2C00, 0x2C5F], [0x2D30, 0x2D7F],
  [0xA000, 0xA4CF], [0xF900, 0xFAFF], [0xFE30, 0xFE4F], [0xFE70, 0xFEFF],
  [0xFF00, 0xFFEF], [0x10400, 0x1044F], [0x1F600, 0x1F64F]
];

function inHomographRange(cp) {
  if (cp >= 0x0400 && cp <= 0x04FF) return true;
  if (cp >= 0x0500 && cp <= 0x052F) return true;
  for (const [lo, hi] of HOMOGRAPH_STARTS) {
    if (cp >= lo && cp <= hi) return true;
  }
  return false;
}

function charName(cp) {
  if (cp >= 0x0400 && cp <= 0x04FF) return "Cyrillic";
  if (cp >= 0x0370 && cp <= 0x03FF) return "Greek";
  if (cp >= 0x0530 && cp <= 0x058F) return "Armenian";
  if (cp >= 0x0590 && cp <= 0x06FF) return "Hebrew/Arabic";
  if (cp >= 0x0E00 && cp <= 0x0EFF) return "Thai";
  if (cp >= 0x1100 && cp <= 0x11FF) return "Hangul";
  if (cp >= 0x1F600 && cp <= 0x1F64F) return "Emoji";
  if (cp >= 0x4E00 && cp <= 0x9FFF) return "CJK";
  if (cp >= 0x3040 && cp <= 0x30FF) return "Japanese";
  if (cp > 127 && cp < 256) return "Latin Extended";
  return cp > 127 ? "Non-ASCII" : "Latin";
}

function decodeUrl(str) {
  const out = [];
  let i = 0;
  while (i < str.length) {
    if (str[i] === "%" && i + 2 < str.length && /^[0-9A-Fa-f]{2}$/.test(str[i + 1] + str[i + 2])) {
      out.push({ enc: str.substring(i, i + 3), dec: String.fromCharCode(parseInt(str[i + 1] + str[i + 2], 16)) });
      i += 3;
    } else {
      i++;
    }
  }
  return out;
}

function parseTlds(hostname) {
  const parts = hostname.split(".");
  if (parts.length <= 1) return [];
  const found = [];
  for (let i = 1; i < parts.length; i++) {
    const tld = "." + parts.slice(i).join(".");
    if (SUSPICIOUS_TLDS.has(tld)) found.push(tld);
  }
  for (const t of SUSPICIOUS_TLDS) {
    if (hostname.endsWith(t) && !found.includes(t)) found.push(t);
  }
  return found;
}

function isIPHost(hostname) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.startsWith("[") && hostname.endsWith("]");
}

function detectTrackers(params) {
  const trackers = [];
  for (const [key, value] of Object.entries(params)) {
    const lk = key.toLowerCase();
    if (lk.startsWith("utm_") || lk === "utm_source" || lk === "utm_medium" || lk === "utm_campaign" || lk === "utm_term" || lk === "utm_content" || lk === "utm_id") {
      trackers.push({ platform: "Google Analytics (UTM)", param: key, value });
    } else if (lk === "fbclid") {
      trackers.push({ platform: "Facebook Ads", param: key, value });
    } else if (lk === "igshid") {
      trackers.push({ platform: "Instagram", param: key, value });
    } else if (lk === "gclid" || lk === "gclsrc" || lk === "dclid") {
      trackers.push({ platform: "Google Ads", param: key, value });
    } else if (lk === "twclid") {
      trackers.push({ platform: "Twitter/X Ads", param: key, value });
    } else if (lk.startsWith("hsa_") || lk === "_hsenc" || lk === "_hsmi") {
      trackers.push({ platform: "HubSpot", param: key, value });
    } else if (lk === "mc_cid" || lk === "mc_eid") {
      trackers.push({ platform: "Mailchimp", param: key, value });
    } else if (lk === "ref" || lk === "source" || lk === "affiliate" || lk === "click_id" || lk === "clid" || lk === "sc_campaign" || lk === "trk" || lk === "sms_ss" || lk === "aw_aff" || lk === "ibx_source" || lk === "mk_medium" || lk === "irclickid" || lk === "ig_share" || lk === "ttclid" || lk === "soc_src" || lk === "soc_trk" || lk.startsWith("cmp_")) {
      trackers.push({ platform: "Other Marketing", param: key, value });
    }
  }
  return trackers;
}

function isShortener(hostname) {
  return SHORTENERS.has(hostname);
}

function getParamObject(urlObj) {
  const params = {};
  if (urlObj.search) {
    urlObj.searchParams.forEach((v, k) => { params[k] = v; });
  }
  return params;
}

const BLOCK_STYLE = (bg, border, label) => ({
  background: bg,
  border: `1px solid ${border}`,
  color: "var(--text)",
  padding: "8px 14px",
  fontSize: 13,
  fontFamily: "var(--mono)",
  whiteSpace: "nowrap",
  display: "inline-block",
  position: "relative",
  marginRight: 2,
});

const BLOCK_LABEL = {
  fontSize: 9, position: "absolute", top: -16, left: 0, letterSpacing: 1,
  textTransform: "uppercase", whiteSpace: "nowrap",
};

export default function UrlEngineerPage() {
  const [rawUrl, setRawUrl] = useState("");
  const [urlObj, setUrlObj] = useState(null);
  const [decomposed, setDecomposed] = useState(null);
  const [error, setError] = useState("");

  const [redirectChain, setRedirectChain] = useState(null);
  const [redirectLoading, setRedirectLoading] = useState(false);
  const [redirectError, setRedirectError] = useState("");

  const [trackers, setTrackers] = useState(null);
  const [safetyFindings, setSafetyFindings] = useState(null);
  const [shortlinkResult, setShortlinkResult] = useState(null);
  const [shortlinkLoading, setShortlinkLoading] = useState(false);

  function analyze(url) {
    setError("");
    setRedirectChain(null);
    setRedirectError("");
    setTrackers(null);
    setSafetyFindings(null);
    setShortlinkResult(null);

    let u;
    try { u = new URL(url); }
    catch (e) { setError("Invalid URL — check format and try again."); setUrlObj(null); setDecomposed(null); return; }

    if (u.protocol !== "http:" && u.protocol !== "https:") {
      setError(`Unsupported protocol: ${u.protocol}. Use http:// or https:// URLs.`);
      setUrlObj(null);
      setDecomposed(null);
      return;
    }

    setUrlObj(u);
    setDecomposed({
      protocol: u.protocol + "//",
      subdomain: u.hostname.split(".").length > 2 ? u.hostname.substring(0, u.hostname.indexOf(".")) + "." : null,
      domain: u.hostname.split(".").length > 2 ? u.hostname.substring(u.hostname.indexOf(".") + 1) : u.hostname,
      port: u.port || null,
      path: u.pathname || "/",
      queryParams: getParamObject(u),
      fragment: u.hash || null,
      hostname: u.hostname,
    });

    const params = getParamObject(u);
    const t = detectTrackers(params);
    if (t.length > 0) setTrackers(t);

    const safety = [];
    if (u.href.length > 200) safety.push({ type: "warning", msg: `URL is very long (${u.href.length} chars) — may be suspicious.` });
    if (u.href.length > 500) safety.push({ type: "danger", msg: `URL is extremely long (${u.href.length} chars) — likely phishing.` });
    if (isIPHost(u.hostname)) safety.push({ type: "danger", msg: "Hostname is an IP address — common phishing indicator." });

    const suspiciousTlds = parseTlds(u.hostname);
    for (const tld of suspiciousTlds) {
      safety.push({ type: "danger", msg: `Suspicious TLD: ${tld} — often used for phishing and scams.` });
    }

    const encoded = decodeUrl(u.href);
    if (encoded.length > 0) {
      safety.push({ type: "warning", msg: `URL contains ${encoded.length} URL-encoded character(s).` });
    }

    let specialCount = 0;
    const seen = new Set();
    for (const ch of u.href) {
      if ("%@#!$^&*()+=[]{}|;':\",<>?\\/`~".includes(ch) && !seen.has(ch)) {
        seen.add(ch);
        specialCount++;
      }
    }
    if (specialCount > 8) safety.push({ type: "warning", msg: `${specialCount} special characters in URL.` });

    const homographChars = [];
    let hasLatin = false;
    for (const ch of u.hostname) {
      const cp = ch.codePointAt(0);
      if (cp <= 127) hasLatin = true;
      else if (inHomographRange(cp)) {
        homographChars.push({ char: ch, cp, name: charName(cp) });
      }
    }
    if (hasLatin && homographChars.length > 0) {
      safety.push({ type: "danger", msg: `Homograph attack detected! ${homographChars.length} non-Latin character(s) mixed with Latin in hostname.`, detail: homographChars });
    }

    if (["data:", "javascript:", "vbscript:"].some(p => u.href.toLowerCase().startsWith(p))) {
      safety.push({ type: "danger", msg: `Potentially dangerous URI scheme: ${u.protocol}` });
    }

    if (safety.length > 0) setSafetyFindings(safety);

    if (isShortener(u.hostname)) {
      setShortlinkLoading(true);
      expandShortlink(u.href).finally(() => setShortlinkLoading(false));
    }
  }

  async function followRedirects() {
    if (!rawUrl.trim()) return;
    setRedirectLoading(true);
    setRedirectError("");
    setRedirectChain(null);
    try {
      const result = await api.urlEngineerFollow(rawUrl.trim());
      setRedirectChain(result);
    } catch (err) {
      setRedirectError(err.message || "Failed to follow redirects.");
    } finally {
      setRedirectLoading(false);
    }
  }

  async function expandShortlink(href) {
    try {
      const r = await api.urlEngineerFollow(href);
      if (r.chain.length > 0) {
        setShortlinkResult({ chain: r.chain, finalUrl: r.finalUrl });
      }
    } catch {
      setShortlinkResult(null);
    }
  }

  const statusColor = (s) => s >= 200 && s < 300 ? "var(--green)" : s >= 300 && s < 400 ? "var(--amber)" : s >= 400 && s < 500 ? "var(--magenta)" : "var(--red)";

  const hasProtocol = rawUrl.trim().startsWith("https://") || rawUrl.trim().startsWith("http://");
  const autoUrl = hasProtocol ? rawUrl.trim() : (rawUrl.trim() ? "https://" + rawUrl.trim() : "");

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 10px" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, marginBottom: 6, letterSpacing: -0.5 }}>
          URL <span className="accent">ENGINEER</span>
        </h1>
        <p className="sub" style={{ maxWidth: 700, margin: "0 auto" }}>
          Decompose, trace redirects, detect trackers, and analyze safety of any URL.
        </p>
      </div>

      {/* URL Input */}
      <div className="console" style={{ marginBottom: 24 }}>
        <div className="console-title">
          <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
          <span>url_engineer.exe // paste target URL</span>
        </div>
        <div className="console-body">
          <div className="field" style={{ marginBottom: 8 }}>
            <input type="text" className="url-input" placeholder="Paste a URL to analyze..." value={rawUrl}
              onChange={e => { setRawUrl(e.target.value); }}
              onKeyDown={e => { if (e.key === "Enter" && autoUrl) analyze(autoUrl); }}
            />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary" disabled={!rawUrl.trim()} onClick={() => analyze(autoUrl)}>
              Analyze URL
            </button>
            <button className="btn btn-ghost" disabled={!rawUrl.trim() || redirectLoading} onClick={followRedirects}>
              {redirectLoading ? <><span className="spinner" /> Following...</> : "Trace Redirects"}
            </button>
          </div>
          {error && <div className="error-box mt" style={{ marginTop: 12 }}>{error}</div>}
        </div>
      </div>

      {/* URL Decomposition */}
      {decomposed && (
        <div className="console" style={{ marginBottom: 20 }}>
          <div className="console-title">
            <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
            <span>URL DECOMPOSITION</span>
          </div>
          <div className="console-body">
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", rowGap: 24, padding: "12px 6px 0", marginBottom: 16 }}>
              <span style={BLOCK_STYLE("rgba(16,185,129,0.12)", "var(--green)")}>
                <span style={{ ...BLOCK_LABEL, color: "var(--green)" }}>Protocol</span>
                {decomposed.protocol}
              </span>
              {decomposed.subdomain && (
                <span style={BLOCK_STYLE("rgba(56,189,248,0.12)", "var(--cyan)")}>
                  <span style={{ ...BLOCK_LABEL, color: "var(--cyan)" }}>Subdomain</span>
                  {decomposed.subdomain}
                </span>
              )}
              <span style={BLOCK_STYLE("rgba(245,158,11,0.15)", "var(--amber)")}>
                <span style={{ ...BLOCK_LABEL, color: "var(--amber)" }}>Domain</span>
                {decomposed.domain}
              </span>
              {decomposed.port && (
                <span style={BLOCK_STYLE("rgba(244,63,94,0.12)", "var(--magenta)")}>
                  <span style={{ ...BLOCK_LABEL, color: "var(--magenta)" }}>Port</span>
                  {":"}{decomposed.port}
                </span>
              )}
              <span style={BLOCK_STYLE("rgba(156,163,175,0.1)", "var(--dim)")}>
                <span style={{ ...BLOCK_LABEL, color: "var(--dim)" }}>Path</span>
                {decomposed.path}
              </span>
              {decomposed.fragment && (
                <span style={BLOCK_STYLE("rgba(16,185,129,0.1)", "var(--green-dim)")}>
                  <span style={{ ...BLOCK_LABEL, color: "var(--green-dim)" }}>Fragment</span>
                  {decomposed.fragment}
                </span>
              )}
            </div>

            {/* Query string params */}
            {Object.keys(decomposed.queryParams).length > 0 && (
              <div style={{ borderTop: "1px dashed var(--line)", paddingTop: 14, marginTop: 4 }}>
                <div className="small" style={{ color: "var(--cyan)", marginBottom: 8, letterSpacing: 1 }}>
                  QUERY PARAMETERS ({Object.keys(decomposed.queryParams).length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {Object.entries(decomposed.queryParams).map(([k, v]) => (
                    <span key={k} style={{
                      background: "var(--panel-2)", border: "1px solid var(--line)", padding: "4px 10px",
                      fontSize: 12, fontFamily: "var(--mono)", display: "inline-flex", gap: 6, alignItems: "center"
                    }}>
                      <span style={{ color: "var(--cyan)", fontWeight: 700 }}>{k}</span>
                      <span style={{ color: "var(--dim)" }}>=</span>
                      <span style={{ color: "var(--text)", wordBreak: "break-all", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{v}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* URL-encoded chars */}
            <div style={{ marginTop: 12 }}>
              <div className="small dim" style={{ marginBottom: 4 }}>
                Raw URL: <code style={{ color: "var(--cyan)", wordBreak: "break-all" }}>{urlObj.href}</code>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Redirect Chain */}
      {redirectError && (
        <div className="console" style={{ marginBottom: 20, borderColor: "var(--red)" }}>
          <div className="console-title">
            <span className="traffic"><span className="t r" /><span className="t r" /><span className="t r" /></span>
            <span>REDIRECT TRACE ERROR</span>
          </div>
          <div className="console-body" style={{ color: "var(--red)" }}>{redirectError}</div>
        </div>
      )}
      {redirectChain && (
        <div className="console" style={{ marginBottom: 20 }}>
          <div className="console-title">
            <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
            <span>REDIRECT CHAIN // {redirectChain.hopCount} hop{redirectChain.hopCount !== 1 ? "s" : ""}</span>
            <span style={{ marginLeft: "auto", fontSize: 11 }}>
              {redirectChain.isRedirect ? "Redirect Detected" : "No Redirect"}
            </span>
          </div>
          <div className="console-body">
            {redirectChain.chain.map((hop, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: i < redirectChain.chain.length - 1 ? 6 : 0 }}>
                {i > 0 && (
                  <div style={{
                    fontSize: 16, color: "var(--dim)", minWidth: 80, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center"
                  }}>
                    <span style={{ color: "var(--dim)", fontWeight: 700 }}>&#8595;</span>
                  </div>
                )}
                <div style={{
                  flex: 1, background: "var(--panel-2)", border: `1px solid ${statusColor(hop.status) || "var(--line)"}`,
                  borderLeftWidth: 3, padding: "10px 14px", display: "flex", gap: 12, alignItems: "flex-start"
                }}>
                  <div style={{ minWidth: 52, textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: statusColor(hop.status) || "var(--dim)", lineHeight: 1 }}>
                      {hop.status || "ERR"}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--dim-2)", letterSpacing: 1, marginTop: 2 }}>
                      {hop.status >= 300 && hop.status < 400 ? "REDIRECT" : hop.status >= 200 && hop.status < 300 ? "OK" : hop.status === 0 ? "ERROR" : "STATUS"}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontFamily: "var(--mono)", color: "var(--cyan)", wordBreak: "break-all", lineHeight: 1.4 }}>
                      {hop.url}
                    </div>
                    {hop.location && (
                      <div style={{ marginTop: 4, fontSize: 11, color: "var(--amber)", wordBreak: "break-all" }}>
                        Location: {hop.location}
                      </div>
                    )}
                    {hop.server && (
                      <div className="small dim" style={{ marginTop: 3 }}>
                        Server: {hop.server}
                      </div>
                    )}
                    {hop.error && (
                      <div style={{ marginTop: 4, fontSize: 11, color: "var(--red)" }}>{hop.error}</div>
                    )}
                  </div>
                  <div style={{ fontSize: 20, color: "var(--dim)", opacity: 0.4 }}>
                    {i + 1}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tracking Detection */}
      {trackers && (
        <div className="console" style={{ marginBottom: 20 }}>
          <div className="console-title">
            <span className="traffic"><span className="t a" /><span className="t a" /><span className="t r" /></span>
            <span>TRACKING DETECTION // {trackers.length} tracking param{trackers.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="console-body">
            <div style={{ display: "grid", gap: 8 }}>
              {trackers.map((t, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "8px 12px",
                  background: "var(--panel-2)", border: "1px solid var(--line)", fontSize: 13
                }}>
                  <span style={{
                    fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--bg)",
                    background: "var(--amber)", padding: "3px 8px", fontWeight: 700, whiteSpace: "nowrap"
                  }}>
                    TRACKER
                  </span>
                  <span style={{ color: "var(--text)", fontWeight: 700, minWidth: 140, fontFamily: "var(--mono)" }}>
                    {t.param}
                  </span>
                  <span className="small dim" style={{ wordBreak: "break-all", color: "var(--cyan)" }}>
                    {t.value}
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--dim)", whiteSpace: "nowrap" }}>
                    {t.platform}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Shortlink Expansion */}
      {urlObj && isShortener(urlObj.hostname) && (
        <div className="console" style={{ marginBottom: 20 }}>
          <div className="console-title">
            <span className="traffic"><span className="t a" /><span className="t a" /><span className="t a" /></span>
            <span>SHORTLINK DETECTED // {urlObj.hostname}</span>
          </div>
          <div className="console-body">
            {shortlinkLoading ? (
              <div className="loading"><span className="spinner" /> Expanding shortlink...</div>
            ) : shortlinkResult ? (
              <>
                <div style={{ marginBottom: 10 }}>
                  <span className="small dim">Expanded destination:</span>
                  <div style={{ color: "var(--cyan)", fontFamily: "var(--mono)", fontSize: 13, wordBreak: "break-all", marginTop: 4 }}>
                    {shortlinkResult.finalUrl}
                  </div>
                </div>
                {shortlinkResult.chain.length > 1 && (
                  <div className="small dim" style={{ marginTop: 8 }}>
                    {shortlinkResult.chain.length - 1} redirect hop(s) followed.
                  </div>
                )}
              </>
            ) : (
              <div className="dim">Could not expand — try "Trace Redirects" to see the chain.</div>
            )}
          </div>
        </div>
      )}

      {/* Safety Check */}
      {safetyFindings && (
        <div className="console" style={{ marginBottom: 20 }}>
          <div className="console-title">
            <span className="traffic"><span className="t r" /><span className="t r" /><span className="t r" /></span>
            <span>SAFETY CHECK // {safetyFindings.length} issue{safetyFindings.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="console-body">
            <div style={{ display: "grid", gap: 8 }}>
              {safetyFindings.map((s, i) => (
                <div key={i} style={{
                  display: "flex", flexDirection: "column", gap: 6, padding: "10px 14px",
                  background: s.type === "danger" ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
                  border: `1px solid ${s.type === "danger" ? "var(--red)" : "var(--amber)"}`,
                  borderLeftWidth: 3
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--bg)",
                      background: s.type === "danger" ? "var(--red)" : "var(--amber)", padding: "3px 8px", fontWeight: 700
                    }}>
                      {s.type === "danger" ? "DANGER" : "WARNING"}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--text)", flex: 1 }}>{s.msg}</span>
                  </div>
                  {s.detail && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {s.detail.map((hc, j) => (
                        <span key={j} style={{
                          background: "var(--panel-2)", border: "1px solid var(--line)", padding: "2px 8px",
                          fontSize: 11, fontFamily: "var(--mono)", display: "inline-flex", gap: 6
                        }}>
                          <span style={{ color: "var(--red)" }}>{hc.char}</span>
                          <span className="dim">U+{hc.cp.toString(16).toUpperCase().padStart(4, "0")}</span>
                          <span className="small" style={{ color: "var(--cyan)" }}>{hc.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

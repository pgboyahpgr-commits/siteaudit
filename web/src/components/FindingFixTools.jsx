import { useState } from "react";
import { api } from "../api.js";

const STOP = new Set(["the","a","an","is","are","was","were","be","been","to","of","in","on","at","for","with","and","or","not","no","your","you","this","that","it","its","has","have","had","from","by","as","can","could","may","might","detected","found","exposed","missing"]);

function buildQuery(f) {
  const words = (f.title || "").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w.toLowerCase()) && !/^[0-9]+$/.test(w));
  let q = words.slice(0, 6).join(" ");
  if (q.length > 60) q = q.slice(0, 60).trim();
  return `${q} how to fix`;
}

function buildFixPrompt(f, targetUrl) {
  return [
    `You are a senior application security engineer. The website ${targetUrl} was scanned by SiteAudit and has this issue:`,
    ``,
    `SEVERITY: ${(f.severity || "info").toUpperCase()}`,
    `CATEGORY: ${f.category || "unknown"}`,
    `TITLE: ${f.title || "Untitled finding"}`,
    `WHAT IT MEANS: ${f.description || "—"}`,
    `EVIDENCE: ${f.evidence ? f.evidence.slice(0, 600) : "—"}`,
    f.cveId ? `CVE: ${f.cveId}` : null,
    f.fix ? `BASELINE FIX: ${f.fix}` : null,
    ``,
    `Give me a precise, copy-paste-ready fix for THIS exact issue: the exact code, config, or headers to change, the file(s) to edit, why it matters in 2 sentences, and how to verify the fix worked. Be specific — no generic advice.`,
  ].filter(Boolean).join("\n");
}

export default function FindingFixTools({ scanId, finding }) {
  const [videos, setVideos] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function loadTutorial() {
    setBusy(true);
    try {
      const d = await api.getVideos(scanId, buildQuery(finding));
      setVideos(d.videos);
    } catch {
      setVideos([]);
    } finally {
      setBusy(false);
    }
  }

  async function copyPrompt() {
    const prompt = buildFixPrompt(finding, window.location.origin);
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = prompt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="block tools">
      <div className="label">AI FIX HELP</div>
      <div className="btn-row" style={{ gap: 8 }}>
        <button className="btn btn-ghost btn-xs" onClick={loadTutorial} disabled={busy}>
          {busy ? "SEARCHING..." : "▶ WATCH TUTORIAL"}
        </button>
        <button className="btn btn-ghost btn-xs" onClick={copyPrompt}>
          {copied ? "✓ COPIED" : "⧉ COPY AI FIX PROMPT"}
        </button>
      </div>
      {videos && (
        <div className="vid-row" style={{ marginTop: 10 }}>
          {videos.length === 0 && <span className="small dim">No tutorials found for this one — paste the AI prompt into any AI chat instead.</span>}
          {videos.map((v) => (
            <a key={v.id} className="vid-card" href={v.fullUrl} target="_blank" rel="noreferrer">
              <div className="vid-thumb">
                {v.thumbnail ? <img src={v.thumbnail} alt="" loading="lazy" /> : <span className="vid-play">▶</span>}
                <span className="vid-play-badge">▶</span>
              </div>
              <div className="vid-info">
                <div className="vid-title">{v.title}</div>
                <div className="vid-author">{v.author}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

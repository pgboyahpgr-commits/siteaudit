import { useState, useEffect } from "react";
import { api } from "../api.js";

function VideoCard({ v }) {
  return (
    <a className="vid-card" href={v.fullUrl} target="_blank" rel="noreferrer">
      <div className="vid-thumb">
        {v.thumbnail ? <img src={v.thumbnail} alt="" loading="lazy" /> : <span className="vid-play">▶</span>}
        <span className="vid-play-badge">▶</span>
      </div>
      <div className="vid-info">
        <div className="vid-title">{v.title}</div>
        <div className="vid-author">{v.author}</div>
      </div>
    </a>
  );
}

export default function VideoGuides({ scanId }) {
  const [issues, setIssues] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setErr("");
    try {
      const d = await api.getVideos(scanId);
      setIssues(d.issues);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId]);

  return (
    <div className="console mt">
      <div className="console-title">
        <span className="traffic">
          <span className="t g" />
          <span className="t a" />
          <span className="t r" />
        </span>
        <span>VIDEO FIX GUIDES — <span className="dim">watch &amp; learn how to fix each issue</span></span>
        <button className="btn btn-ghost btn-xs" onClick={load} disabled={busy}>
          {busy ? "SEARCHING..." : "↻ REFRESH"}
        </button>
      </div>
      <div className="console-body">
        {err && <div className="error-box">{err}</div>}
        {!issues && !err && <div className="small dim">loading fix guides via youtube search...</div>}
        {issues && issues.length === 0 && (
          <div className="small dim">No fix guides found. Try the tutorial button on individual findings.</div>
        )}
        {issues?.map((it) => (
          <div key={it.findingId} className="vg-issue">
            <div className="vg-head">
              <span className={`sev s-${it.severity}`}>{it.severity}</span>
              <span className="vg-title">{it.title}</span>
              <span className="vg-query dim">searched: "{it.query}"</span>
            </div>
            <div className="vid-row">
              {it.videos?.map((v) => <VideoCard key={v.id} v={v} />)}
              {(!it.videos || it.videos.length === 0) && <span className="small dim">no videos returned for this query.</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

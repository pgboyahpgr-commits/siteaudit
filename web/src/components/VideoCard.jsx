import { useState } from "react";

export default function VideoCard({ v }) {
  const [play, setPlay] = useState(false);

  if (play) {
    return (
      <div className="vid-embed">
        <div className="vid-embed-top">
          <span className="vid-title">{v.title}</span>
          <button className="vid-embed-x" onClick={() => setPlay(false)} aria-label="Close player">
            ✕
          </button>
        </div>
        <iframe
          className="vid-iframe"
          src={`${v.embedUrl}&autoplay=1`}
          title={v.title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        ></iframe>
      </div>
    );
  }

  return (
    <div className="vid-card" role="button" tabIndex={0} onClick={() => setPlay(true)} onKeyDown={(e) => e.key === "Enter" && setPlay(true)}>
      <div className="vid-thumb">
        {v.thumbnail ? <img src={v.thumbnail} alt="" loading="lazy" /> : <span className="vid-play">▶</span>}
        <span className="vid-play-badge">▶ PLAY</span>
      </div>
      <div className="vid-info">
        <div className="vid-title">{v.title}</div>
        <div className="vid-author">{v.author}</div>
        <a className="vid-watch" href={v.fullUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          watch on YouTube ↗
        </a>
      </div>
    </div>
  );
}
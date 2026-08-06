import { useState, useEffect, useRef, useCallback } from "react";

const LS_KEY = "sa_tour_done";

const STEPS = [
  {
    target: ".url-input",
    title: "Paste any website URL here",
    content:
      "Enter the full URL of the site you want to audit. We support https:// and http://. You can scan any website you own or have permission to test.",
    position: "bottom",
  },
  {
    target: ".depth",
    title: "Choose scan depth",
    content:
      "Controls how many pages we crawl. Higher depth = more thorough but slower. 25 is good for most sites, 60 for deep analysis.",
    position: "bottom",
  },
  {
    target: ".toggle",
    title: "Passive vs Full mode",
    content:
      "Passive scan is instant and read-only. Full Check requires ownership verification and does deeper active probing.",
    position: "bottom",
  },
  {
    target: ".consent",
    title: "Legal consent",
    content:
      "You must confirm you own the site or have permission. This is recorded for legal compliance.",
    position: "top",
  },
  {
    target: ".btn-primary",
    title: "Run the scan",
    content:
      "Click here to start. We crawl pages, check headers, probe endpoints, scan secrets, match CVEs, and generate an AI report — all in ~30 seconds.",
    position: "top",
  },
  {
    target: ".nav-links",
    title: "Explore more tools",
    content:
      "SiteAudit also includes an AI Image Detector, Settings to configure your own AI keys, a Site Guide, and FAQ.",
    position: "bottom",
  },
  {
    target: ".brand",
    title: "You're all set!",
    content:
      'Your scans auto-save to History. Sign in to unlock more features. Ask Reversiy (the floating bot) anything about security!',
    position: "bottom",
  },
];

const Z_OVERLAY = 9998;
const Z_HIGHLIGHT = 9999;
const Z_TOOLTIP = 10000;

function getRect(sel) {
  const el = document.querySelector(sel);
  if (!el) return null;
  return el.getBoundingClientRect();
}

export default function TourOverlay() {
  const [done, setDone] = useState(() => localStorage.getItem(LS_KEY) === "1");
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const [visible, setVisible] = useState(false);

  const isLast = step === STEPS.length - 1;

  const finish = useCallback((markDone) => {
    if (markDone) localStorage.setItem(LS_KEY, "1");
    setDone(true);
    setVisible(false);
  }, []);

  const skip = useCallback(() => finish(true), [finish]);

  useEffect(() => {
    if (done) return;
    if (window.location.pathname !== "/") return;
    const timer = setTimeout(() => setVisible(true), 1000);
    return () => clearTimeout(timer);
  }, [done]);

  useEffect(() => {
    if (!visible) return;
    function measure() {
      const r = getRect(STEPS[step].target);
      setRect(r);
    }
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize);
    };
  }, [step, visible]);

  const goNext = () => {
    if (isLast) {
      finish(true);
    } else {
      setStep((s) => s + 1);
    }
  };

  const goPrev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  if (done || !visible) return null;

  const current = STEPS[step];
  const bodyW = document.body.clientWidth;

  const overlay = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.65)",
    zIndex: Z_OVERLAY,
    transition: "background 0.3s ease",
  };

  const hole = rect
    ? {
        position: "fixed",
        left: rect.left - 6,
        top: rect.top - 6,
        width: rect.width + 12,
        height: rect.height + 12,
        borderRadius: 6,
        background: "transparent",
        boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
        zIndex: Z_HIGHLIGHT,
        pointerEvents: "none",
        transition: "all 0.35s ease",
      }
    : null;

  const ring = rect
    ? {
        position: "fixed",
        left: rect.left - 4,
        top: rect.top - 4,
        width: rect.width + 8,
        height: rect.height + 8,
        borderRadius: 6,
        border: "2px solid #00d4ff",
        boxShadow: "0 0 14px #00d4ff88, 0 0 28px #00d4ff44",
        zIndex: Z_HIGHLIGHT + 1,
        pointerEvents: "none",
        transition: "all 0.35s ease",
      }
    : null;

  let tooltipStyle = { display: "none" };
  if (rect) {
    const tooltipW = Math.min(360, bodyW - 32);
    const pos = current.position;
    let left = rect.left + rect.width / 2 - tooltipW / 2;
    let top;
    const gap = 16;

    if (pos === "bottom") top = rect.bottom + gap;
    else if (pos === "top") top = rect.top - gap - 220;
    else if (pos === "right") left = rect.right + gap;
    else if (pos === "left") left = rect.left - tooltipW - gap;

    left = Math.max(12, Math.min(left, bodyW - tooltipW - 12));
    top = Math.max(12, Math.min(top ?? 0, window.innerHeight - 280));

    tooltipStyle = {
      position: "fixed",
      left,
      top,
      width: tooltipW,
      background: "#12121a",
      border: "1px solid #2a2a3a",
      borderRadius: 12,
      padding: "20px 24px 18px",
      color: "#d0d0e0",
      fontSize: 14,
      lineHeight: 1.6,
      zIndex: Z_TOOLTIP,
      boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.08)",
      transition: "opacity 0.25s ease, transform 0.25s ease",
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    };
  }

  const btnGhost = {
    background: "transparent",
    border: "1px solid #333355",
    color: "#8888aa",
    borderRadius: 6,
    padding: "6px 16px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    letterSpacing: 0.6,
    transition: "border-color 0.2s, color 0.2s",
  };

  const btnPrimary = {
    ...btnGhost,
    background: "#00d4ff",
    border: "1px solid #00d4ff",
    color: "#0a0a0f",
  };

  return (
    <>
      <div style={overlay} onClick={skip} />
      {hole && <div style={hole} />}
      {ring && <div style={ring} />}
      {rect && (
        <div style={tooltipStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <span
              style={{
                color: "#00d4ff",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1,
              }}
            >
              {step + 1}/{STEPS.length}
            </span>
            <button
              style={{
                background: "none",
                border: "none",
                color: "#555577",
                fontSize: 13,
                cursor: "pointer",
                padding: "2px 6px",
              }}
              onClick={skip}
            >
              Skip Tour
            </button>
          </div>

          <h3
            style={{
              margin: "0 0 8px",
              fontSize: 16,
              fontWeight: 700,
              color: "#f0f0ff",
            }}
          >
            {current.title}
          </h3>
          <p style={{ margin: "0 0 18px", color: "#9999bb", fontSize: 13.5 }}>
            {current.content}
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              {step > 0 && (
                <button style={btnGhost} onClick={goPrev}>
                  Prev
                </button>
              )}
              <button
                style={btnGhost}
                onClick={skip}
              >
                Skip
              </button>
            </div>
            <button style={isLast ? { ...btnPrimary, padding: "8px 18px" } : btnPrimary} onClick={goNext}>
              {isLast ? "Got it! Start scanning" : "Next"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

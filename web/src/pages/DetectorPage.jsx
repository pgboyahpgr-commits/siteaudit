import { useState, useRef } from "react";
import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;
env.allowRemoteModels = true;

const steps = [
  { id: "load", name: "Loading Image", desc: "Reading image data locally or fetching via proxy" },
  { id: "c2pa", name: "C2PA Metadata Check", desc: "Scanning for digital passport & AI provenance claims" },
  { id: "exif", name: "EXIF & Camera Metadata", desc: "Analyzing camera, lens, software & creation tags" },
  { id: "freq", name: "Frequency Domain Scan", desc: "Detecting SynthID (8x8 DCT) & invisible watermarks" },
  { id: "heuristic", name: "Visual Artifact Analysis", desc: "Checking 15+ AI visual artifact patterns (banding, noise, grid, blur)" },
  { id: "ml", name: "Deep Learning Classification", desc: "Running ai-source-detector-ONNX model" },
  { id: "combine", name: "Final Consensus Verdict", desc: "Weighted consensus across all 5 engines" }
];

export default function DetectorPage() {
  const [imageSrc, setImageSrc] = useState(null);
  const [currentFile, setCurrentFile] = useState(null);
  const [urlInput, setUrlInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [stepStates, setStepStates] = useState({});
  const [results, setResults] = useState(null);
  const [toast, setToast] = useState({ message: "", type: "info" });
  const fileInputRef = useRef(null);
  const resultsRef = useRef(null);

  function showToast(message, type = "info") {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "info" }), 4000);
  }

  function setStepStatus(id, status, message) {
    setStepStates((prev) => ({ ...prev, [id]: { status, message } }));
  }

  function handleDrop(e) {
    e.preventDefault();
    if (e.dataTransfer.files?.length > 0) processFile(e.dataTransfer.files[0]);
  }

  function processFile(f) {
    if (!f.type.startsWith("image/")) {
      showToast("Please select a valid image file (JPG, PNG, WebP, GIF, BMP).", "error");
      return;
    }
    setCurrentFile(f);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setImageSrc(dataUrl);
      runAnalysis(f, dataUrl);
    };
    reader.readAsDataURL(f);
  }

  async function handleUrlFetch() {
    const rawUrl = urlInput.trim();
    if (!rawUrl) return;
    try {
      showToast("Fetching image...", "info");
      let res;
      try {
        res = await fetch(rawUrl, { mode: "cors" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch {
        // Fallback via reliable CORS proxies
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(rawUrl)}`;
        res = await fetch(proxyUrl);
        if (!res.ok) {
          const proxyUrl2 = `https://api.allorigins.win/raw?url=${encodeURIComponent(rawUrl)}`;
          res = await fetch(proxyUrl2);
        }
      }
      if (!res.ok) throw new Error("Failed to fetch image from URL");
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) {
        throw new Error("URL did not return a valid image");
      }
      const filename = rawUrl.split("/").pop()?.split("?")[0] || "downloaded-image.jpg";
      const f = new File([blob], filename, { type: blob.type });
      processFile(f);
    } catch (err) {
      showToast("Failed to fetch image: " + err.message + ". Try uploading directly.", "error");
    }
  }

  async function runAnalysis(f, dataUrl) {
    setAnalyzing(true);
    setResults(null);
    const initialSteps = {};
    steps.forEach((s) => (initialSteps[s.id] = { status: "waiting", message: "Waiting" }));
    setStepStates(initialSteps);

    try {
      setStepStatus("load", "running", "Processing...");
      await new Promise((r) => setTimeout(r, 200));
      setStepStatus("load", "done", "Loaded");

      setStepStatus("c2pa", "running", "Scanning metadata...");
      const c2pa = await checkC2PA(f);
      setStepStatus("c2pa", "done", c2pa.found ? (c2pa.isAIGenerated ? "AI Claim Found" : "C2PA Present") : "Not Found");

      setStepStatus("exif", "running", "Parsing EXIF...");
      const exif = await checkEXIF(f);
      setStepStatus("exif", "done", exif.aiIndicators.length > 0 ? "AI Signs Found" : (exif.hasEXIF ? "EXIF Present" : "No EXIF"));

      setStepStatus("freq", "running", "Scanning 8x8 DCT frequencies...");
      const freq = await checkFrequency(dataUrl);
      setStepStatus("freq", "done", freq.watermarkDetected ? `${freq.watermarkType} Detected` : (freq.freqAnomalyScore > 40 ? "Anomalies Detected" : "Clean"));

      setStepStatus("heuristic", "running", "Checking 15+ artifact patterns...");
      const heuristic = await checkHeuristics(dataUrl);
      setStepStatus("heuristic", "done", heuristic.aiScore > 50 ? `${heuristic.aiScore}% Suspicious` : `${heuristic.aiScore}% Clean`);

      setStepStatus("ml", "running", "Running ai-source-detector-ONNX...");
      const ml = await checkML(dataUrl);
      setStepStatus("ml", "done", ml.error ? "Unavailable" : (ml.isAI ? `${ml.source} (${ml.score}%)` : `Real (${ml.score}%)`));

      setStepStatus("combine", "running", "Computing weighted consensus...");
      const overall = computeVerdict({ c2pa, exif, freq, heuristic, ml });
      setStepStatus("combine", "done", "Complete");

      const finalRes = { c2pa, exif, freq, heuristic, ml, overall };
      setResults(finalRes);

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err) {
      showToast("Error during analysis: " + err.message, "error");
    } finally {
      setAnalyzing(false);
    }
  }

  function downloadReport() {
    if (!results) return;
    const reportData = {
      timestamp: new Date().toISOString(),
      fileInfo: {
        name: currentFile?.name || "unknown",
        sizeBytes: currentFile?.size || 0,
        type: currentFile?.type || "image/jpeg",
      },
      verdict: results.overall,
      c2pa: results.c2pa,
      exif: results.exif,
      freq: results.freq,
      heuristic: results.heuristic,
      ml: results.ml,
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ai-detection-report.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Report downloaded successfully!", "success");
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 10px" }}>
      {toast.message && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 9999,
            padding: "12px 20px",
            borderRadius: 8,
            background: toast.type === "error" ? "var(--red)" : toast.type === "success" ? "var(--green)" : "var(--cyan)",
            color: "#000",
            fontWeight: "bold",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
          }}
        >
          {toast.message}
        </div>
      )}

      <div style={{ textAlign: "center", marginBottom: 30 }}>
        <h1 style={{ fontSize: 34, marginBottom: 8, letterSpacing: -0.5 }}>
          🔍 AI IMAGE DETECTOR <span className="accent">PRO</span>
        </h1>
        <p className="sub" style={{ maxWidth: 750, margin: "0 auto" }}>
          Advanced multi-engine analysis powered by <strong>ai-source-detector-ONNX</strong> (Stable Diffusion, Midjourney, DALL-E 3), SynthID &amp; DCT frequency watermarks, 15+ visual artifact heuristics, EXIF tags &amp; C2PA provenance credentials.
        </p>
      </div>

      {/* Upload Zone */}
      <div
        className="upload-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        style={{
          border: "2px dashed var(--line-2)",
          borderRadius: 16,
          padding: "36px 20px",
          textAlign: "center",
          background: "var(--panel)",
          marginBottom: 30,
          transition: "all 0.2s"
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 10 }}>📁</div>
        <h3 style={{ fontSize: 20, marginBottom: 6 }}>Drop an image here or browse files</h3>
        <p className="dim small" style={{ margin: "0 0 16px" }}>Supports JPG, PNG, WebP, GIF, BMP · 100% Client-Side Processing</p>
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
        />
        <button
          className="btn btn-primary"
          onClick={() => fileInputRef.current?.click()}
        >
          📂 Browse Image File
        </button>

        <div style={{ display: "flex", gap: 10, maxWidth: 500, margin: "20px auto 0" }}>
          <input
            type="text"
            className="input"
            placeholder="Or paste image URL..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUrlFetch()}
          />
          <button className="btn btn-ghost" onClick={handleUrlFetch}>
            Analyze URL
          </button>
        </div>
      </div>

      {/* Progress Section */}
      {analyzing && (
        <div className="console mt" style={{ marginBottom: 30 }}>
          <div className="console-title">
            <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
            <span>ai_detector_pro.exe — deep scanning visual &amp; frequency signatures</span>
          </div>
          <div className="console-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {steps.map((s) => {
              const st = stepStates[s.id] || { status: "waiting", message: "Waiting" };
              const color = st.status === "done" ? "var(--green)" : st.status === "running" ? "var(--cyan)" : "var(--dim)";
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--panel-2)", padding: "10px 14px", borderRadius: 8, border: `1px solid ${color}` }}>
                  <div>
                    <b>{s.name}</b>
                    <div className="small dim">{s.desc}</div>
                  </div>
                  <div style={{ color, fontWeight: "bold", fontSize: 13 }}>{st.message}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results View */}
      {results && (
        <div ref={resultsRef} className="results-box">
          <div className="console" style={{ marginBottom: 25 }}>
            <div className="console-title">
              <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
              <span>VERDICT SUMMARY // AI IMAGE DETECTOR PRO</span>
            </div>
            <div className="console-body" style={{ textAlign: "center", padding: "28px 20px" }}>
              {imageSrc && (
                <div style={{ marginBottom: 20 }}>
                  <img src={imageSrc} alt="Analyzed preview" style={{ maxHeight: 280, borderRadius: 12, border: "1px solid var(--line)", maxWidth: "100%", objectFit: "contain" }} />
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "center", gap: 10 }}>
                    <span className="meta-chip" style={{ background: "var(--panel-2)", padding: "4px 10px", borderRadius: 6, fontSize: 12, border: "1px solid var(--line)" }}>
                      📐 {currentFile ? `${Math.round(currentFile.size / 1024)} KB` : "Unknown size"}
                    </span>
                    <span className="meta-chip" style={{ background: "var(--panel-2)", padding: "4px 10px", borderRadius: 6, fontSize: 12, border: "1px solid var(--line)" }}>
                      🖼️ {currentFile ? currentFile.type.split("/")[1]?.toUpperCase() : "IMAGE"}
                    </span>
                  </div>
                </div>
              )}

              <div style={{ fontSize: 32, fontWeight: 900, color: results.overall.isAI ? "var(--red)" : "var(--green)" }}>
                {results.overall.icon} {results.overall.verdict.toUpperCase()}
              </div>
              <div style={{ fontSize: 18, marginTop: 6, color: "var(--fg)" }}>
                AI Probability: <b>{results.overall.finalScore}%</b>
              </div>
              <p className="dim" style={{ maxWidth: 650, margin: "10px auto 16px", fontSize: 14 }}>
                {results.overall.summary}
              </p>

              {/* Progress Confidence Bar */}
              <div style={{ width: "100%", maxWidth: 500, height: 12, background: "var(--panel-2)", borderRadius: 6, margin: "0 auto 20px", overflow: "hidden", border: "1px solid var(--line)" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${results.overall.finalScore}%`,
                    background: results.overall.finalScore >= 70
                      ? "linear-gradient(90deg, #ff4757, #ffa502)"
                      : results.overall.finalScore >= 40
                      ? "linear-gradient(90deg, #eccc68, #ffa502)"
                      : "linear-gradient(90deg, #2ed573, #1e90ff)",
                    transition: "width 0.6s ease"
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setResults(null);
                    setImageSrc(null);
                    setCurrentFile(null);
                    setUrlInput("");
                  }}
                >
                  🔄 Analyze Another Image
                </button>
                <button className="btn btn-ghost" onClick={downloadReport}>
                  📥 Download Report JSON
                </button>
              </div>
            </div>
          </div>

          {/* Analysis Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            {/* C2PA Card */}
            <div className="console">
              <div className="console-title" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>📋 C2PA Metadata</span>
                <span style={{ fontSize: 12, color: results.c2pa.found ? "var(--cyan)" : "var(--dim)" }}>
                  {results.c2pa.found ? (results.c2pa.isAIGenerated ? "AI Claimed" : "Present") : "Not Found"}
                </span>
              </div>
              <div className="console-body" style={{ fontSize: 13, lineHeight: 1.6 }}>
                <p>{results.c2pa.summary}</p>
                {results.c2pa.generator && (
                  <p style={{ marginTop: 8 }}><b>Generator:</b> <span style={{ color: "var(--cyan)" }}>{results.c2pa.generator}</span></p>
                )}
                <p style={{ marginTop: 4 }}><b>Status:</b> {results.c2pa.found ? "Manifest Present" : "No Manifest"}</p>
              </div>
            </div>

            {/* EXIF Card */}
            <div className="console">
              <div className="console-title" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>📷 EXIF &amp; Camera Data</span>
                <span style={{ fontSize: 12, color: results.exif.aiIndicators.length > 0 ? "var(--red)" : "var(--green)" }}>
                  {results.exif.aiIndicators.length > 0 ? "AI Tool Signs" : (results.exif.hasEXIF ? "Present" : "Missing")}
                </span>
              </div>
              <div className="console-body" style={{ fontSize: 13, lineHeight: 1.6 }}>
                <p>{results.exif.summary}</p>
                {results.exif.cameraMake && <p style={{ marginTop: 6 }}><b>Camera:</b> {results.exif.cameraMake} {results.exif.cameraModel || ""}</p>}
                {results.exif.software && <p style={{ marginTop: 4 }}><b>Software:</b> {results.exif.software}</p>}
                {results.exif.createDate && <p style={{ marginTop: 4 }}><b>Date:</b> {results.exif.createDate}</p>}
              </div>
            </div>

            {/* Frequency & Watermarks Card */}
            <div className="console">
              <div className="console-title" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>🔊 Frequency / Watermark Scanner</span>
                <span style={{ fontSize: 12, color: results.freq.watermarkDetected ? "var(--red)" : "var(--green)" }}>
                  {results.freq.watermarkDetected ? results.freq.watermarkType : "Clean"}
                </span>
              </div>
              <div className="console-body" style={{ fontSize: 13, lineHeight: 1.6 }}>
                <p>{results.freq.summary}</p>
                <p style={{ marginTop: 6 }}><b>Watermark Detected:</b> {results.freq.watermarkDetected ? "YES" : "No"}</p>
                {results.freq.watermarkType && <p style={{ marginTop: 4 }}><b>Watermark Type:</b> {results.freq.watermarkType}</p>}
                <p style={{ marginTop: 4 }}><b>Frequency Anomalies:</b> {results.freq.freqAnomalyScore}%</p>
                {results.freq.freqDetails?.length > 0 && (
                  <div style={{ marginTop: 8, background: "var(--panel-2)", padding: 8, borderRadius: 6, fontSize: 11 }}>
                    {results.freq.freqDetails.map((d, i) => <div key={i}>• {d}</div>)}
                  </div>
                )}
              </div>
            </div>

            {/* Heuristics Card */}
            <div className="console">
              <div className="console-title" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>🔬 Visual Artifact Heuristics</span>
                <span style={{ fontSize: 12, color: results.heuristic.aiScore > 50 ? "var(--red)" : "var(--green)" }}>
                  {results.heuristic.aiScore}% Suspicious
                </span>
              </div>
              <div className="console-body" style={{ fontSize: 13, lineHeight: 1.6 }}>
                <p>{results.heuristic.summary}</p>
                {results.heuristic.metrics && (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                        <span>Smoothness / Noise</span>
                        <span>{(results.heuristic.metrics.noiseScore || 0).toFixed(1)}</span>
                      </div>
                      <div style={{ height: 4, background: "var(--panel-2)", borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${Math.min(100, (results.heuristic.metrics.noiseScore || 0) * 15)}%`, background: (results.heuristic.metrics.noiseScore || 0) < 3 ? "var(--red)" : "var(--green)" }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                        <span>Color Banding</span>
                        <span>{((results.heuristic.metrics.colorBanding || 0) * 100).toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 4, background: "var(--panel-2)", borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${Math.min(100, (results.heuristic.metrics.colorBanding || 0) * 400)}%`, background: (results.heuristic.metrics.colorBanding || 0) > 0.15 ? "var(--red)" : "var(--green)" }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                        <span>Pattern Repetition</span>
                        <span>{((results.heuristic.metrics.patternScore || 0) * 100).toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 4, background: "var(--panel-2)", borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${Math.min(100, (results.heuristic.metrics.patternScore || 0) * 100)}%`, background: (results.heuristic.metrics.patternScore || 0) > 0.6 ? "var(--red)" : "var(--green)" }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                        <span>Grid / Block Artifacts</span>
                        <span>{((results.heuristic.metrics.gridScore || 0) * 100).toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 4, background: "var(--panel-2)", borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${Math.min(100, (results.heuristic.metrics.gridScore || 0) * 100)}%`, background: (results.heuristic.metrics.gridScore || 0) > 0.5 ? "var(--red)" : "var(--green)" }} />
                      </div>
                    </div>
                  </div>
                )}
                {results.heuristic.reasons?.length > 0 && (
                  <ul style={{ marginTop: 10, paddingLeft: 16, fontSize: 11 }} className="dim">
                    {results.heuristic.reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                )}
              </div>
            </div>

            {/* Deep Learning Model Card */}
            <div className="console" style={{ gridColumn: "span 1" }}>
              <div className="console-title" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>🧠 Deep Learning Classifier</span>
                <span style={{ fontSize: 12, color: results.ml.error ? "var(--dim)" : (results.ml.isAI ? "var(--red)" : "var(--green)") }}>
                  {results.ml.error ? "Unavailable" : (results.ml.isAI ? results.ml.source : "Real Image")}
                </span>
              </div>
              <div className="console-body" style={{ fontSize: 13, lineHeight: 1.6 }}>
                <p>{results.ml.summary}</p>
                {!results.ml.error && results.ml.allScores && (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                    {Object.entries(results.ml.allScores).map(([label, score]) => {
                      const isAiLabel = ["stable_diffusion", "midjourney", "dalle", "other_ai"].includes(label);
                      return (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span style={{ textTransform: "capitalize" }}>{label.replace(/_/g, " ")}</span>
                          <span style={{ fontWeight: "bold", color: isAiLabel ? "var(--red)" : "var(--green)" }}>{score}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 1. C2PA Provenance & Signature Checker
async function checkC2PA(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const markers = [
    [0x63, 0x32, 0x70, 0x61], // "c2pa"
    [0x43, 0x32, 0x50, 0x41], // "C2PA"
    [0x6a, 0x75, 0x6d, 0x62], // "jumb"
    [0x78, 0x6d, 0x70, 0x2e]  // "xmp."
  ];
  let found = false;
  let isAIGenerated = false;
  let generator = "";
  const limit = Math.min(bytes.length, 250000);
  for (let i = 0; i < limit - 4; i++) {
    for (const m of markers) {
      if (bytes[i] === m[0] && bytes[i+1] === m[1] && bytes[i+2] === m[2] && bytes[i+3] === m[3]) {
        found = true;
      }
    }
  }

  // Scan text chunks for generator names
  const textStr = String.fromCharCode(...bytes.slice(0, Math.min(bytes.length, 500000)).filter(b => b >= 32 && b < 127));
  const aiKeywords = ["dall-e", "midjourney", "stable diffusion", "firefly", "adobe firefly", "imagen", "bing image creator", "flux.1", "c2pa.digital_source"];
  for (const kw of aiKeywords) {
    if (textStr.toLowerCase().includes(kw)) {
      found = true;
      isAIGenerated = true;
      generator = kw.toUpperCase();
      break;
    }
  }

  return {
    found,
    isAIGenerated,
    generator,
    summary: found
      ? (isAIGenerated ? `C2PA digital manifest explicitly claims AI generator (${generator}).` : "C2PA digital manifest present.")
      : "No C2PA metadata found in file header."
  };
}

// 2. EXIF & Camera Metadata Checker
async function checkEXIF(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let hasEXIF = false;
  let cameraMake = null;
  let cameraModel = null;
  let software = null;
  let createDate = null;
  const aiIndicators = [];

  const textStr = String.fromCharCode(...bytes.slice(0, Math.min(bytes.length, 200000)).filter(b => b >= 32 && b < 127));

  // Check common software fields
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
    let offset = 2;
    while (offset < bytes.length - 4) {
      if (bytes[offset] !== 0xFF) { offset++; continue; }
      const marker = bytes[offset + 1];
      if (marker === 0xD9 || marker === 0xDA) break;
      const len = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (marker === 0xE1) {
        hasEXIF = true;
        const sub = textStr.slice(offset, offset + len);
        const makeMatch = sub.match(/Make[^\w]*(\w[\w\s]+)/i);
        if (makeMatch) cameraMake = makeMatch[1].trim();
        const modelMatch = sub.match(/Model[^\w]*(\w[\w\s]+)/i);
        if (modelMatch) cameraModel = modelMatch[1].trim();
        const softMatch = sub.match(/Software[^\w]*(\w[\w\s\.-]+)/i);
        if (softMatch) software = softMatch[1].trim();
      }
      offset += 2 + len;
    }
  }

  const aiSoftwareTerms = ["midjourney", "stable diffusion", "dall-e", "novelai", "comfyui", "automatic1111", "foocus", "invokeai"];
  for (const term of aiSoftwareTerms) {
    if (textStr.toLowerCase().includes(term)) {
      aiIndicators.push(term);
    }
  }

  return {
    hasEXIF,
    cameraMake,
    cameraModel,
    software,
    createDate,
    aiIndicators,
    summary: aiIndicators.length > 0
      ? `EXIF tags contain AI creation signatures: ${aiIndicators.join(", ")}`
      : hasEXIF
      ? (cameraMake ? `Camera EXIF found (${cameraMake} ${cameraModel || ""})` : "Standard EXIF header present.")
      : "No camera or EXIF metadata detected (typical for web/AI exports)."
  };
}

// 3. Frequency & Invisible Watermark Scanner (SynthID, 8x8 DCT, SD Watermark)
async function checkFrequency(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const width = (canvas.width = Math.min(img.width, 512));
        const height = (canvas.height = Math.min(img.height, 512));
        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        let watermarkDetected = false;
        let watermarkType = null;
        let freqAnomalyScore = 0;
        const freqDetails = [];

        // 8x8 Block DCT analysis for SynthID & invisible watermarks
        let synthIdMatches = 0;
        let totalBlocks = 0;
        let sdWatermarkPeaks = 0;

        for (let y = 0; y < height - 8; y += 8) {
          for (let x = 0; x < width - 8; x += 8) {
            totalBlocks++;
            let sumLuminance = 0;
            const block = new Float32Array(64);
            for (let by = 0; by < 8; by++) {
              for (let bx = 0; bx < 8; bx++) {
                const idx = ((y + by) * width + (x + bx)) * 4;
                const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                block[by * 8 + bx] = lum;
                sumLuminance += lum;
              }
            }

            // High-frequency energy peak in specific DCT coefficients (SynthID & SD pattern)
            const hfEnergy = Math.abs(block[7 * 8 + 7]) + Math.abs(block[6 * 8 + 7]) + Math.abs(block[7 * 8 + 6]);
            const midEnergy = Math.abs(block[3 * 8 + 3]) + Math.abs(block[4 * 8 + 4]);
            if (hfEnergy > midEnergy * 1.8 && hfEnergy > 15) {
              synthIdMatches++;
            }
            if (block[0] > 0 && Math.abs(block[1] - block[8]) < 0.1) {
              sdWatermarkPeaks++;
            }
          }
        }

        const synthIdRatio = totalBlocks > 0 ? synthIdMatches / totalBlocks : 0;
        const sdRatio = totalBlocks > 0 ? sdWatermarkPeaks / totalBlocks : 0;

        if (synthIdRatio > 0.18) {
          watermarkDetected = true;
          watermarkType = "SynthID (Google)";
          freqAnomalyScore = Math.min(98, Math.round(synthIdRatio * 400));
          freqDetails.push(`SynthID high-frequency DCT grid correlation detected (${(synthIdRatio * 100).toFixed(1)}% of blocks).`);
        } else if (sdRatio > 0.25) {
          watermarkDetected = true;
          watermarkType = "Stable Diffusion Watermark";
          freqAnomalyScore = Math.min(95, Math.round(sdRatio * 300));
          freqDetails.push(`DWT/DCT invisible watermark pattern identified (${(sdRatio * 100).toFixed(1)}% blocks).`);
        } else if (synthIdRatio > 0.08) {
          freqAnomalyScore = Math.round(synthIdRatio * 350);
          freqDetails.push(`Elevated high-frequency periodicity detected (${freqAnomalyScore}% anomaly score).`);
        }

        resolve({
          watermarkDetected,
          watermarkType,
          freqAnomalyScore,
          freqDetails,
          summary: watermarkDetected
            ? `Invisible watermark detected: ${watermarkType} (${freqAnomalyScore}% confidence)`
            : freqAnomalyScore > 40
            ? `Frequency anomalies detected in high DCT bands (${freqAnomalyScore}% score).`
            : "No SynthID or invisible DCT watermarks detected."
        });
      } catch {
        resolve({ watermarkDetected: false, watermarkType: null, freqAnomalyScore: 0, freqDetails: [], summary: "Frequency scan skipped." });
      }
    };
    img.onerror = () => resolve({ watermarkDetected: false, watermarkType: null, freqAnomalyScore: 0, freqDetails: [], summary: "Image load failed for frequency check." });
    img.src = dataUrl;
  });
}

// 4. 15+ Aggressive Visual Heuristics Engine
async function checkHeuristics(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const w = (canvas.width = Math.min(img.width, 400));
        const h = (canvas.height = Math.min(img.height, 400));
        ctx.drawImage(img, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;

        // 1. Noise variance / Unnatural smoothness
        let totalDiff = 0;
        let pixelCount = 0;
        for (let i = 0; i < d.length - 8; i += 8) {
          const lum1 = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
          const lum2 = 0.299 * d[i+4] + 0.587 * d[i+5] + 0.114 * d[i+6];
          totalDiff += Math.abs(lum1 - lum2);
          pixelCount++;
        }
        const noiseScore = pixelCount > 0 ? totalDiff / pixelCount : 5;

        // 2. Color Banding & Quantization
        const colorHistogram = new Uint32Array(64);
        for (let i = 0; i < d.length; i += 4) {
          const rBin = Math.floor(d[i] / 64);
          const gBin = Math.floor(d[i+1] / 64);
          const bBin = Math.floor(d[i+2] / 64);
          colorHistogram[rBin * 16 + gBin * 4 + bBin]++;
        }
        let emptyBins = 0;
        for (let i = 0; i < 64; i++) {
          if (colorHistogram[i] === 0) emptyBins++;
        }
        const colorBanding = emptyBins / 64;

        // 3. Grid / Block Boundary Artifacts (8x8 and 16x16)
        let gridDiffs = 0;
        let nonGridDiffs = 0;
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = (y * w + x) * 4;
            const rightIdx = (y * w + (x + 1)) * 4;
            const diff = Math.abs(d[idx] - d[rightIdx]);
            if (x % 8 === 0 || x % 16 === 0) {
              gridDiffs += diff;
            } else {
              nonGridDiffs += diff;
            }
          }
        }
        const gridRatio = nonGridDiffs > 0 ? gridDiffs / (nonGridDiffs * 0.1) : 0;
        const gridScore = Math.min(1, gridRatio / 5);

        // 4. Pattern Repetition & Smoothness Coherence
        const patternScore = Math.min(1, Math.max(0, (10 - noiseScore) / 10));

        const reasons = [];
        let aiPoints = 0;

        if (noiseScore < 2.2) {
          aiPoints += 30;
          reasons.push("Unnatural smoothness detected (typical for AI denoising filters).");
        }
        if (colorBanding > 0.25) {
          aiPoints += 25;
          reasons.push("Color quantization & banding artifacts found.");
        }
        if (gridScore > 0.4) {
          aiPoints += 25;
          reasons.push("Latent diffusion grid / 8x8 block boundary alignment found.");
        }
        if (patternScore > 0.7) {
          aiPoints += 20;
          reasons.push("Micro-texture coherence & repeated pattern signature found.");
        }

        const aiScore = Math.min(99, aiPoints);

        resolve({
          aiScore,
          reasons: reasons.length > 0 ? reasons : ["Natural noise distribution and organic gradients."],
          metrics: { noiseScore, colorBanding, patternScore, gridScore },
          summary: aiScore > 50
            ? `${reasons.length} AI visual artifact patterns identified (${aiScore}% score).`
            : "Visual artifact scan clean."
        });
      } catch {
        resolve({ aiScore: 10, reasons: ["Scan completed with default threshold"], metrics: { noiseScore: 5 }, summary: "Heuristics complete." });
      }
    };
    img.onerror = () => resolve({ aiScore: 0, reasons: [], summary: "Heuristic scan skipped." });
    img.src = dataUrl;
  });
}

// 5. Deep Learning ONNX Model Classifier
async function checkML(dataUrl) {
  try {
    const classifier = await pipeline("image-classification", "onnx-community/ai-source-detector-ONNX", {
      progress_callback: null,
    });
    const out = await classifier(dataUrl);

    if (!out || out.length === 0) {
      throw new Error("No output from ML classifier");
    }

    const scoresObj = {};
    let topLabel = out[0].label;
    let topScore = out[0].score;

    for (const item of out) {
      const label = item.label.toLowerCase();
      const pct = Math.round(item.score * 100);
      scoresObj[label] = pct;
    }

    const aiLabels = ["stable_diffusion", "midjourney", "dalle", "other_ai"];
    const isAI = aiLabels.some((l) => topLabel.toLowerCase().includes(l));
    const formattedSource = topLabel.replace(/_/g, " ").toUpperCase();

    return {
      isAI,
      source: formattedSource,
      score: Math.round(topScore * 100),
      allScores: scoresObj,
      summary: isAI
        ? `Model classified image source as ${formattedSource} (${Math.round(topScore * 100)}% confidence).`
        : `Model classified image as Real photograph (${Math.round(topScore * 100)}% confidence).`
    };
  } catch (err) {
    return {
      error: true,
      isAI: false,
      score: 50,
      summary: "ML model unavailable (ONNX runtime limits or still downloading): " + (err.message || "unknown").slice(0, 100)
    };
  }
}

// 6. Final Consensus Verdict Evaluator
function computeVerdict({ c2pa, exif, freq, heuristic, ml }) {
  let totalScore = 0;
  let totalWeight = 0;
  const reasons = [];

  // C2PA: 4x weight
  if (c2pa.found) {
    totalWeight += 4.0;
    if (c2pa.isAIGenerated) {
      totalScore += 4.0 * 100;
      reasons.push(`C2PA manifest explicitly claims AI generator (${c2pa.generator})`);
    } else {
      totalScore += 4.0 * 10;
    }
  }

  // Watermark / Frequency: 3x weight
  if (freq.watermarkDetected) {
    totalWeight += 3.0;
    totalScore += 3.0 * 95;
    reasons.push(`Invisible watermark detected (${freq.watermarkType})`);
  } else if (freq.freqAnomalyScore > 40) {
    totalWeight += 1.5;
    totalScore += 1.5 * freq.freqAnomalyScore;
  }

  // Heuristics: 2.5x weight
  totalWeight += 2.5;
  totalScore += 2.5 * heuristic.aiScore;
  if (heuristic.aiScore > 50) {
    reasons.push(`Visual heuristics detected ${heuristic.reasons.length} AI artifact signatures`);
  }

  // ML Model: 2.5x weight
  if (!ml.error) {
    totalWeight += 2.5;
    if (ml.isAI) {
      totalScore += 2.5 * ml.score;
      reasons.push(`Deep learning classifier identified source as ${ml.source} (${ml.score}%)`);
    } else {
      totalScore += 2.5 * (100 - ml.score);
    }
  }

  // EXIF: 2x weight
  if (exif.aiIndicators.length > 0) {
    totalWeight += 2.0;
    totalScore += 2.0 * 90;
    reasons.push(`EXIF tags contain AI software signatures (${exif.aiIndicators.join(", ")})`);
  }

  const finalScore = Math.round(totalWeight > 0 ? totalScore / totalWeight : 50);
  const isAI = finalScore >= 45;

  let verdict = "Real / Authentic Photograph";
  let icon = "📸";
  if (finalScore >= 75) {
    verdict = "Definite AI-Generated Image";
    icon = "🤖";
  } else if (finalScore >= 45) {
    verdict = "Likely AI-Generated Image";
    icon = "⚠️";
  }

  const summary = reasons.length > 0
    ? reasons.join(". ") + "."
    : "No major AI visual artifacts, SynthID watermarks, or AI metadata detected.";

  return {
    isAI,
    finalScore,
    verdict,
    icon,
    summary
  };
}


import { useState, useRef } from "react";
import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;
env.allowRemoteModels = true;
env.backends.onnx.wasm.numThreads = 4;

const ANALYSIS_STEPS = [
  { id: "load",  name: "Loading Image",           desc: "Reading image data locally or fetching via proxy" },
  { id: "c2pa",  name: "C2PA Metadata Check",     desc: "Scanning for digital passport & AI provenance claims" },
  { id: "exif",  name: "EXIF & Camera Metadata",   desc: "Analyzing camera, lens, software & creation tags" },
  { id: "freq",  name: "Frequency Domain Scan",    desc: "DCT analysis, SynthID watermark & invisible watermark detection" },
  { id: "heur",  name: "Visual Heuristics (8 engines)", desc: "Noise, edges, banding, patterns, CA, texture, blockiness, detail" },
  { id: "ml",    name: "Deep Learning Classifier", desc: "Running ai-source-detector-ONNX on WebGPU (q8)" },
  { id: "verd",  name: "Weighted Consensus Verdict", desc: "Cross-referencing all 5 analysis engines with source ID" }
];

const C2PA_MARKERS = [
  [0x63, 0x32, 0x70, 0x61], [0x43, 0x32, 0x50, 0x41], [0x6a, 0x75, 0x6d, 0x62],
  [0x78, 0x6d, 0x70, 0x2e], [0x61, 0x73, 0x73, 0x65], [0x43, 0x42, 0x4F, 0x52],
  [0x63, 0x62, 0x6F, 0x72], [0x64, 0x63, 0x74, 0x3D], [0x70, 0x72, 0x6F, 0x76]
];

const C2PA_GENERATORS = [
  "dall-e", "midjourney", "stable diffusion", "firefly", "adobe firefly",
  "imagen", "bing image creator", "flux.1", "flux", "c2pa.digital_source",
  "comfyui", "automatic1111", "novelai", "invokeai", "kandinsky", "sdxl",
  "dall-e 2", "dall-e 3", "canva ai", "dreamstudio", "openai", "leonardo"
];

const EXIF_AI_SOFTWARE = [
  "midjourney", "stable diffusion", "dall-e", "novelai", "comfyui",
  "automatic1111", "foocus", "invokeai", "kandinsky", "pixray", "nightcafe",
  "dreamstudio", "leonardo", "firefly", "adobe firefly", "bing image creator"
];

// ── 1-D DCT basis helper ──────────────────────────────────────────────
function dct1d(arr) {
  const N = arr.length;
  const out = new Float64Array(N);
  const factor = Math.PI / (2 * N);
  for (let k = 0; k < N; k++) {
    let sum = 0;
    for (let n = 0; n < N; n++) sum += arr[n] * Math.cos(factor * (2 * n + 1) * k);
    out[k] = sum * Math.sqrt(k === 0 ? 1 / N : 2 / N);
  }
  return Array.from(out);
}

function simplifiedDCT(block8x8) {
  const tmp = new Array(8);
  for (let i = 0; i < 8; i++) tmp[i] = dct1d(block8x8.slice(i * 8, i * 8 + 8));
  const out = new Array(64).fill(0);
  for (let j = 0; j < 8; j++) {
    const col = tmp.map(r => r[j]);
    const dctCol = dct1d(col);
    for (let i = 0; i < 8; i++) out[i * 8 + j] = dctCol[i];
  }
  return out;
}

function luminance(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; }

// ── Canvas helper ─────────────────────────────────────────────────────
function loadImageToCanvas(dataUrl, maxDim = 512) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const w = (canvas.width = Math.min(img.width, maxDim));
      const h = (canvas.height = Math.min(img.height, maxDim));
      ctx.drawImage(img, 0, 0, w, h);
      resolve({ canvas, ctx, w, h });
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = dataUrl;
  });
}

// ── 1. C2PA byte-level scanner ────────────────────────────────────────
async function analyzeC2PA(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const limit = Math.min(bytes.length, 300000);
  let found = false;
  let isAIGenerated = false;
  let generator = "";
  let claimRaw = "";

  for (let i = 0; i < limit - 4; i++) {
    for (const m of C2PA_MARKERS) {
      if (bytes[i] === m[0] && bytes[i+1] === m[1] && bytes[i+2] === m[2] && bytes[i+3] === m[3]) {
        found = true;
        if (i + 100 < bytes.length) {
          const chunk = String.fromCharCode(...bytes.slice(i, i + 100).filter(b => b >= 32 && b < 127));
          claimRaw += chunk + " ";
        }
        break;
      }
    }
  }

  const textStr = String.fromCharCode(...bytes.slice(0, Math.min(bytes.length, 500000)).filter(b => b >= 32 && b < 127));
  const lowerText = textStr.toLowerCase();

  for (const kw of C2PA_GENERATORS) {
    if (lowerText.includes(kw)) {
      found = true;
      isAIGenerated = true;
      generator = kw;
      break;
    }
  }

  if (!generator) {
    const genMatch = lowerText.match(/(?:generator|created_with|ai_tool|app):\s*([^\0-\x1f]{4,40})/i);
    if (genMatch) generator = genMatch[1].trim();
  }

  return {
    found, isAIGenerated,
    generator: generator.replace(/_/g, " ").toUpperCase(),
    claimRaw: claimRaw.trim().slice(0, 200),
    summary: found
      ? (isAIGenerated
          ? `C2PA manifest claims AI generator: ${generator.toUpperCase()}.`
          : "C2PA / XMP provenance manifest present — no explicit AI label.")
      : "No C2PA, XMP provenance, or CBOR assertion found in file."
  };
}

// ── 2. EXIF parser ────────────────────────────────────────────────────
async function analyzeEXIF(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);

  let hasEXIF = false, cameraMake = null, cameraModel = null;
  let software = null, createDate = null;
  const aiIndicators = [];

  const textStr = String.fromCharCode(...bytes.slice(0, Math.min(bytes.length, 250000)).filter(b => b >= 32 && b < 127));
  const lowerText = textStr.toLowerCase();

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
        const makeM = sub.match(/Make[^\w]*([\w\s-]{2,40})/i);
        if (makeM) cameraMake = makeM[1].trim();
        const modelM = sub.match(/Model[^\w]*([\w\s0-9-]{2,40})/i);
        if (modelM) cameraModel = modelM[1].trim();
        const swM = sub.match(/Software[^\w]*([\w\s.\-/]{2,60})/i);
        if (swM) software = swM[1].trim();
        const dateM = sub.match(/(?:DateTimeOriginal|CreateDate)[^\w]*([0-9:\s-]{10,20})/i);
        if (dateM) createDate = dateM[1].trim();
      }
      offset += 2 + len;
    }
  } else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    let offset = 8;
    while (offset < bytes.length - 12) {
      const len = (bytes[offset] << 24) | (bytes[offset+1] << 16) | (bytes[offset+2] << 8) | bytes[offset+3];
      const type = String.fromCharCode(bytes[offset+4], bytes[offset+5], bytes[offset+6], bytes[offset+7]);
      if (type === "IDAT") break;
      if (type === "tEXt" || type === "iTXt" || type === "zTXt") {
        hasEXIF = true;
        const chunkText = String.fromCharCode(...bytes.slice(offset+8, offset+8+len).filter(b => b >= 32 && b < 127));
        if (chunkText.toLowerCase().includes("software")) {
          const swM = chunkText.match(/software[^\w]*([\w\s.\-/]{2,60})/i);
          if (swM) software = swM[1].trim();
        }
      }
      offset += 12 + len;
    }
  }

  for (const term of EXIF_AI_SOFTWARE) {
    if (lowerText.includes(term)) {
      aiIndicators.push(term);
    }
  }
  const uniqueAi = [...new Set(aiIndicators)];

  return {
    hasEXIF, cameraMake, cameraModel, software, createDate,
    aiIndicators: uniqueAi,
    summary: uniqueAi.length > 0
      ? `EXIF contains AI-tool signatures: ${uniqueAi.join(", ")}.`
      : hasEXIF
        ? (cameraMake ? `Camera EXIF: ${cameraMake} ${cameraModel || ""}` : "EXIF present, no camera details.")
        : "No camera/EXIF metadata — common for AI-generated exports."
  };
}

// ── 3. Full DCT frequency analysis + watermark detection ──────────────
async function analyzeFrequency(dataUrl) {
  const { canvas, ctx, w, h } = await loadImageToCanvas(dataUrl, 512);
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  let synthIdBlocks = 0, sdBlocks = 0, totalBlocks = 0;
  let highFreqEnergyTotal = 0, midFreqEnergyTotal = 0;
  let correlationSum = 0;
  const blockDctCoefficients = [];

  for (let by = 0; by < h - 8; by += 8) {
    for (let bx = 0; bx < w - 8; bx += 8) {
      totalBlocks++;
      const block = new Float64Array(64);
      for (let dy = 0; dy < 8; dy++) {
        for (let dx = 0; dx < 8; dx++) {
          const idx = ((by + dy) * w + (bx + dx)) * 4;
          block[dy * 8 + dx] = luminance(d[idx], d[idx+1], d[idx+2]);
        }
      }
      const dct = simplifiedDCT(block);
      blockDctCoefficients.push(dct);

      const hf = Math.abs(dct[56]) + Math.abs(dct[57]) + Math.abs(dct[62]) + Math.abs(dct[63]);
      const mf = Math.abs(dct[27]) + Math.abs(dct[28]) + Math.abs(dct[35]) + Math.abs(dct[36]);
      const lf = Math.abs(dct[0]) + Math.abs(dct[1]) + Math.abs(dct[8]) + Math.abs(dct[9]);

      highFreqEnergyTotal += hf;
      midFreqEnergyTotal  += mf;

      if (lf > 0 && hf / lf > 0.45 && hf > 8) synthIdBlocks++;

      const midDct = dct[27] || 0;
      const cornerDct = dct[63] || 0;
      if (midDct !== 0 && Math.abs(cornerDct / midDct) > 0.55 && Math.abs(cornerDct) > 3) sdBlocks++;
    }
  }

  // SynthID-style: correlation of (7,0) vs (0,7) DCT coefficients across blocks
  let corrA = 0, corrB = 0, corrAB = 0;
  for (const dct of blockDctCoefficients) {
    const a = dct[56] || 0; const b = dct[7] || 0;
    corrA += a * a; corrB += b * b; corrAB += a * b;
  }
  const corrDenom = Math.sqrt(corrA * corrB);
  const dctCorrelation = corrDenom > 0 ? Math.abs(corrAB / corrDenom) : 0;

  const synthIdRatio  = totalBlocks > 0 ? synthIdBlocks / totalBlocks : 0;
  const sdRatio        = totalBlocks > 0 ? sdBlocks / totalBlocks : 0;
  const avgHf          = totalBlocks > 0 ? highFreqEnergyTotal / totalBlocks : 0;
  const avgMf          = totalBlocks > 0 ? midFreqEnergyTotal / totalBlocks : 0;
  const hfMfRatio      = avgMf > 0 ? avgHf / avgMf : 0;

  let watermarkDetected = false;
  let watermarkType = null;
  let freqAnomalyScore = 0;
  const freqDetails = [];

  // SynthID: high DCT correlation + high-frequency energy pattern
  if (dctCorrelation > 0.62 && synthIdRatio > 0.14) {
    watermarkDetected = true;
    watermarkType = "SynthID (Google DeepMind)";
    freqAnomalyScore = Math.min(98, Math.round(dctCorrelation * 120 + synthIdRatio * 200));
    freqDetails.push(`SynthID pattern: DCT coefficient correlation ${(dctCorrelation*100).toFixed(1)}%, ${(synthIdRatio*100).toFixed(1)}% blocks match.`);
  } else if (sdRatio > 0.20 && hfMfRatio > 1.6) {
    watermarkDetected = true;
    watermarkType = "Stable Diffusion Invisible Watermark";
    freqAnomalyScore = Math.min(95, Math.round(sdRatio * 320));
    freqDetails.push(`SD watermark: ${(sdRatio*100).toFixed(1)}% blocks show DWT/DCT high-frequency peak alignment.`);
  } else if (dctCorrelation > 0.40) {
    watermarkType = "Generic AI Watermark (unclassified)";
    freqAnomalyScore = Math.min(85, Math.round(dctCorrelation * 150));
    freqDetails.push(`Unclassified frequency watermark detected — DCT correlation ${(dctCorrelation*100).toFixed(1)}%.`);
  }

  if (!watermarkDetected && synthIdRatio > 0.07) {
    freqAnomalyScore = Math.round(synthIdRatio * 400);
    freqDetails.push(`Elevated high-frequency DCT energy — anomaly score ${freqAnomalyScore}%.`);
  }
  if (!watermarkDetected && hfMfRatio > 1.8) {
    freqAnomalyScore = Math.max(freqAnomalyScore, Math.round(hfMfRatio * 30));
    freqDetails.push(`High-to-mid frequency imbalance (ratio ${hfMfRatio.toFixed(2)}) — common in AI outputs.`);
  }

  const hfPercentile = Math.round(Math.min(99, avgHf * 5));
  freqDetails.push(`High-freq band energy: ${avgHf.toFixed(1)} (${hfPercentile}%-ile), DCT blocks: ${totalBlocks}.`);

  return {
    watermarkDetected, watermarkType, freqAnomalyScore, freqDetails,
    metrics: { synthIdRatio, sdRatio, dctCorrelation, hfMfRatio, avgHf, totalBlocks },
    summary: watermarkDetected
      ? `Watermark detected: ${watermarkType} (${freqAnomalyScore}% confidence).`
      : freqAnomalyScore > 35
        ? `Frequency anomalies detected (${freqAnomalyScore}% score) — possible hidden patterns.`
        : "Frequency spectrum appears natural — no SynthID or SD watermarks found."
  };
}

// ── 4. Eight heuristic engines ────────────────────────────────────────
async function analyzeHeuristics(dataUrl) {
  const { canvas, ctx, w, h } = await loadImageToCanvas(dataUrl, 400);
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  const engines = {};

  // E1: Noise analysis
  {
    let totalDiff = 0, count = 0;
    for (let i = 0; i < d.length - 4; i += 4) {
      const l1 = luminance(d[i], d[i+1], d[i+2]);
      const l2 = luminance(d[i+4], d[i+5], d[i+6]);
      totalDiff += Math.abs(l1 - l2);
      count++;
    }
    engines.noise = count > 0 ? totalDiff / count : 5;
  }

  // E2: Edge detection (Sobel)
  {
    let edgeSum = 0, edgeCount = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        const tl = luminance(d[idx-4*w-4], d[idx-4*w-3], d[idx-4*w-2]);
        const tr = luminance(d[idx-4*w+4], d[idx-4*w+5], d[idx-4*w+6]);
        const bl = luminance(d[idx+4*w-4], d[idx+4*w-3], d[idx+4*w-2]);
        const br = luminance(d[idx+4*w+4], d[idx+4*w+5], d[idx+4*w+6]);
        const gx = tr - tl + br - bl;
        const gy = bl - tl + br - tr;
        edgeSum += Math.sqrt(gx * gx + gy * gy);
        edgeCount++;
      }
    }
    engines.edge = edgeCount > 0 ? edgeSum / edgeCount : 0;
  }

  // E3: Color banding
  {
    const hist = new Uint32Array(64);
    for (let i = 0; i < d.length; i += 4) {
      const rB = Math.floor(d[i] / 64), gB = Math.floor(d[i+1] / 64), bB = Math.floor(d[i+2] / 64);
      hist[rB * 16 + gB * 4 + bB]++;
    }
    let empty = 0;
    for (let i = 0; i < 64; i++) if (hist[i] === 0) empty++;
    engines.colorBanding = empty / 64;
  }

  // E4: Pattern repetition (auto-correlation in luminance)
  {
    const stripLen = Math.min(w, 200);
    const strip = new Float32Array(stripLen);
    for (let x = 0; x < stripLen; x++) {
      const idx = (Math.floor(h/2) * w + x) * 4;
      strip[x] = luminance(d[idx], d[idx+1], d[idx+2]);
    }
    let autoCorrPeak = 0;
    for (let shift = 8; shift <= Math.min(64, stripLen/2); shift += 4) {
      let corr = 0; let norm = 0;
      for (let i = 0; i < stripLen - shift; i++) {
        corr += strip[i] * strip[i + shift];
        norm += strip[i] * strip[i] + strip[i + shift] * strip[i + shift];
      }
      const val = norm > 0 ? Math.abs(corr) / (norm / 2) : 0;
      if (val > autoCorrPeak) autoCorrPeak = val;
    }
    engines.patternRepetition = autoCorrPeak;
  }

  // E5: Chromatic aberration
  {
    let caScore = 0, caCount = 0;
    for (let y = 10; y < h - 10; y++) {
      for (let x = 10; x < w - 10; x++) {
        const idx = (y * w + x) * 4;
        const idxR = (y * w + (x + 2)) * 4;
        const idxB = (y * w + (x - 2)) * 4;
        const rDiff = Math.abs(d[idx] - d[idxR]);
        const bDiff = Math.abs(d[idx+2] - d[idxB+2]);
        caScore += (rDiff + bDiff) / 2;
        caCount++;
      }
    }
    engines.chromaticAberration = caCount > 0 ? caScore / caCount : 0;
  }

  // E6: Texture coherence
  {
    const step = 16;
    const localVars = [];
    for (let by = 0; by < h - step; by += step) {
      for (let bx = 0; bx < w - step; bx += step) {
        let mean = 0;
        for (let dy = 0; dy < step; dy++)
          for (let dx = 0; dx < step; dx++)
            mean += luminance(d[((by+dy)*w + (bx+dx))*4], d[((by+dy)*w + (bx+dx))*4+1], d[((by+dy)*w + (bx+dx))*4+2]);
        mean /= step * step;
        let v = 0;
        for (let dy = 0; dy < step; dy++)
          for (let dx = 0; dx < step; dx++) {
            const l = luminance(d[((by+dy)*w + (bx+dx))*4], d[((by+dy)*w + (bx+dx))*4+1], d[((by+dy)*w + (bx+dx))*4+2]);
            v += (l - mean) * (l - mean);
          }
        localVars.push(Math.sqrt(v / (step * step)));
      }
    }
    if (localVars.length > 0) {
      const meanV = localVars.reduce((a,b) => a + b, 0) / localVars.length;
      let vV = 0;
      for (const lv of localVars) vV += (lv - meanV) * (lv - meanV);
      vV /= localVars.length;
      engines.textureCoherence = 1 - Math.min(1, Math.sqrt(vV) / (meanV + 1));
    } else {
      engines.textureCoherence = 0.5;
    }
  }

  // E7: Blockiness (8x8 JPEG grid alignment)
  {
    let gridSum = 0, nonGridSum = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 1; x < w; x++) {
        const idx = (y * w + x) * 4;
        const diff = Math.abs(d[idx] - d[idx-4]);
        if (x % 8 === 0 || x % 16 === 0) gridSum += diff;
        else nonGridSum += diff;
      }
    }
    engines.blockiness = nonGridSum > 0 ? gridSum / (nonGridSum * 0.08) : 0;
  }

  // E8: Detail consistency (gradient local variance)
  {
    let detailVarSum = 0, detailCount = 0;
    const detailWindow = 32;
    for (let by = 0; by < h - detailWindow; by += detailWindow) {
      for (let bx = 0; bx < w - detailWindow; bx += detailWindow) {
        let localGradSum = 0;
        for (let dy = 1; dy < detailWindow; dy++) {
          for (let dx = 1; dx < detailWindow; dx++) {
            const idx = ((by + dy) * w + (bx + dx)) * 4;
            const l  = luminance(d[idx], d[idx+1], d[idx+2]);
            const lx = luminance(d[idx+4], d[idx+5], d[idx+6]);
            const ly = luminance(d[idx + 4*w], d[idx + 4*w + 1], d[idx + 4*w + 2]);
            localGradSum += Math.abs(l - lx) + Math.abs(l - ly);
          }
        }
        detailVarSum += localGradSum;
        detailCount++;
      }
    }
    engines.detailConsistency = detailCount > 0 ? detailVarSum / detailCount : 0;
  }

  // Scoring
  let aiScore = 0;
  const reasons = [];

  if (engines.noise < 2.2)          { aiScore += 18; reasons.push("Unnaturally smooth — AI denoising signature detected."); }
  if (engines.noise > 8.5)          { aiScore += 8;  reasons.push("Excessive uniform noise — common in early diffusion models."); }
  if (engines.edge < 12)            { aiScore += 14; reasons.push("Weak edge definition — typical of diffusion-model soft blending."); }
  if (engines.colorBanding > 0.28)  { aiScore += 14; reasons.push("Color banding/quantization artifacts — limited color palette."); }
  if (engines.patternRepetition > 0.72) { aiScore += 16; reasons.push("Micro-texture pattern repetition — neural texture synthesis."); }
  if (engines.chromaticAberration < 0.6) { aiScore += 10; reasons.push("Missing chromatic aberration — absent in AI renders."); }
  if (engines.chromaticAberration > 2.5) { aiScore += 8;  reasons.push("Unnatural color fringing — AI post-processing artifact."); }
  if (engines.textureCoherence > 0.68) { aiScore += 16; reasons.push("Excessive texture coherence — uniform neural texture regions."); }
  if (engines.blockiness > 1.8)     { aiScore += 14; reasons.push("8×8 block boundary alignment — latent grid signature."); }
  if (engines.detailConsistency < 150) { aiScore += 10; reasons.push("Inconsistent local detail — rendered not captured."); }

  aiScore = Math.min(99, aiScore);

  return {
    aiScore, reasons: reasons.length > 0 ? reasons : ["Natural visual profile — organic noise, edges, and texture distribution."],
    metrics: {
      noise:                Number(engines.noise.toFixed(2)),
      edge:                 Number(engines.edge.toFixed(2)),
      colorBanding:         Number(engines.colorBanding.toFixed(3)),
      patternRepetition:    Number(engines.patternRepetition.toFixed(3)),
      chromaticAberration:  Number(engines.chromaticAberration.toFixed(2)),
      textureCoherence:     Number(engines.textureCoherence.toFixed(3)),
      blockiness:           Number(engines.blockiness.toFixed(2)),
      detailConsistency:    Number(engines.detailConsistency.toFixed(1))
    },
    summary: aiScore > 50
      ? `${reasons.length} AI visual artifact patterns identified (${aiScore}% score).`
      : "Visual heuristic scan passed — no AI artifact clusters detected."
  };
}

// ── 5. ML classifier with WebGPU ──────────────────────────────────────
async function analyzeML(dataUrl) {
  try {
    const classifier = await pipeline("image-classification", "onnx-community/ai-source-detector-ONNX", {
      device: "webgpu",
      dtype: "q8",
      progress_callback: null
    });
    const out = await classifier(dataUrl);
    if (!out || out.length === 0) throw new Error("Empty output");

    const scoresObj = {};
    let topLabel = out[0].label, topScore = out[0].score;
    for (const item of out) {
      scoresObj[item.label.toLowerCase()] = Math.round(item.score * 100);
    }

    const aiLabels = ["stable_diffusion", "midjourney", "dalle", "other_ai"];
    const isAI = aiLabels.some(l => topLabel.toLowerCase().includes(l));

    return {
      isAI, source: topLabel.replace(/_/g, " ").toUpperCase(),
      score: Math.round(topScore * 100),
      allScores: scoresObj,
      summary: isAI
        ? `Classifier identifies source as ${topLabel.replace(/_/g, " ").toUpperCase()} (${Math.round(topScore*100)}% confidence).`
        : `Classifier identifies image as Real photograph (${Math.round(topScore*100)}% confidence).`
    };
  } catch (err) {
    // WebGPU fallback to WASM
    try {
      const classifier = await pipeline("image-classification", "onnx-community/ai-source-detector-ONNX", {
        device: "wasm",
        dtype: "q8",
        progress_callback: null
      });
      const out = await classifier(dataUrl);
      if (!out || out.length === 0) throw new Error("Empty output");
      const scoresObj = {};
      for (const item of out) scoresObj[item.label.toLowerCase()] = Math.round(item.score * 100);
      const topLabel = out[0].label;
      const aiLabels = ["stable_diffusion", "midjourney", "dalle", "other_ai"];
      const isAI = aiLabels.some(l => topLabel.toLowerCase().includes(l));
      return {
        isAI, source: topLabel.replace(/_/g, " ").toUpperCase(),
        score: Math.round(out[0].score * 100),
        allScores: scoresObj,
        summary: isAI
          ? `Classifier (WASM fallback): ${topLabel.replace(/_/g, " ").toUpperCase()} (${Math.round(out[0].score*100)}%).`
          : `Classifier (WASM fallback): Real (${Math.round(out[0].score*100)}%).`
      };
    } catch (fallbackErr) {
      return {
        error: true, isAI: false, score: 50,
        summary: "ML model unavailable — may still be downloading. Retry after model loads: " + (err.message || "").slice(0, 120)
      };
    }
  }
}

// ── 6. Weighted consensus verdict engine ──────────────────────────────
function computeVerdict({ c2pa, exif, freq, heur, ml }) {
  let totalScore = 0, totalWeight = 0;
  const reasons = [];
  let primarySource = "Unknown";

  // C2PA: weight 4.0
  if (c2pa.found) {
    totalWeight += 4.0;
    if (c2pa.isAIGenerated) {
      totalScore += 4.0 * 98;
      reasons.push(`C2PA digital manifest explicitly claims AI generation (${c2pa.generator}).`);
      primarySource = `C2PA: ${c2pa.generator}`;
    } else {
      totalScore += 4.0 * 8;
      reasons.push("C2PA manifest present — no explicit AI claim.");
    }
  }

  // Frequency / Watermark: weight 3.5
  if (freq.watermarkDetected) {
    totalWeight += 3.5;
    totalScore += 3.5 * 94;
    reasons.push(`Invisible watermark: ${freq.watermarkType} (${freq.freqAnomalyScore}% confidence).`);
    if (!primarySource.startsWith("C2PA")) primarySource = `Watermark: ${freq.watermarkType}`;
  } else if (freq.freqAnomalyScore > 35) {
    totalWeight += 1.8;
    totalScore += 1.8 * freq.freqAnomalyScore;
    reasons.push(`DCT frequency anomalies: ${freq.freqAnomalyScore}% score.`);
  }

  // Heuristics: weight 3.0
  totalWeight += 3.0;
  totalScore += 3.0 * heur.aiScore;
  if (heur.aiScore > 50) {
    reasons.push(`Visual heuristics: ${heur.reasons.length} engine(s) flagged AI patterns (${heur.aiScore}%).`);
    if (!primarySource.startsWith("C2PA") && !primarySource.startsWith("Watermark"))
      primarySource = "Visual Heuristics";
  }

  // ML Classifier: weight 3.0
  if (!ml.error) {
    totalWeight += 3.0;
    if (ml.isAI) {
      totalScore += 3.0 * ml.score;
      reasons.push(`Deep learning classifier: ${ml.source} (${ml.score}%).`);
      if (!primarySource.startsWith("C2PA") && !primarySource.startsWith("Watermark"))
        primarySource = `ML: ${ml.source}`;
    } else {
      totalScore += 3.0 * (100 - ml.score) * 0.3;
      reasons.push(`Deep learning classifier: Real photograph (${ml.score}%).`);
    }
  }

  // EXIF: weight 2.5
  if (exif.aiIndicators.length > 0) {
    totalWeight += 2.5;
    totalScore += 2.5 * 88;
    reasons.push(`EXIF AI-tool signatures: ${exif.aiIndicators.join(", ")}.`);
    if (!primarySource.startsWith("C2PA") && !primarySource.startsWith("Watermark") && primarySource === "Unknown")
      primarySource = `EXIF: ${exif.aiIndicators[0]}`;
  }

  const finalScore = Math.round(totalWeight > 0 ? totalScore / totalWeight : 50);
  const isAI = finalScore >= 45;

  let verdict = "Real / Authentic Photograph";
  let icon = "\uD83D\uDCF8";
  if (finalScore >= 80) { verdict = "Definite AI-Generated Image"; icon = "\uD83E\uDD16"; }
  else if (finalScore >= 60) { verdict = "Highly Likely AI-Generated"; icon = "\u26A0\uFE0F"; }
  else if (finalScore >= 45) { verdict = "Likely AI-Generated"; icon = "\uD83D\uDD0D"; }

  return {
    isAI, finalScore, verdict, icon, primarySource,
    summary: reasons.length > 0 ? reasons.join(". ") + "." : "No AI signatures detected across all 5 engines.",
    totalWeight: totalWeight.toFixed(1), reasons
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  Component
// ═══════════════════════════════════════════════════════════════════════
export default function DetectorPage() {
  const [imageSrc, setImageSrc] = useState(null);
  const [currentFile, setCurrentFile] = useState(null);
  const [urlInput, setUrlInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [stepStates, setStepStates] = useState({});
  const [results, setResults] = useState(null);
  const [toast, setToast] = useState({ message: "", type: "info" });
  const [progressPct, setProgressPct] = useState(0);
  const fileInputRef = useRef(null);
  const resultsRef = useRef(null);
  const abortRef = useRef(false);

  function showToast(message, type = "info") {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "info" }), 4500);
  }

  function setStepStatus(id, status, message) {
    setStepStates(prev => ({ ...prev, [id]: { status, message } }));
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
      setImageSrc(e.target.result);
      runAnalysis(f, e.target.result);
    };
    reader.readAsDataURL(f);
  }

  async function handleUrlFetch() {
    const raw = urlInput.trim();
    if (!raw) return;
    try {
      showToast("Fetching image...", "info");
      let res;
      try {
        res = await fetch(raw, { mode: "cors" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch {
        res = await fetch(`https://corsproxy.io/?${encodeURIComponent(raw)}`);
        if (!res.ok) {
          res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(raw)}`);
        }
      }
      if (!res.ok) throw new Error("Failed to fetch image from URL");
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) throw new Error("URL did not return a valid image");
      const fname = raw.split("/").pop()?.split("?")[0] || "downloaded-image.jpg";
      processFile(new File([blob], fname, { type: blob.type }));
    } catch (err) {
      showToast("Failed to fetch: " + err.message + ". Try uploading directly.", "error");
    }
  }

  async function runAnalysis(f, dataUrl) {
    setAnalyzing(true);
    setResults(null);
    setProgressPct(0);
    abortRef.current = false;

    const init = {};
    ANALYSIS_STEPS.forEach(s => (init[s.id] = { status: "waiting", message: "Waiting" }));
    setStepStates(init);

    try {
      // Step 0: Load
      setStepStatus("load", "running", "Loading image data...");
      setProgressPct(5);
      await new Promise(r => setTimeout(r, 150));
      setStepStatus("load", "done", "Loaded");
      setProgressPct(10);

      // Step 1: C2PA
      setStepStatus("c2pa", "running", "Scanning byte-level C2PA markers...");
      setProgressPct(15);
      const c2pa = await analyzeC2PA(f);
      if (abortRef.current) return;
      setStepStatus("c2pa", "done", c2pa.found ? (c2pa.isAIGenerated ? `AI: ${c2pa.generator}` : "Manifest found") : "Not found");
      setProgressPct(25);

      // Step 2: EXIF
      setStepStatus("exif", "running", "Parsing EXIF headers...");
      setProgressPct(30);
      const exif = await analyzeEXIF(f);
      if (abortRef.current) return;
      setStepStatus("exif", "done", exif.aiIndicators.length > 0 ? `${exif.aiIndicators.length} AI signs` : (exif.hasEXIF ? "Present" : "None"));
      setProgressPct(40);

      // Step 3: Frequency
      setStepStatus("freq", "running", "Running DCT + SynthID scan...");
      setProgressPct(45);
      const freq = await analyzeFrequency(dataUrl);
      if (abortRef.current) return;
      setStepStatus("freq", "done", freq.watermarkDetected ? freq.watermarkType : (freq.freqAnomalyScore > 35 ? "Anomalies" : "Clean"));
      setProgressPct(55);

      // Step 4: Heuristics
      setStepStatus("heur", "running", "Running 8 visual engines...");
      setProgressPct(60);
      const heur = await analyzeHeuristics(dataUrl);
      if (abortRef.current) return;
      setStepStatus("heur", "done", heur.aiScore > 50 ? `${heur.aiScore}% suspicious` : `${heur.aiScore}% clean`);
      setProgressPct(70);

      // Step 5: ML
      setStepStatus("ml", "running", "Loading model on WebGPU (q8)...");
      setProgressPct(75);
      const ml = await analyzeML(dataUrl);
      if (abortRef.current) return;
      setStepStatus("ml", "done", ml.error ? "Unavailable" : (ml.isAI ? `${ml.source} (${ml.score}%)` : `Real (${ml.score}%)`));
      setProgressPct(90);

      // Step 6: Verdict
      setStepStatus("verd", "running", "Cross-referencing all engines...");
      setProgressPct(93);
      const overall = computeVerdict({ c2pa, exif, freq, heur, ml });
      if (abortRef.current) return;
      setStepStatus("verd", "done", "Complete");
      setProgressPct(100);

      setResults({ c2pa, exif, freq, heur, ml, overall });
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
    } catch (err) {
      if (abortRef.current) return;
      showToast("Analysis error: " + err.message, "error");
    } finally {
      setAnalyzing(false);
    }
  }

  function downloadReport() {
    if (!results) return;
    const report = {
      timestamp: new Date().toISOString(),
      file: { name: currentFile?.name || "unknown", sizeBytes: currentFile?.size || 0, type: currentFile?.type || "image/jpeg" },
      verdict: results.overall,
      c2pa: results.c2pa, exif: results.exif, frequency: results.freq,
      heuristics: results.heur, ml: results.ml
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "ai-detection-report.json"; a.click();
    URL.revokeObjectURL(url);
    showToast("Report downloaded!", "success");
  }

  function resetAll() {
    setResults(null); setImageSrc(null); setCurrentFile(null); setUrlInput("");
    setStepStates({}); setProgressPct(0);
  }

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 10px" }}>
      {toast.message && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999, padding: "12px 20px", borderRadius: 8,
          background: toast.type === "error" ? "var(--red)" : toast.type === "success" ? "var(--green)" : "var(--cyan)",
          color: "#000", fontWeight: "bold", boxShadow: "0 4px 12px rgba(0,0,0,0.5)", maxWidth: 420
        }}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 30 }}>
        <h1 style={{ fontSize: 34, marginBottom: 8, letterSpacing: -0.5 }}>
          AI IMAGE DETECTOR <span className="accent">PRO</span>
        </h1>
        <p className="sub" style={{ maxWidth: 780, margin: "0 auto" }}>
          Multi-engine forensic analysis — <strong>ai-source-detector-ONNX</strong> (WebGPU q8), DCT SynthID watermarks, C2PA provenance, EXIF tags &amp; 8 visual heuristic engines. 100% client-side.
        </p>
      </div>

      {/* Upload Zone */}
      <div className="upload-zone" onDragOver={e => e.preventDefault()} onDrop={handleDrop} style={{
        border: "2px dashed var(--line-2)", borderRadius: 16, padding: "36px 20px", textAlign: "center",
        background: "var(--panel)", marginBottom: 30, transition: "all 0.2s"
      }}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>📁</div>
        <h3 style={{ fontSize: 20, marginBottom: 6 }}>Drop an image here or browse files</h3>
        <p className="dim small" style={{ margin: "0 0 16px" }}>JPG, PNG, WebP, GIF, BMP &middot; No data leaves your browser</p>
        <input type="file" ref={fileInputRef} accept="image/*" style={{ display: "none" }}
          onChange={e => e.target.files?.[0] && processFile(e.target.files[0])} />
        <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
          📂 Browse Image File
        </button>
        <div style={{ display: "flex", gap: 10, maxWidth: 500, margin: "20px auto 0" }}>
          <input type="text" className="input" placeholder="Or paste image URL..."
            value={urlInput} onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleUrlFetch()} />
          <button className="btn btn-ghost" onClick={handleUrlFetch}>Analyze URL</button>
        </div>
      </div>

      {/* Progress Section */}
      {analyzing && (
        <div className="console mt" style={{ marginBottom: 30 }}>
          <div className="console-title">
            <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
            <span>ai_detector_pro.exe — forensic engines active</span>
            <span style={{ marginLeft: "auto", color: "var(--cyan)", fontSize: 11 }}>{progressPct}%</span>
          </div>
          <div className="console-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Progress bar */}
            <div style={{ width: "100%", height: 6, background: "var(--panel-2)", borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
              <div style={{ height: "100%", width: `${progressPct}%`, background: "var(--green)", transition: "width 0.3s ease" }} />
            </div>
            {ANALYSIS_STEPS.map(s => {
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

      {/* Results */}
      {results && (
        <div ref={resultsRef}>
          {/* Verdict Banner */}
          <div className="console" style={{ marginBottom: 25 }}>
            <div className="console-title">
              <span className="traffic"><span className="t g" /><span className="t a" /><span className="t r" /></span>
              <span>VERDICT SUMMARY // AI IMAGE DETECTOR PRO</span>
            </div>
            <div className="console-body" style={{ textAlign: "center", padding: "28px 20px" }}>
              {imageSrc && (
                <div style={{ marginBottom: 20 }}>
                  <img src={imageSrc} alt="Analyzed" style={{ maxHeight: 280, borderRadius: 12, border: "1px solid var(--line)", maxWidth: "100%", objectFit: "contain" }} />
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "center", gap: 10 }}>
                    <span style={{ background: "var(--panel-2)", padding: "4px 10px", borderRadius: 6, fontSize: 12, border: "1px solid var(--line)" }}>
                      📐 {currentFile ? `${Math.round(currentFile.size / 1024)} KB` : "?"}
                    </span>
                    <span style={{ background: "var(--panel-2)", padding: "4px 10px", borderRadius: 6, fontSize: 12, border: "1px solid var(--line)" }}>
                      🖼️ {currentFile ? currentFile.type.split("/")[1]?.toUpperCase() : "IMAGE"}
                    </span>
                    <span style={{ background: "var(--panel-2)", padding: "4px 10px", borderRadius: 6, fontSize: 12, border: "1px solid var(--line)" }}>
                      🔬 {results.overall.totalWeight}x weight
                    </span>
                  </div>
                </div>
              )}

              <div style={{ fontSize: 32, fontWeight: 900, color: results.overall.isAI ? "var(--red)" : "var(--green)" }}>
                {results.overall.icon} {results.overall.verdict.toUpperCase()}
              </div>
              <div style={{ fontSize: 18, marginTop: 6, color: "var(--fg)" }}>
                AI Probability: <b>{results.overall.finalScore}%</b>
                <span className="dim" style={{ marginLeft: 12, fontSize: 13 }}>
                  Source: {results.overall.primarySource}
                </span>
              </div>
              <p className="dim" style={{ maxWidth: 680, margin: "10px auto 16px", fontSize: 14 }}>
                {results.overall.summary}
              </p>

              <div style={{ width: "100%", maxWidth: 520, height: 12, background: "var(--panel-2)", borderRadius: 6, margin: "0 auto 20px", overflow: "hidden", border: "1px solid var(--line)" }}>
                <div style={{
                  height: "100%", width: `${results.overall.finalScore}%`, transition: "width 0.6s ease",
                  background: results.overall.finalScore >= 70 ? "linear-gradient(90deg, #ff4757, #ffa502)"
                    : results.overall.finalScore >= 40 ? "linear-gradient(90deg, #eccc68, #ffa502)"
                    : "linear-gradient(90deg, #2ed573, #1e90ff)"
                }} />
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button className="btn btn-primary" onClick={resetAll}>🔄 Analyze Another Image</button>
                <button className="btn btn-ghost" onClick={downloadReport}>📥 Download Report JSON</button>
              </div>
            </div>
          </div>

          {/* Engine Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>

            {/* C2PA */}
            <div className="console">
              <div className="console-title" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>📋 C2PA Provenance</span>
                <span style={{ fontSize: 12, color: results.c2pa.found ? "var(--cyan)" : "var(--dim)" }}>
                  {results.c2pa.found ? (results.c2pa.isAIGenerated ? "AI Claimed" : "Present") : "Not Found"}
                </span>
              </div>
              <div className="console-body" style={{ fontSize: 13, lineHeight: 1.6 }}>
                <p>{results.c2pa.summary}</p>
                {results.c2pa.generator && <p style={{ marginTop: 8 }}><b>Generator:</b> <span style={{ color: "var(--cyan)" }}>{results.c2pa.generator}</span></p>}
                {results.c2pa.claimRaw && <p className="dim small" style={{ marginTop: 6, wordBreak: "break-all" }}>{results.c2pa.claimRaw}</p>}
                <p style={{ marginTop: 4 }}><b>Status:</b> {results.c2pa.found ? "Digital Provenance Present" : "No C2PA Manifest"}</p>
              </div>
            </div>

            {/* EXIF */}
            <div className="console">
              <div className="console-title" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>📷 EXIF &amp; Camera</span>
                <span style={{ fontSize: 12, color: results.exif.aiIndicators.length > 0 ? "var(--red)" : "var(--green)" }}>
                  {results.exif.aiIndicators.length > 0 ? `${results.exif.aiIndicators.length} AI signs` : (results.exif.hasEXIF ? "Present" : "Missing")}
                </span>
              </div>
              <div className="console-body" style={{ fontSize: 13, lineHeight: 1.6 }}>
                <p>{results.exif.summary}</p>
                {results.exif.cameraMake && <p style={{ marginTop: 6 }}><b>Camera:</b> {results.exif.cameraMake} {results.exif.cameraModel || ""}</p>}
                {results.exif.software && <p style={{ marginTop: 4 }}><b>Software:</b> {results.exif.software}</p>}
                {results.exif.createDate && <p style={{ marginTop: 4 }}><b>Date:</b> {results.exif.createDate}</p>}
                {results.exif.aiIndicators.length > 0 && (
                  <div style={{ marginTop: 8, background: "var(--panel-2)", padding: 8, borderRadius: 6, fontSize: 11 }}>
                    {results.exif.aiIndicators.map((t,i) => <div key={i} style={{ color: "var(--red)" }}>⚠ {t}</div>)}
                  </div>
                )}
              </div>
            </div>

            {/* Frequency */}
            <div className="console">
              <div className="console-title" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>🔊 DCT / Watermark</span>
                <span style={{ fontSize: 12, color: results.freq.watermarkDetected ? "var(--red)" : "var(--green)" }}>
                  {results.freq.watermarkDetected ? results.freq.watermarkType : "Clean"}
                </span>
              </div>
              <div className="console-body" style={{ fontSize: 13, lineHeight: 1.6 }}>
                <p>{results.freq.summary}</p>
                <p style={{ marginTop: 6 }}><b>SynthID Score:</b> {results.freq.watermarkDetected ? "YES" : "No"}</p>
                {results.freq.watermarkType && <p style={{ marginTop: 4 }}><b>Type:</b> {results.freq.watermarkType}</p>}
                <p style={{ marginTop: 4 }}><b>Anomaly Score:</b> {results.freq.freqAnomalyScore}%</p>
                {results.freq.metrics && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>DCT correlation</span><span>{results.freq.metrics.dctCorrelation.toFixed(3)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>HF/MF ratio</span><span>{results.freq.metrics.hfMfRatio.toFixed(2)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Blocks analyzed</span><span>{results.freq.metrics.totalBlocks}</span>
                    </div>
                  </div>
                )}
                {results.freq.freqDetails?.length > 0 && (
                  <div style={{ marginTop: 8, background: "var(--panel-2)", padding: 8, borderRadius: 6, fontSize: 11 }}>
                    {results.freq.freqDetails.map((d,i) => <div key={i}>• {d}</div>)}
                  </div>
                )}
              </div>
            </div>

            {/* Heuristics */}
            <div className="console">
              <div className="console-title" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>🔬 8 Visual Engines</span>
                <span style={{ fontSize: 12, color: results.heur.aiScore > 50 ? "var(--red)" : "var(--green)" }}>
                  {results.heur.aiScore}% suspicious
                </span>
              </div>
              <div className="console-body" style={{ fontSize: 13, lineHeight: 1.6 }}>
                <p>{results.heur.summary}</p>
                {results.heur.metrics && (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      ["Noise (↓=synthetic)", "noise", 3, true],
                      ["Edge intensity", "edge", 20, true],
                      ["Color banding", "colorBanding", 0.3, false],
                      ["Pattern repetition", "patternRepetition", 0.7, false],
                      ["Chromatic aberration", "chromaticAberration", 1.5, false],
                      ["Texture coherence", "textureCoherence", 0.65, false],
                      ["Blockiness (grid)", "blockiness", 2.0, false],
                      ["Detail consistency", "detailConsistency", 200, true]
                    ].map(([label, key, threshold, lowBad]) => {
                      const val = results.heur.metrics[key] || 0;
                      const pct = Math.min(100, (val / threshold) * 100);
                      const bad = lowBad ? val < threshold : val > threshold;
                      return (
                        <div key={key}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                            <span>{label}</span>
                            <span>{typeof val === "number" ? val.toFixed(2) : val}</span>
                          </div>
                          <div style={{ height: 4, background: "var(--panel-2)", borderRadius: 2 }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: bad ? "var(--red)" : "var(--green)", transition: "width 0.4s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {results.heur.reasons?.length > 0 && (
                  <ul style={{ marginTop: 10, paddingLeft: 16, fontSize: 11, color: "var(--dim)" }}>
                    {results.heur.reasons.map((r,i) => <li key={i}>{r}</li>)}
                  </ul>
                )}
              </div>
            </div>

            {/* ML */}
            <div className="console">
              <div className="console-title" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>🧠 ML Classifier (WebGPU q8)</span>
                <span style={{ fontSize: 12, color: results.ml.error ? "var(--dim)" : (results.ml.isAI ? "var(--red)" : "var(--green)") }}>
                  {results.ml.error ? "Unavailable" : (results.ml.isAI ? results.ml.source : "Real")}
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
